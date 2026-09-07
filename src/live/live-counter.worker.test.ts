import {
	env,
	evictDurableObject,
	runDurableObjectAlarm,
	runInDurableObject,
} from "cloudflare:test";
import type { LiveUpdate } from "@/core/live-update";
import type { SignatureCounts } from "@/core/signature-counts";
import { LIVE_SUPPORTERS } from "@/db/signatures";
import { resetDatabase } from "@/db/test-support";

/**
 * The `LiveCounter` Durable Object, driven through the only two things that
 * can reach it: a WebSocket upgrade and the notification the sign path fires.
 *
 * ## Assumptions this file encodes
 *
 * - **The notification carries no number.** It says a signature was stored,
 *   not that the total is one higher, so the object answers it by re-reading
 *   D1. Arithmetic on a cached total is what double-counts the row that a
 *   cold-start rebuild has already seen.
 * - **D1 is truth and the object never writes it.** Every value it broadcasts
 *   came out of a `GROUP BY` a moment earlier.
 * - **Output on the wire** is `LiveUpdate` as JSON — the counts, and the newest
 *   published names the object believes are news — identical to what
 *   `/api/signatures/snapshot` answers with.
 * - **Who may be named is not the object's decision.** It reads through
 *   `readSupporters`, so the consent gate and the redaction are the same ones
 *   the public list is built from.
 * - **Boundaries**: a cold object that has never read D1; a burst of
 *   notifications inside one coalescing window; a change nobody notified
 *   about; a heartbeat with nothing to report; the last socket closing.
 * - **Not covered here**: reconnecting a dropped socket, which the issue puts
 *   out of scope in favour of the platform's own close/retry and the page's
 *   polling fallback.
 */
beforeEach(resetDatabase);

/** A fresh object per test, so no test inherits another's cached counts. */
let objectCounter = 0;

function freshCounter(): DurableObjectStub<import("@/live").LiveCounter> {
	objectCounter += 1;
	return env.LIVE_COUNTER.get(env.LIVE_COUNTER.idFromName(`test-${objectCounter}`));
}

/** A row written straight to D1, the way the sign path leaves one behind. */
async function storeSignature(email: string, voivodeshipCode = "unknown"): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo, voivodeship_code)
		 VALUES (?, ?, ?, ?, ?, 'person', 1, ?)`,
	)
		.bind(crypto.randomUUID(), "Anna", "Kowalska", email, "Warszawa", voivodeshipCode)
		.run();
}

/** A connected browser, remembering everything the object pushed at it. */
class Listener {
	readonly received: LiveUpdate[] = [];

	constructor(private readonly socket: WebSocket) {
		socket.accept();
		socket.addEventListener("message", (event) => {
			this.received.push(JSON.parse(String(event.data)) as LiveUpdate);
		});
	}

	/** The nth push, waited for rather than assumed to have arrived. */
	async message(index: number): Promise<LiveUpdate> {
		await vi.waitFor(() => expect(this.received.length).toBeGreaterThan(index));
		return this.received[index] as LiveUpdate;
	}

	/**
	 * The nth push's counts, without the tempo.
	 *
	 * The tempo is a duration measured at the moment of reading, so a test that
	 * pinned it would be asserting how long its own inserts took. What every
	 * assertion below is about is the total and its split; how long ago the last
	 * signature arrived is `queries.worker.test.ts`'s subject.
	 */
	async counts(index: number): Promise<Pick<SignatureCounts, "total" | "byVoivodeship">> {
		const { counts } = await this.message(index);
		return { total: counts.total, byVoivodeship: counts.byVoivodeship };
	}

	close(): void {
		this.socket.close();
	}
}

async function connect(stub: DurableObjectStub<import("@/live").LiveCounter>): Promise<Listener> {
	const response = await stub.fetch("https://live.invalid/api/live", {
		headers: { Upgrade: "websocket" },
	});

	expect(response.status).toBe(101);
	const socket = response.webSocket;
	if (!socket) throw new Error("upgrade produced no socket");
	return new Listener(socket);
}

describe("LiveCounter, connecting", () => {
	// The cold-start rebuild, and the reason the object may be evicted at any
	// moment without anybody caring: it holds nothing that is not in D1.
	it("greets a client with the counts D1 holds", async () => {
		await storeSignature("anna@example.com", "PL-MZ");
		await storeSignature("jan@example.com", "PL-MZ");
		await storeSignature("ewa@example.com", "PL-DS");

		const client = await connect(freshCounter());

		expect(await client.counts(0)).toEqual({
			total: 3,
			byVoivodeship: { "PL-MZ": 2, "PL-DS": 1 },
		});
	});

	it("greets a client on an empty petition with zero", async () => {
		const client = await connect(freshCounter());

		expect(await client.counts(0)).toEqual({ total: 0, byVoivodeship: {} });
	});

	// The object speaks one protocol. A plain GET is a request it cannot
	// answer, and answering it with a page of anything would invite somebody to
	// depend on that instead of on the snapshot endpoint.
	it("refuses a request that is not a WebSocket upgrade", async () => {
		const response = await freshCounter().fetch("https://live.invalid/api/live");

		expect(response.status).toBe(426);
	});
});

/**
 * What the sign path fires after a row lands, and the reason it carries no
 * number: the object answers a notification by asking D1, so there is no
 * arithmetic to get wrong and no notification whose loss corrupts a total.
 */
describe("LiveCounter, notified of a signature", () => {
	it("pushes the new counts to every connected client", async () => {
		const counter = freshCounter();
		const [anna, jan] = await Promise.all([connect(counter), connect(counter)]);

		await storeSignature("anna@example.com", "PL-MZ");
		await counter.signatureRecorded();

		expect(await anna.counts(1)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
		expect(await jan.counts(1)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
	});

	/**
	 * The failure the plan's readiness review named, made a test.
	 *
	 * A notification can be the first thing a cold object ever hears — the row
	 * that caused it is already in D1, so a rebuild sees it. Adding one on top
	 * of a rebuild counts it twice, and nothing downstream can tell that the
	 * number is wrong rather than merely surprising.
	 */
	it("counts a signature once when its notification is the first thing it hears", async () => {
		const counter = freshCounter();
		await storeSignature("anna@example.com", "PL-MZ");

		await counter.signatureRecorded();

		const client = await connect(counter);
		expect(await client.counts(0)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
	});

	// The other half of the same idea: an object that has been running for a
	// while and has a cached number must still end up at D1's, not at its own
	// plus one.
	it("counts a signature once when it already had a number in hand", async () => {
		const counter = freshCounter();
		await storeSignature("anna@example.com", "PL-MZ");
		const client = await connect(counter);
		expect(await client.counts(0)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });

		await storeSignature("jan@example.com", "PL-DS");
		await counter.signatureRecorded();

		expect(await client.counts(1)).toEqual({
			total: 2,
			byVoivodeship: { "PL-MZ": 1, "PL-DS": 1 },
		});
	});
});

/**
 * The hibernation API, asserted rather than assumed.
 *
 * A page left open in a background tab is the normal case for a petition, and
 * the difference between `acceptWebSocket` and `accept` is whether the
 * deployment pays for an object sitting idle behind every one of those tabs.
 * The difference is invisible until an eviction, which is why one is staged
 * here.
 */
describe("LiveCounter, hibernation", () => {
	it("hands the socket to the runtime rather than holding it in memory", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		await client.message(0);

		const attached = await runInDurableObject(
			counter,
			(_instance, state) => state.getWebSockets().length,
		);

		expect(attached).toBe(1);
	});

	// The consequence, which is what actually matters: an object evicted while
	// a reader has the page open comes back and finds them still there.
	it("keeps pushing to a socket that outlived the instance which accepted it", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		expect(await client.counts(0)).toEqual({ total: 0, byVoivodeship: {} });

		await evictDurableObject(counter);

		await storeSignature("anna@example.com", "PL-MZ");
		await counter.signatureRecorded();

		expect(await client.counts(1)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
	});
});

/**
 * Coalescing, which is the difference between a counter and a strobe.
 *
 * The guarantee is not "one push per signature" — it is that whatever the last
 * push says is what D1 says, and that it says it soon. A burst is the case
 * where those two pull apart.
 */
describe("LiveCounter, under a burst", () => {
	const BURST = 50;

	it("ends up at D1's number without pushing once per signature", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		await client.message(0);

		for (let n = 0; n < BURST; n++) {
			await storeSignature(`signer-${n}@example.com`, "PL-MZ");
			await counter.signatureRecorded();
		}

		// The threshold: convergence inside roughly one coalescing window, with
		// slack for the alarm's own latency. `waitFor` failing *is* the
		// assertion — a counter that arrives at the right number a minute later
		// is not a live counter.
		await vi.waitFor(
			() => {
				expect(client.received.at(-1)?.counts).toEqual(
					expect.objectContaining({ total: BURST, byVoivodeship: { "PL-MZ": BURST } }),
				);
			},
			{ timeout: 2_000 },
		);

		// Fifty rows, nothing like fifty pushes. The exact number depends on how
		// long the burst took to write; what must hold is that the object
		// batched rather than relayed.
		expect(client.received.length).toBeLessThan(BURST / 5);
	});
});

/**
 * Reconciliation, and the failure it answers.
 *
 * A notification is fire-and-forget, which means it can be dropped: the sign
 * path does not wait for it and would not retry it if it did. Without a second
 * path back to D1, one dropped notification leaves every connected reader
 * looking at a number that is quietly, permanently wrong.
 *
 * So the object keeps a heartbeat while anybody is watching. It is slow on
 * purpose — this is a backstop for a rare loss, not the mechanism.
 */
describe("LiveCounter, reconciling with D1", () => {
	function alarmFor(
		counter: DurableObjectStub<import("@/live").LiveCounter>,
	): Promise<number | null> {
		return runInDurableObject(counter, (_instance, state) => state.storage.getAlarm());
	}

	it("keeps a heartbeat scheduled while somebody is watching", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		await client.message(0);

		expect(await alarmFor(counter)).not.toBeNull();
	});

	it("catches up on a signature nobody told it about", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		expect(await client.counts(0)).toEqual({ total: 0, byVoivodeship: {} });

		// The dropped notification: the row is in D1 and the object never heard.
		await storeSignature("anna@example.com", "PL-MZ");

		expect(await runDurableObjectAlarm(counter)).toBe(true);

		expect(await client.counts(1)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
	});

	// The heartbeat costs a D1 read every time it fires, so an object nobody is
	// connected to has to stop paying for it — otherwise every petition page
	// ever opened leaves a query running forever.
	it("stops waking itself once nobody is listening", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		await client.message(0);

		client.close();
		await vi.waitFor(async () => {
			const attached = await runInDurableObject(
				counter,
				(_i, state) => state.getWebSockets().length,
			);
			expect(attached).toBe(0);
		});

		expect(await runDurableObjectAlarm(counter)).toBe(true);

		expect(await alarmFor(counter)).toBeNull();
	});
});

/**
 * The names that travel beside the numbers.
 *
 * The object does not decide who may be named — `readSupporters` does, in the
 * `WHERE` clause that also decides the public list. So the assertion below is
 * about the consequence rather than the mechanism: a signer who declined moves
 * the total and never appears, which is the behaviour the reference site has
 * and the one this deployment wants.
 *
 * What the object *does* decide is how much travels. Every push reaches every
 * open page, including the heartbeat that fires when nothing has happened, so a
 * push with nothing new to say says nothing — and one with a great deal to say
 * still says only a few names' worth of it.
 */
describe("LiveCounter, the names it carries", () => {
	/** A signature from somebody who agreed to be named. */
	async function storePublished(firstName: string, email: string): Promise<void> {
		await env.DB.prepare(
			`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo, consent_public_list, voivodeship_code)
			 VALUES (?, ?, 'Kowalska', ?, 'Warszawa', 'person', 1, 1, 'PL-MZ')`,
		)
			.bind(crypto.randomUUID(), firstName, email)
			.run();
	}

	const named = (update: LiveUpdate): string[] =>
		update.supporters.map((supporter) => supporter.name);

	it("greets a client with the newest names it is allowed to publish", async () => {
		await storePublished("Anna", "anna@example.test");

		const client = await connect(freshCounter());

		expect(named(await client.message(0))).toEqual(["Anna K."]);
	});

	it("pushes a name to everybody watching the moment it is stored", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		expect(named(await client.message(0))).toEqual([]);

		await storePublished("Anna", "anna@example.test");
		await counter.signatureRecorded();

		expect(named(await client.message(1))).toEqual(["Anna K."]);
	});

	// The seam this issue exists at: the counter counts everybody, the list
	// names only those who asked to be named, and the two disagreeing is the
	// intended behaviour rather than a contradiction to be explained away.
	it("counts a signer who declined publication without ever naming them", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		await client.message(0);

		await storePublished("Anna", "anna@example.test");
		await storeSignature("piotr@example.test", "PL-MZ");
		await counter.signatureRecorded();

		const update = await client.message(1);
		expect(update.counts.total).toBe(2);
		expect(named(update)).toEqual(["Anna K."]);
	});

	// The heartbeat fires every thirty seconds while anybody is connected, and
	// it reaches every open page. A quiet petition has to cost what it costs
	// today, which means the names are what is new rather than what exists.
	it("carries no names when nothing has been published since the last push", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		await storePublished("Anna", "anna@example.test");
		await counter.signatureRecorded();
		expect(named(await client.message(1))).toEqual(["Anna K."]);

		// The reconciliation heartbeat, with nothing added between the two.
		expect(await runDurableObjectAlarm(counter)).toBe(true);

		expect(named(await client.message(2))).toEqual([]);
	});

	it("carries at most a bounded number of names however many arrive at once", async () => {
		const counter = freshCounter();
		const client = await connect(counter);
		await client.message(0);

		for (let n = 0; n < LIVE_SUPPORTERS + 4; n += 1) {
			await storePublished(`Signer${n}`, `signer-${n}@example.test`);
		}
		await counter.signatureRecorded();

		expect(named(await client.message(1))).toHaveLength(LIVE_SUPPORTERS);
	});
});

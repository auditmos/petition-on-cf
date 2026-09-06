import {
	env,
	evictDurableObject,
	runDurableObjectAlarm,
	runInDurableObject,
} from "cloudflare:test";
import type { SignatureCounts } from "@/core/signature-counts";
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
 * - **Output on the wire** is `SignatureCounts` as JSON, identical to what
 *   `/api/signatures/snapshot` answers with.
 * - **Boundaries**: a cold object that has never read D1; a burst of
 *   notifications inside one coalescing window; a change nobody notified
 *   about; the last socket closing.
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
	readonly received: SignatureCounts[] = [];

	constructor(private readonly socket: WebSocket) {
		socket.accept();
		socket.addEventListener("message", (event) => {
			this.received.push(JSON.parse(String(event.data)) as SignatureCounts);
		});
	}

	/** The nth push, waited for rather than assumed to have arrived. */
	async message(index: number): Promise<SignatureCounts> {
		await vi.waitFor(() => expect(this.received.length).toBeGreaterThan(index));
		return this.received[index] as SignatureCounts;
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

		expect(await client.message(0)).toEqual({
			total: 3,
			byVoivodeship: { "PL-MZ": 2, "PL-DS": 1 },
		});
	});

	it("greets a client on an empty petition with zero", async () => {
		const client = await connect(freshCounter());

		expect(await client.message(0)).toEqual({ total: 0, byVoivodeship: {} });
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

		expect(await anna.message(1)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
		expect(await jan.message(1)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
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
		expect(await client.message(0)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
	});

	// The other half of the same idea: an object that has been running for a
	// while and has a cached number must still end up at D1's, not at its own
	// plus one.
	it("counts a signature once when it already had a number in hand", async () => {
		const counter = freshCounter();
		await storeSignature("anna@example.com", "PL-MZ");
		const client = await connect(counter);
		expect(await client.message(0)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });

		await storeSignature("jan@example.com", "PL-DS");
		await counter.signatureRecorded();

		expect(await client.message(1)).toEqual({
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
		expect(await client.message(0)).toEqual({ total: 0, byVoivodeship: {} });

		await evictDurableObject(counter);

		await storeSignature("anna@example.com", "PL-MZ");
		await counter.signatureRecorded();

		expect(await client.message(1)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
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
				expect(client.received.at(-1)).toEqual({ total: BURST, byVoivodeship: { "PL-MZ": BURST } });
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
		expect(await client.message(0)).toEqual({ total: 0, byVoivodeship: {} });

		// The dropped notification: the row is in D1 and the object never heard.
		await storeSignature("anna@example.com", "PL-MZ");

		expect(await runDurableObjectAlarm(counter)).toBe(true);

		expect(await client.message(1)).toEqual({ total: 1, byVoivodeship: { "PL-MZ": 1 } });
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

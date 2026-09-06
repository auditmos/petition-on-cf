import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import type { SignatureCounts } from "@/core/signature-counts";
import { resetDatabase } from "@/db/test-support";
import { apiHono } from "@/hono/api";
import { LIVE_COUNTER_NAME } from "@/live";

/**
 * The page's way in to the live counter.
 *
 * One deployment is one petition, so every visitor has to land on the same
 * object — a per-visitor counter would be a counter of nothing. That is what
 * these tests are for; the object's own behaviour lives in
 * `src/live/live-counter.worker.test.ts`.
 */
beforeEach(resetDatabase);

async function request(headers: HeadersInit = {}): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await apiHono.fetch(
		new Request("https://example.com/api/live", { headers }),
		env,
		ctx,
	);
	await waitOnExecutionContext(ctx);
	return response;
}

/** The socket a browser would end up holding, and its first push. */
async function connect(): Promise<{ socket: WebSocket; first: Promise<SignatureCounts> }> {
	const response = await request({ Upgrade: "websocket" });
	expect(response.status).toBe(101);

	const socket = response.webSocket;
	if (!socket) throw new Error("upgrade produced no socket");
	socket.accept();

	const first = new Promise<SignatureCounts>((resolve) => {
		socket.addEventListener(
			"message",
			(event) => resolve(JSON.parse(String(event.data)) as SignatureCounts),
			{ once: true },
		);
	});

	return { socket, first };
}

async function storeSignature(email: string): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo, voivodeship_code)
		 VALUES (?, 'Anna', 'Kowalska', ?, 'Warszawa', 'person', 1, 'PL-MZ')`,
	)
		.bind(crypto.randomUUID(), email)
		.run();
}

describe("GET /api/live", () => {
	it("upgrades to a socket carrying the petition's counts", async () => {
		await storeSignature("anna@example.com");
		await storeSignature("jan@example.com");

		const { first } = await connect();

		expect(await first).toEqual({ total: 2, byVoivodeship: { "PL-MZ": 2 } });
	});

	// Two readers on one petition are two sockets on one object. If the routing
	// picked an id per request instead, both of these would still connect and
	// both would still see the right number — and neither would ever see the
	// other's signature arrive.
	it("puts every visitor on the same counter", async () => {
		const anna = await connect();
		const jan = await connect();
		await Promise.all([anna.first, jan.first]);

		const bothSaw = Promise.all([nextMessage(anna.socket), nextMessage(jan.socket)]);

		await storeSignature("ewa@example.com");
		await notifyCounter();

		expect(await bothSaw).toEqual([
			{ total: 1, byVoivodeship: { "PL-MZ": 1 } },
			{ total: 1, byVoivodeship: { "PL-MZ": 1 } },
		]);
	});

	// A browser that asks for the page rather than for the protocol gets told
	// so. The number it wanted is at /api/signatures/snapshot.
	it("refuses a request that is not an upgrade", async () => {
		expect((await request()).status).toBe(426);
	});
});

/** The next push on an already-open socket. */
function nextMessage(socket: WebSocket): Promise<SignatureCounts> {
	return new Promise((resolve) => {
		socket.addEventListener(
			"message",
			(event) => resolve(JSON.parse(String(event.data)) as SignatureCounts),
			{ once: true },
		);
	});
}

/** What the sign path fires, reached the same way the sign path reaches it. */
async function notifyCounter(): Promise<void> {
	await env.LIVE_COUNTER.get(env.LIVE_COUNTER.idFromName(LIVE_COUNTER_NAME)).signatureRecorded();
}

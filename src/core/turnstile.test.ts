import { verifyTurnstile } from "./turnstile";

/**
 * The module's contract with Cloudflare, which the endpoint's tests cannot
 * see: they observe a verdict, this observes the request that produced it.
 *
 * ## Assumptions this file encodes
 *
 * - **Input**: a secret and a token, both non-empty strings by the time they
 *   get here; an IP that may legitimately be absent.
 * - **Output**: `true` only when Cloudflare answers `success: true`. Every
 *   other answer is a `false`, and a *failed request* is neither — it throws.
 * - **Boundary**: `fetch` is the system boundary and the only thing stubbed.
 *   Nothing here reaches the network.
 */
type FetchStub = ReturnType<typeof vi.fn>;

function stubFetch(body: unknown): FetchStub {
	const stub = vi.fn(async () => Response.json(body));
	vi.stubGlobal("fetch", stub);
	return stub;
}

/** The form Cloudflare was actually sent, decoded back into pairs. */
async function sentForm(stub: FetchStub): Promise<Record<string, string>> {
	const [, init] = stub.mock.calls[0] as unknown as [string, RequestInit];
	return Object.fromEntries(new URLSearchParams(String(init.body)));
}

function sentUrl(stub: FetchStub): string {
	const [url] = stub.mock.calls[0] as unknown as [string];
	return String(url);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

const CHALLENGE = { secret: "a-secret", token: "a-token" } as const;

describe("verifyTurnstile", () => {
	it("spends the token against Cloudflare's siteverify", async () => {
		const stub = stubFetch({ success: true });

		await verifyTurnstile(CHALLENGE);

		expect(sentUrl(stub)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
		expect(await sentForm(stub)).toEqual({ secret: "a-secret", response: "a-token" });
	});

	// Corroborating evidence, not a requirement — so it is sent when the
	// platform reported one and left out entirely when it did not, rather than
	// being sent as an empty string that siteverify would have to interpret.
	it("passes the signer's IP when one is known", async () => {
		const stub = stubFetch({ success: true });

		await verifyTurnstile({ ...CHALLENGE, ip: "203.0.113.7" });

		expect(await sentForm(stub)).toMatchObject({ remoteip: "203.0.113.7" });
	});

	it("sends no remoteip when the request carried no client IP", async () => {
		const stub = stubFetch({ success: true });

		await verifyTurnstile({ ...CHALLENGE, ip: undefined });

		expect(await sentForm(stub)).not.toHaveProperty("remoteip");
	});

	it("vouches for a token Cloudflare approves", async () => {
		stubFetch({ success: true });

		expect(await verifyTurnstile(CHALLENGE)).toBe(true);
	});

	it("refuses a token Cloudflare rejects", async () => {
		stubFetch({ success: false, "error-codes": ["invalid-input-response"] });

		expect(await verifyTurnstile(CHALLENGE)).toBe(false);
	});

	// An error payload carries no `success` at all. A truthy check would read
	// that as a pass the day Cloudflare adds a field.
	it("refuses an answer that carries no verdict", async () => {
		stubFetch({ "error-codes": ["internal-error"] });

		expect(await verifyTurnstile(CHALLENGE)).toBe(false);
	});

	// The reason the check is `=== true` rather than truthy, pinned: every
	// non-empty string is truthy, and `"false"` is a string.
	it("refuses a verdict that is not literally true", async () => {
		stubFetch({ success: "false" });

		expect(await verifyTurnstile(CHALLENGE)).toBe(false);
	});

	/**
	 * The deliberate non-catch. An unreachable siteverify is not evidence that
	 * a robot is signing, so it must not come back as `false` — it propagates,
	 * becomes a 500, and the form tells the signer to try again in a moment.
	 */
	it("lets an unreachable siteverify throw instead of calling the signer a robot", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("network error");
			}),
		);

		await expect(verifyTurnstile(CHALLENGE)).rejects.toThrow(TypeError);
	});
});

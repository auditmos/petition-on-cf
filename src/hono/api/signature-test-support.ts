import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { apiHono } from "@/hono/api";

/**
 * What the sign-path worker tests share: a valid submission, the one boundary
 * they stand in for, and the two ways they talk to the endpoint.
 *
 * Nothing here asserts. Reading rows straight out of D1 rather than through the
 * writer is deliberate — an assertion that ran through the code under test
 * would agree with it about a bug.
 */
export const VALID = {
	firstName: "Anna",
	surname: "Kowalska",
	email: "anna@example.com",
	city: "Warszawa",
	consentRodo: true,
	turnstileToken: "a-token-the-widget-produced",
} as const;

/**
 * Stands in for Cloudflare's siteverify, the one thing here that would
 * otherwise be a network call. Returning the verdict rather than the whole
 * response body is what keeps a test about rejection from also being about
 * Turnstile's JSON shape — `src/core/turnstile.test.ts` owns that.
 */
export function stubSiteverify(success: boolean): ReturnType<typeof vi.fn> {
	const stub = vi.fn(async () => Response.json({ success }));
	vi.stubGlobal("fetch", stub);
	return stub;
}

/**
 * Every request comes from its own address unless the test names one.
 *
 * The rate limiter's counters are keyed on the client IP and outlive a single
 * test the way a real minute does. Without this, requests that have nothing to
 * do with rate limiting would share one bucket and start failing — a test
 * breaking because of what an unrelated test did before it. Only a rate-limit
 * test names an address, and that is exactly where sharing one is the point.
 */
let clientIpCounter = 0;

function freshClientIp(): string {
	clientIpCounter += 1;
	return `192.0.2.${clientIpCounter}`;
}

/** What Cloudflare's edge would have said about where the request came from. */
export type Geo = { country?: string; regionCode?: string };

export async function sign(
	body: unknown,
	clientIp?: string,
	geo?: Geo,
	bindings: typeof env = env,
): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await apiHono.fetch(
		new Request("https://example.com/api/signatures", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"cf-connecting-ip": clientIp ?? freshClientIp(),
			},
			body: JSON.stringify(body),
			...(geo ? { cf: geo } : {}),
		}),
		bindings,
		ctx,
	);
	await waitOnExecutionContext(ctx);
	return response;
}

/** A signature from a signer who has not signed before, for burst tests. */
export function nthSigner(n: number): Record<string, unknown> {
	return { ...VALID, email: `signer-${n}@example.com` };
}

/** Read straight from D1, so the assertion never runs through the writer. */
export async function storedRows(): Promise<Record<string, unknown>[]> {
	const { results } = await env.DB.prepare("SELECT * FROM signatures ORDER BY email").all();
	return results;
}

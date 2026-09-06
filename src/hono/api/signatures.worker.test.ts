import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { resetDatabase } from "@/db/test-support";
import { apiHono } from "@/hono/api";

/**
 * The sign path, exercised the way a browser exercises it: a real HTTP request
 * into the Worker's router, the shipped migration applied to a real D1, and the
 * row read back with SQL rather than through the code under test.
 *
 * ## Assumptions this file encodes
 *
 * - **Input**: `firstName`, `surname` and `city` are non-empty after trimming;
 *   `email` is normalised to trimmed lowercase before it reaches the unique
 *   index; `postalCode` is optional and stores null when omitted or blank;
 *   `consentRodo` must be literally true.
 * - **Output**: 201 for a stored signature, 409 for one whose e-mail already
 *   signed, 400 with field-level details for anything invalid.
 * - **Dedup is the unique index's decision**, not a lookup's — so a duplicate
 *   is observed as a failed insert, never as a row that was found first.
 * - **Turnstile is a system boundary**, so siteverify is stubbed rather than
 *   called: these tests are about what the endpoint does with the answer, not
 *   about Cloudflare's service being up.
 * - **Not covered here**: the signer-type toggle and live updates. Later
 *   slices own those.
 */
beforeEach(resetDatabase);

const VALID = {
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
function stubSiteverify(success: boolean): ReturnType<typeof vi.fn> {
	const stub = vi.fn(async () => Response.json({ success }));
	vi.stubGlobal("fetch", stub);
	return stub;
}

beforeEach(() => stubSiteverify(true));

afterEach(() => {
	vi.unstubAllGlobals();
});

/**
 * Every request comes from its own address unless the test names one.
 *
 * The rate limiter's counters are keyed on the client IP and outlive a single
 * test the way a real minute does. Without this, the twenty-odd requests in
 * this file that have nothing to do with rate limiting would share one bucket
 * and the sixth of them would start failing — a test breaking because of what
 * an unrelated test did before it. Only the rate-limit block names an address,
 * and that is exactly where sharing one is the point.
 */
let clientIpCounter = 0;

function freshClientIp(): string {
	clientIpCounter += 1;
	return `192.0.2.${clientIpCounter}`;
}

/** What Cloudflare's edge would have said about where the request came from. */
type Geo = { country?: string; regionCode?: string };

async function sign(body: unknown, clientIp?: string, geo?: Geo): Promise<Response> {
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
		env,
		ctx,
	);
	await waitOnExecutionContext(ctx);
	return response;
}

/** A signature from a signer who has not signed before, for burst tests. */
function nthSigner(n: number): Record<string, unknown> {
	return { ...VALID, email: `signer-${n}@example.com` };
}

/** Read straight from D1, so the assertion never runs through the writer. */
async function storedRows(): Promise<Record<string, unknown>[]> {
	const { results } = await env.DB.prepare("SELECT * FROM signatures ORDER BY email").all();
	return results;
}

describe("POST /api/signatures", () => {
	it("stores a valid signature and reports it as created", async () => {
		const response = await sign(VALID);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ data: { status: "created" } });

		expect(await storedRows()).toEqual([
			expect.objectContaining({
				first_name: "Anna",
				surname: "Kowalska",
				email: "anna@example.com",
				city: "Warszawa",
				consent_rodo: 1,
			}),
		]);
	});

	it("tells a returning signer they already signed, and stores nothing new", async () => {
		await sign(VALID);

		const response = await sign({ ...VALID, city: "Kraków" });

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual(
			expect.objectContaining({ code: "CONFLICT", error: expect.any(String) }),
		);
		expect(await storedRows()).toHaveLength(1);
	});

	// The normalisation is only worth having if it reaches the index, so the
	// duplicate is submitted in a form the raw string comparison would miss.
	it("treats a differently-cased e-mail as the same signer", async () => {
		await sign(VALID);

		const response = await sign({ ...VALID, email: "  Anna@Example.COM  " });

		expect(response.status).toBe(409);
		expect(await storedRows()).toHaveLength(1);
	});
});

/**
 * The first gate. A signature that cannot show a Turnstile token never reaches
 * validation's verdict, the rate limiter or the database — so the assertion is
 * always two-part: the status the caller sees, and the row that is not there.
 */
describe("POST /api/signatures, bot check", () => {
	it("refuses a submission carrying no Turnstile token", async () => {
		const response = await sign({ ...VALID, turnstileToken: undefined });

		expect(response.status).toBe(403);
		expect(await storedRows()).toEqual([]);
	});

	// A token that is present is not a token that is good. Only Cloudflare can
	// tell the difference, so the endpoint has to have asked.
	it("refuses a token siteverify does not approve", async () => {
		stubSiteverify(false);

		const response = await sign(VALID);

		expect(response.status).toBe(403);
		expect(await storedRows()).toEqual([]);
	});

	it("stores the signature once siteverify approves the token", async () => {
		const siteverify = stubSiteverify(true);

		const response = await sign(VALID);

		expect(response.status).toBe(201);
		expect(siteverify).toHaveBeenCalledTimes(1);
		expect(await storedRows()).toHaveLength(1);
	});
});

/**
 * The second gate, and the one that costs an honest signer nothing: a person
 * signs once, so the ceiling only binds on a machine submitting in a loop.
 *
 * Each test picks its own client IP, because the limiter's counters outlive a
 * single test the way a real minute does — sharing an address between two
 * tests would make one of them depend on the other having run.
 */
describe("POST /api/signatures, rate limit", () => {
	it("lets a burst up to the ceiling through and refuses the one after it", async () => {
		const statuses: number[] = [];

		for (let attempt = 0; attempt < 6; attempt++) {
			const response = await sign(nthSigner(attempt), "203.0.113.10");
			statuses.push(response.status);
		}

		expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
		expect(await storedRows()).toHaveLength(5);
	});

	// The ceiling is per address, not per deployment — otherwise one loop would
	// stop the whole petition from collecting anything.
	it("counts each address separately", async () => {
		for (let attempt = 0; attempt < 5; attempt++) {
			await sign(nthSigner(attempt), "203.0.113.20");
		}

		const other = await sign(nthSigner(99), "203.0.113.21");

		expect(other.status).toBe(201);
	});
});

/**
 * Region attribution, which happens at insert time and is never revisited.
 *
 * The order is postal code, then geo-IP, then an explicit unknown bucket — and
 * the first of those wins outright, because a self-reported postal code says
 * where the signer lives while geo-IP says where their carrier egresses.
 */
describe("POST /api/signatures, voivodeship", () => {
	/** The stored attribution, read back with SQL rather than through the writer. */
	async function storedVoivodeship(): Promise<unknown> {
		const [row] = await storedRows();
		return row?.voivodeship_code;
	}

	it("lets a supplied postal code decide, even against a conflicting geo-IP", async () => {
		await sign({ ...VALID, postalCode: "50-001" }, undefined, {
			country: "PL",
			regionCode: "MZ",
		});

		expect(await storedVoivodeship()).toBe("PL-DS");
	});

	it("falls back to the geo-IP region when no postal code was given", async () => {
		await sign(VALID, undefined, { country: "PL", regionCode: "MZ" });

		expect(await storedVoivodeship()).toBe("PL-MZ");
	});

	it("stores the unknown bucket when neither signal is available", async () => {
		await sign(VALID);

		expect(await storedVoivodeship()).toBe("unknown");
	});

	// Subdivision codes are unique only within a country: Lucerne is `CH-LU`
	// and lubelskie is `PL-LU`. A signer in Switzerland must not be filed into
	// a Polish voivodeship on a two-letter coincidence.
	it("ignores a region reported from outside Poland", async () => {
		await sign(VALID, undefined, { country: "CH", regionCode: "LU" });

		expect(await storedVoivodeship()).toBe("unknown");
	});
});

/**
 * The postal code is the region signal the trust pipeline will prefer over
 * geo-IP, but a signature without one is valid — so the only thing that can be
 * wrong is a code that was supplied and is not a code.
 */
describe("POST /api/signatures, postal code", () => {
	it("stores null when none is given", async () => {
		await sign(VALID);

		expect(await storedRows()).toEqual([expect.objectContaining({ postal_code: null })]);
	});

	it("stores null when the field arrives empty from an untouched input", async () => {
		await sign({ ...VALID, postalCode: "" });

		expect(await storedRows()).toEqual([expect.objectContaining({ postal_code: null })]);
	});

	it("stores a well-formed code", async () => {
		await sign({ ...VALID, postalCode: "00-950" });

		expect(await storedRows()).toEqual([expect.objectContaining({ postal_code: "00-950" })]);
	});
});

describe("POST /api/signatures, rejected", () => {
	/** Each case names the one field it breaks, which is what the form needs back. */
	const INVALID = [
		["a missing surname", { ...VALID, surname: undefined }, "surname"],
		["a blank first name", { ...VALID, firstName: "   " }, "firstName"],
		["an e-mail that is not one", { ...VALID, email: "anna(at)example.com" }, "email"],
		["a blank city", { ...VALID, city: "" }, "city"],
		["an unticked mandatory consent", { ...VALID, consentRodo: false }, "consentRodo"],
	] as const;

	it.each(INVALID)("rejects %s and says which field", async (_label, body, field) => {
		const response = await sign(body);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: expect.any(String),
			details: expect.arrayContaining([{ field, message: expect.any(String) }]),
		});
	});

	it.each([
		"00",
		"00-0000",
		"0-000",
		"kod pocztowy",
		"12 345",
	])("rejects %s as a postal code", async (postalCode) => {
		const response = await sign({ ...VALID, postalCode });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual(
			expect.objectContaining({
				details: expect.arrayContaining([{ field: "postalCode", message: expect.any(String) }]),
			}),
		);
	});

	it("stores nothing when the payload is rejected", async () => {
		await sign({ ...VALID, consentRodo: false });

		expect(await storedRows()).toEqual([]);
	});
});

/**
 * The number the page reads back. It is a separate endpoint from the write on
 * purpose: the live-counter slice makes this the polling fallback, so its shape
 * has to hold per-voivodeship counts eventually and its cost has to stay a
 * count query rather than a page of rows.
 */
describe("GET /api/signatures/snapshot", () => {
	async function snapshot(): Promise<{ total: number }> {
		const ctx = createExecutionContext();
		const response = await apiHono.fetch(
			new Request("https://example.com/api/signatures/snapshot"),
			env,
			ctx,
		);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { data: { total: number } };
		return body.data;
	}

	it("reports zero on a freshly migrated database", async () => {
		expect(await snapshot()).toEqual({ total: 0 });
	});

	it("reports the number of rows D1 actually holds", async () => {
		await sign(VALID);
		await sign({ ...VALID, email: "jan@example.com" });

		expect(await snapshot()).toEqual({ total: 2 });
	});
});

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
 * - **Not covered here**: Turnstile, rate limiting, geo attribution, the
 *   signer-type toggle and live updates. Later slices own those.
 */
beforeEach(resetDatabase);

const VALID = {
	firstName: "Anna",
	surname: "Kowalska",
	email: "anna@example.com",
	city: "Warszawa",
	consentRodo: true,
} as const;

async function sign(body: unknown): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await apiHono.fetch(
		new Request("https://example.com/api/signatures", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
		env,
		ctx,
	);
	await waitOnExecutionContext(ctx);
	return response;
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

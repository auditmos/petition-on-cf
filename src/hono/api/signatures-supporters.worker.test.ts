import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import type { Supporter, SupporterPage } from "@/core/supporters";
import { resetDatabase } from "@/db/test-support";
import { apiHono } from "@/hono/api";
import { sign, stubSiteverify, VALID } from "./signature-test-support";

/**
 * The read side of the petition, exercised over HTTP the way the page reads
 * it.
 *
 * ## Assumptions this file encodes
 *
 * - **Input**: no parameters at all is the first page; `?cursor=` carries a
 *   cursor this endpoint issued, and nothing else is accepted.
 * - **Output**: `{ data: { supporters: [{ id, name, city }], nextCursor } }`.
 *   `city` is null for a non-personal signer; `nextCursor` is null on the last
 *   page.
 * - **The rows are created through the sign endpoint**, not by SQL. What this
 *   file is about is which stored signatures become public and in what form,
 *   so the rows have to be the ones the real pipeline writes. The last
 *   describe below is the deliberate exception, and says why.
 * - **Nothing here is authenticated**, because nothing here is private: every
 *   row it can return belongs to somebody who asked to be listed.
 * - **Not covered here**: how the section renders a page, and how it asks for
 *   the next one. `supporters-section.test.tsx` owns both.
 */
beforeEach(resetDatabase);
beforeEach(() => stubSiteverify(true));

afterEach(() => {
	vi.unstubAllGlobals();
});

async function supporters(query = ""): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await apiHono.fetch(
		new Request(`https://example.com/api/signatures/supporters${query}`),
		env,
		ctx,
	);
	await waitOnExecutionContext(ctx);
	return response;
}

/**
 * The criterion this endpoint exists to satisfy, asserted against the bytes
 * rather than against a parsed object: a field cannot leak out of a response
 * it is not in, and a substring search over the whole body is the only check
 * that stays true when the shape grows a key nobody thought about.
 */
describe("GET /api/signatures/supporters, what it does not say", () => {
	it("returns no e-mail, no full surname and no consent flag", async () => {
		await sign({ ...VALID, consentPublicList: true });

		const body = await (await supporters()).text();

		expect(body).not.toContain("anna@example.com");
		expect(body).not.toContain("Kowalska");
		expect(body).not.toContain("consent");
		expect(body).toContain("Anna K.");
	});
});

/** Every page, followed to the end the way the section's button follows it. */
async function walk(): Promise<{ entries: Supporter[]; pages: number }> {
	const entries: Supporter[] = [];
	let query = "";
	let pages = 0;

	do {
		const body = (await (await supporters(query)).json()) as { data: SupporterPage };
		entries.push(...body.data.supporters);
		query = body.data.nextCursor ? `?cursor=${encodeURIComponent(body.data.nextCursor)}` : "";
		pages += 1;
	} while (query !== "" && pages < 10);

	return { entries, pages };
}

/** Signs `count` times, each from a fresh address, each agreeing to be listed. */
async function signConsenting(count: number): Promise<void> {
	for (let n = 0; n < count; n += 1) {
		await sign({
			...VALID,
			email: `signer-${n}@example.test`,
			firstName: "Anna",
			surname: "Kowalska",
			consentPublicList: true,
		});
	}
}

describe("GET /api/signatures/supporters", () => {
	// Both halves of the criterion at once, because they are one property: the
	// decliner is absent from *every* page, which is only checkable by walking
	// to the end — and the walk is what shows nobody was counted twice on the
	// way.
	it("lists every consenting signer once and no page ever names a decliner", async () => {
		await signConsenting(26);
		await sign({
			...VALID,
			email: "bogdan@example.test",
			firstName: "Bogdan",
			surname: "Niechętny",
			consentPublicList: false,
		});

		const { entries, pages } = await walk();

		expect(pages).toBeGreaterThan(1);
		expect(entries).toHaveLength(26);
		expect(new Set(entries.map((entry) => entry.id)).size).toBe(26);
		expect(entries.map((entry) => entry.name)).not.toContain("Bogdan N.");
	});

	// The shape stated positively, beside the substring search above. One says
	// the response carries nothing it should not; this says it carries nothing
	// at all beyond these three.
	it("gives each supporter an id, a published name and a city, and nothing else", async () => {
		await sign({ ...VALID, consentPublicList: true });

		const body = (await (await supporters()).json()) as { data: SupporterPage };

		expect(body.data.supporters.map((entry) => Object.keys(entry).sort())).toEqual([
			["city", "id", "name"],
		]);
		expect(body.data.nextCursor).toBeNull();
	});

	it("says so plainly when nobody has consented yet", async () => {
		await sign({ ...VALID, consentPublicList: false });

		const body = (await (await supporters()).json()) as { data: SupporterPage };

		expect(body.data).toEqual({ supporters: [], nextCursor: null });
	});

	// A cursor nobody's browser produced. Answering it with the first page
	// would look, to whatever asked, like its pagination had silently restarted.
	it("refuses a cursor it did not issue", async () => {
		const response = await supporters("?cursor=not-a-cursor");

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual(
			expect.objectContaining({ code: "VALIDATION", field: "cursor" }),
		);
	});
});

/**
 * The one place a row is written by SQL rather than by signing, and the reason
 * is the bug it caught.
 *
 * Every test above creates rows through the endpoint, so every id in them is a
 * UUID the application generated — and the cursor's shape check was written to
 * match one. `id` is a `TEXT` column: `pnpm db:seed:dev` writes readable ids
 * and an organizer inserting a row by hand writes whatever they like. The
 * endpoint was refusing, with 400, the cursor it had issued a moment earlier
 * over such a row. Pagination passed every test and broke on the first real
 * page of the development database.
 */
describe("GET /api/signatures/supporters, ids the application did not generate", () => {
	it("accepts back the cursor it issued over a hand-written id", async () => {
		for (let n = 0; n < 26; n += 1) {
			await env.DB.prepare(
				`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo, consent_public_list, created_at)
				 VALUES (?, 'Anna', 'Kowalska', ?, 'Warszawa', 'person', 1, 1, ?)`,
			)
				.bind(`seed-PL-MZ-${n}`, `seed-${n}@example.test`, 1788699726 - n)
				.run();
		}

		const { entries, pages } = await walk();

		expect(pages).toBe(2);
		expect(entries).toHaveLength(26);
	});
});

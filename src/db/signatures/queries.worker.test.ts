import { env } from "cloudflare:test";
import { readSignatureCounts } from "@/db/signatures";
import { resetDatabase } from "@/db/test-support";

/**
 * The migration under test is the one Wrangler applies to a real D1 — read off
 * disk by `readD1Migrations` in vitest.config.ts, not restated here. So a
 * schema change that never made it into a migration fails on the first query
 * rather than on the first deploy.
 */
beforeEach(resetDatabase);

/**
 * The petition's only entity, inserted the way the schema says it stores.
 *
 * `voivodeshipCode` is deliberately optional and deliberately allowed to be
 * null: the column is nullable, and every row written before the trust
 * pipeline (#6) started attributing regions carries a null in it. Those rows
 * still have to be counted somewhere.
 */
async function insertSignature(email: string, voivodeshipCode?: string): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo, voivodeship_code)
		 VALUES (?, ?, ?, ?, ?, 'person', 1, ?)`,
	)
		.bind(crypto.randomUUID(), "Anna", "Kowalska", email, "Warszawa", voivodeshipCode ?? null)
		.run();
}

describe("readSignatureCounts", () => {
	it("counts nothing on a freshly migrated database", async () => {
		expect(await readSignatureCounts(env.DB)).toEqual({ total: 0, byVoivodeship: {} });
	});

	it("counts every stored signature", async () => {
		await insertSignature("anna@example.com", "PL-MZ");
		await insertSignature("jan@example.com", "PL-MZ");
		await insertSignature("ewa@example.com", "PL-DS");

		expect(await readSignatureCounts(env.DB)).toEqual({
			total: 3,
			byVoivodeship: { "PL-MZ": 2, "PL-DS": 1 },
		});
	});

	// The map (#8) needs these split by region, and it needs the split to add
	// up: a total that disagrees with the sum of its parts is a map with a
	// number beside it that nobody can reconcile.
	it("splits the total into per-voivodeship counts that sum to it", async () => {
		await insertSignature("anna@example.com", "PL-PM");
		await insertSignature("jan@example.com", "PL-PM");
		await insertSignature("ewa@example.com", "PL-SL");
		await insertSignature("olga@example.com", "unknown");

		const counts = await readSignatureCounts(env.DB);
		const summed = Object.values(counts.byVoivodeship).reduce((sum, n) => sum + n, 0);

		expect(summed).toBe(counts.total);
	});

	// Attribution writes the string `unknown` rather than a null, but rows
	// stored before it existed have nulls in that column — and a signature is a
	// signature whether or not anything could place it on a map.
	it("files signatures stored before region attribution under the unknown bucket", async () => {
		await insertSignature("anna@example.com");
		await insertSignature("jan@example.com", "unknown");
		await insertSignature("ewa@example.com", "PL-WP");

		expect(await readSignatureCounts(env.DB)).toEqual({
			total: 3,
			byVoivodeship: { unknown: 2, "PL-WP": 1 },
		});
	});

	// The dedup key issue #4 will build on. What ships in *this* slice is the
	// constraint that makes dedup enforceable at all — #4 owns the answer a
	// duplicate submission gets back.
	it("refuses a second signature with the same e-mail", async () => {
		await insertSignature("anna@example.com");

		await expect(insertSignature("anna@example.com")).rejects.toThrow(
			/UNIQUE constraint failed: signatures\.email/i,
		);
		expect(await readSignatureCounts(env.DB)).toEqual(expect.objectContaining({ total: 1 }));
	});

	it("carries a unique index on e-mail into the migrated database", async () => {
		const indexes = await env.DB.prepare(
			"SELECT name, \"unique\" FROM pragma_index_list('signatures')",
		).all<{ name: string; unique: number }>();

		const columns = await env.DB.prepare(
			"SELECT name FROM pragma_index_info('signatures_email_unique')",
		).all<{ name: string }>();

		expect(indexes.results).toContainEqual({ name: "signatures_email_unique", unique: 1 });
		expect(columns.results.map((c) => c.name)).toEqual(["email"]);
	});
});

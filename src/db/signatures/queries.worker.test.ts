import { env } from "cloudflare:test";
import { countSignatures } from "@/db/signatures";
import { resetDatabase } from "@/db/test-support";

/**
 * The migration under test is the one Wrangler applies to a real D1 — read off
 * disk by `readD1Migrations` in vitest.config.ts, not restated here. So a
 * schema change that never made it into a migration fails on the first query
 * rather than on the first deploy.
 */
beforeEach(resetDatabase);

/** The petition's only entity, inserted the way the schema says it stores. */
async function insertSignature(email: string): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo)
		 VALUES (?, ?, ?, ?, ?, 'person', 1)`,
	)
		.bind(crypto.randomUUID(), "Anna", "Kowalska", email, "Warszawa")
		.run();
}

describe("countSignatures", () => {
	it("counts nothing on a freshly migrated database", async () => {
		expect(await countSignatures(env.DB)).toBe(0);
	});

	it("counts every stored signature", async () => {
		await insertSignature("anna@example.com");
		await insertSignature("jan@example.com");
		await insertSignature("ewa@example.com");

		expect(await countSignatures(env.DB)).toBe(3);
	});

	// The dedup key issue #4 will build on. What ships in *this* slice is the
	// constraint that makes dedup enforceable at all — #4 owns the answer a
	// duplicate submission gets back.
	it("refuses a second signature with the same e-mail", async () => {
		await insertSignature("anna@example.com");

		await expect(insertSignature("anna@example.com")).rejects.toThrow(
			/UNIQUE constraint failed: signatures\.email/i,
		);
		expect(await countSignatures(env.DB)).toBe(1);
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

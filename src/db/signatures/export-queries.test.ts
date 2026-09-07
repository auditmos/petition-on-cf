import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableColumns } from "drizzle-orm";
import { signatures } from "./table";

const README = readFileSync(resolve(__dirname, "..", "..", "..", "README.md"), "utf8");

/**
 * The organizer's way in, which is documentation rather than code.
 *
 * This template has no admin UI and no export endpoint by design, so the two
 * `wrangler d1` queries in the README are the whole of how a campaign reaches
 * its own signatures. That makes them part of the product: a documented column
 * that the table stopped having is a broken feature, and it breaks silently,
 * in a shell, months after the rename that caused it.
 *
 * ## Assumptions this file encodes
 *
 * - **The README is the source**, not a copy of constants kept here. A query
 *   restated in TypeScript would be the one that is tested and not the one
 *   that is run.
 * - **Every identifier a query names is a column the table has.** Anything
 *   else is either a typo or a rename nobody carried into the docs.
 * - **The documented columns are the columns the query returns**, in order —
 *   that list is what somebody builds a mail merge against.
 * - **Not covered here**: that the queries execute. They are run against the
 *   seeded local D1 by hand, which is what the issue asks for; a test would
 *   have to stand up Wrangler to say the same thing more slowly.
 */

/** SQL vocabulary, so what is left over is a column name or a mistake. */
const SQL_WORDS = new Set([
	"select",
	"from",
	"where",
	"order",
	"by",
	"as",
	"and",
	"datetime",
	"unixepoch",
	"signatures",
	"asc",
	"desc",
]);

type Query = { sql: string; columns: string[] };

/**
 * The `--command "…"` of every `wrangler d1 execute` the export section shows.
 *
 * Anchored to the section rather than to the whole file so the quick start's
 * `SELECT count(*)` example does not turn up here as a third export query.
 */
function exportQueries(): Query[] {
	const section = README.split("## Getting the signatures out")[1]?.split("\n## ")[0] ?? "";
	return [...section.matchAll(/--command "([^"]+)"/g)].map((match) => {
		const sql = match[1] ?? "";
		return { sql, columns: outputColumns(sql) };
	});
}

/** What a reader gets back, named as the query names it, in order. */
function outputColumns(sql: string): string[] {
	const list = /select (.+?) from /i.exec(sql)?.[1] ?? "";
	const items: string[] = [];
	let depth = 0;
	let current = "";
	for (const character of list) {
		if (character === "(") depth += 1;
		if (character === ")") depth -= 1;
		if (character === "," && depth === 0) {
			items.push(current);
			current = "";
			continue;
		}
		current += character;
	}
	items.push(current);
	return items.map((item) => {
		const trimmed = item.trim();
		return / as /i.test(trimmed) ? trimmed.split(/ as /i)[1]?.trim() || trimmed : trimmed;
	});
}

/**
 * The columns a documentation table lists, in the order it lists them.
 *
 * Bounded by the next heading of any level, not just the next `##` — the two
 * export subsections are siblings, and a query documented up to the end of the
 * chapter would inherit the other one's columns.
 */
function documentedColumns(heading: string): string[] {
	const table = README.split(heading)[1]?.split(/\n#{2,4} /)[0] ?? "";
	return [...table.matchAll(/^\| `([a-z_]+)` \|/gm)].map((match) => match[1] ?? "");
}

describe("the README's export queries", () => {
	const queries = exportQueries();
	const columns = Object.values(getTableColumns(signatures)).map((column) => column.name);

	it("documents two of them — the full export and the updates list", () => {
		expect(queries).toHaveLength(2);
	});

	it.each(
		queries.map((query, index) => [index, query] as const),
	)("names only real columns of the signatures table in query %i", (_index, query) => {
		const identifiers = [...query.sql.toLowerCase().matchAll(/\b[a-z][a-z_]*\b/g)].map(
			(match) => match[0],
		);
		const unknown = identifiers.filter(
			(word) => !SQL_WORDS.has(word) && !columns.includes(word) && !query.columns.includes(word),
		);

		expect([...new Set(unknown)]).toEqual([]);
	});

	it("returns every column of a signature in the full export", () => {
		const [full] = queries;

		// `created_at` is the one column renamed on the way out, to a readable
		// timestamp rather than the Unix seconds the row stores.
		expect(full?.columns).toEqual([...columns.filter((c) => c !== "created_at"), "signed_at"]);
	});

	it("returns what the updates list is for — an address and a name", () => {
		expect(queries[1]?.columns).toEqual(["email", "first_name", "surname"]);
	});

	it.each([
		["#### Full signature export", 0],
		["#### Supporters who asked for updates", 1],
	])("documents the columns %s actually returns", (heading, index) => {
		expect(documentedColumns(heading)).toEqual(queries[index]?.columns);
	});

	// The list exists because somebody ticked a box saying they wanted it.
	it("filters the updates list by the consent that created it", () => {
		expect(queries[1]?.sql).toContain("consent_updates = 1");
	});
});

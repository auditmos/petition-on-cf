import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");

function stripJsonc(raw: string): string {
	return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

/**
 * Every fenced `jsonc` block in the README, parsed.
 *
 * These guards used to hang off specific headings — `### wrangler.jsonc`,
 * `#### Migration directories` — and died with them when the README was
 * repositioned around the petition template and sent base-stack documentation
 * to the upstream repository. A guard anchored to a heading only survives as
 * long as the heading does, and when it dies it takes its file's other
 * invariants with it: the throw below used to happen at module scope, which
 * collected zero tests and hid the licence and compat-date checks entirely.
 *
 * So the invariant is written against the *claim* instead. The README makes no
 * configuration claims today, and these tests pass over an empty set — the
 * honest state, not a skipped one. They start biting again by themselves when
 * issue #13 grows this README its own quick start.
 */
function quotedJsoncBlocks(): string[] {
	return [...readme.matchAll(/```jsonc\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
}

/** A block may be a whole object or a run of keys lifted out of one. */
function parseBlock(block: string): Record<string, unknown> | null {
	const stripped = stripJsonc(block).trim();
	const candidates = [stripped, `{${stripped.replace(/,\s*$/, "")}}`];
	for (const candidate of candidates) {
		try {
			return JSON.parse(candidate) as Record<string, unknown>;
		} catch {
			// try the next shape
		}
	}
	return null;
}

describe("README configuration snippets", () => {
	const blocks = quotedJsoncBlocks();

	it("quotes only jsonc that parses", () => {
		expect(blocks.filter((block) => parseBlock(block) === null)).toEqual([]);
	});

	// The snippets are excerpts, so they may omit keys — but every key one does
	// show has to match the real file. Omission is fine; drift is not.
	it("quotes no wrangler.jsonc value that has drifted from the real file", () => {
		const actual = JSON.parse(
			stripJsonc(readFileSync(resolve(ROOT, "wrangler.jsonc"), "utf8")),
		) as Record<string, unknown>;

		for (const block of blocks) {
			for (const [key, value] of Object.entries(parseBlock(block) ?? {})) {
				if (!(key in actual)) continue; // not a wrangler snippet
				expect({ [key]: value }).toEqual({ [key]: actual[key] });
			}
		}
	});
});

describe("README licence claim", () => {
	// The README links `LICENSE` and names the terms. Both halves have to be real:
	// a link to nothing, or a file under other terms, is the same broken promise.
	const link = readme.match(/\[([^\]]*License[^\]]*)\]\(([^)]+)\)/i);

	it("links a licence file and names the terms", () => {
		expect(link).not.toBeNull();
	});

	it("links a file that exists", () => {
		const target = link?.[2] ?? "";
		expect(existsSync(resolve(ROOT, target))).toBe(true);
	});

	it("links a file granting the terms the README claims", () => {
		const claimed = link?.[1] ?? "";
		const body = readFileSync(resolve(ROOT, link?.[2] ?? ""), "utf8");
		const licence = claimed.replace(/\s*Licen[cs]e\s*/i, "").trim();
		expect(body).toContain(`${licence} License`);
	});
});

// The snippet invariant only holds if whatever edits wrangler.jsonc also edits
// the README. The compat-date bot rewrites compatibility_date, so it has to
// keep the two in step — and, since the README stopped quoting the value, it
// also has to survive finding nothing to rewrite. It did not: the job exited 1
// on a missed match, which would have failed the first scheduled run more than
// 90 days after the last bump.
describe("compat-date bot and the README stay consistent", () => {
	const workflow = readFileSync(resolve(ROOT, ".github", "workflows", "compat-date.yml"), "utf8");
	const readmeStep = workflow.slice(
		workflow.indexOf("const readmePath"),
		workflow.indexOf('appendFileSync(out, "bump=true'),
	);

	it("attempts the README rewrite alongside wrangler.jsonc", () => {
		expect(readmeStep).toMatch(/README\.md/);
	});

	it("rewrites the README whenever the README quotes compatibility_date", () => {
		const readmeQuotesIt = /"compatibility_date"\s*:/.test(readme);
		const botRewritesReadme = /writeFileSync\(readmePath, readmeUpdated\)/.test(readmeStep);
		// An implication, not an equality: rewriting when there is nothing to
		// rewrite is harmless, failing to rewrite a quoted value is not.
		expect(!readmeQuotesIt || botRewritesReadme).toBe(true);
	});

	it("treats a README without the value as a no-op rather than a failure", () => {
		expect(readmeStep).not.toMatch(/process\.exit\(1\)/);
	});
});

/** Environments that have a drizzle config, and where each writes migrations. */
function configuredEnvironments(): { env: string; out: string }[] {
	return readdirSync(ROOT)
		.filter((f) => /^drizzle-.+\.config\.ts$/.test(f))
		.map((f) => {
			const env = f.replace(/^drizzle-|\.config\.ts$/g, "");
			const out = readFileSync(resolve(ROOT, f), "utf8").match(/out:\s*"\.\/([^"]+)"/)?.[1];
			if (!out) throw new Error(`${f} declares no out directory`);
			return { env, out };
		})
		.sort((a, b) => a.env.localeCompare(b.env));
}

const MIGRATION_TABLE_HEADING = "#### Migration directories";

/** Rows of the README's migration-directory table, empty when it has no table. */
function documentedMigrationDirs(): Map<string, { dir: string; status: string }> {
	const rows = new Map<string, { dir: string; status: string }>();
	const start = readme.indexOf(MIGRATION_TABLE_HEADING);
	if (start === -1) return rows;

	for (const line of readme.slice(start).split("\n")) {
		if (!line.startsWith("|")) {
			if (rows.size > 0) break; // table ended
			continue;
		}
		const cells = line
			.split("|")
			.slice(1, -1)
			.map((c) => c.trim());
		const [env, dir, status] = cells;
		if (!env || !dir || !status) continue;
		if (env === "Environment" || /^-+$/.test(env)) continue;
		rows.set(env.replace(/`/g, ""), { dir: dir.replace(/`/g, ""), status });
	}
	return rows;
}

/** A migration directory only really exists once it holds a migration. */
function hasMigrations(dir: string): boolean {
	const path = resolve(ROOT, dir);
	return existsSync(path) && readdirSync(path).some((f) => f.endsWith(".sql"));
}

describe("README migration directories", () => {
	const configured = configuredEnvironments();
	const documented = documentedMigrationDirs();

	it("documents every configured environment, and only those, or documents none", () => {
		if (documented.size === 0) {
			// No table is a valid state — it says so by not carrying the heading.
			expect(readme).not.toContain(MIGRATION_TABLE_HEADING);
			return;
		}
		expect([...documented.keys()].sort()).toEqual(configured.map((c) => c.env));
		for (const { env, out } of configured) {
			expect(documented.get(env)?.dir).toBe(out);
		}
	});

	// The point of the table: a directory that is not in the repository yet must
	// say so, and say what creates it, rather than being listed as if it shipped.
	it("states the real status of every directory it lists", () => {
		for (const { env, out } of configured) {
			const status = documented.get(env)?.status;
			if (status === undefined) continue; // not listed; covered by the test above
			if (hasMigrations(out)) {
				expect(status).toMatch(/^In the repository$/);
			} else {
				expect(status).toMatch(new RegExp(`Created by \`pnpm db:generate:${env}\``));
			}
		}
	});
});

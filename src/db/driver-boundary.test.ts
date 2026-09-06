import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");

/** The one module allowed to know which Drizzle driver this project uses. */
const DRIVER_MODULE = "src/db/setup.ts";

/**
 * A Drizzle *driver* import, as opposed to the ORM core or a schema builder.
 *
 * `drizzle-orm` gives you `eq`/`count`; `drizzle-orm/sqlite-core` gives you
 * `sqliteTable`. Neither of those picks a database. The `drizzle` factory does,
 * and it is imported from a driver-specific subpath — `d1`, `neon-http`,
 * `node-postgres` — which is what this matches.
 */
const DRIVER_IMPORT = /from\s+"drizzle-orm\/(?!.*-core")[^"]+"/;

function sourceFiles(dir: string): string[] {
	const entries = readdirSync(resolve(ROOT, dir));
	return entries.flatMap((entry) => {
		const relative = `${dir}/${entry}`;
		if (statSync(resolve(ROOT, relative)).isDirectory()) return sourceFiles(relative);
		return /\.tsx?$/.test(entry) ? [relative] : [];
	});
}

// `docs/decisions/database-driver.md` claims the driver choice is reversible in
// one file, and the same claim is written into `src/db/setup.ts`. A claim about
// where complexity is contained decays silently — the second call site is added
// by someone who never read either document, so the invariant is asserted here
// rather than described.
describe("Drizzle driver boundary", () => {
	const importers = [...sourceFiles("src"), ...sourceFiles("scripts")].filter((file) =>
		DRIVER_IMPORT.test(readFileSync(resolve(ROOT, file), "utf8")),
	);

	it("keeps the driver import in exactly one module", () => {
		expect(importers).toEqual([DRIVER_MODULE]);
	});

	// The other half of the claim: callers get a database from here, so swapping
	// the driver cannot change their signature.
	it("exposes that module through one accessor", () => {
		const source = readFileSync(resolve(ROOT, DRIVER_MODULE), "utf8");
		const exported = [...source.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);

		expect(exported).toEqual(["getDb"]);
	});
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");

const section = readme.split(/\n(?=#{1,6}\s)/).find((s) => /^#{1,6}\s+Security posture\b/.test(s));

describe("README security posture section", () => {
	it("documents a 'Security posture' section", () => {
		expect(section).toBeDefined();
	});

	// "No auth" is a decision here, not an omission: the site is public and the
	// organizer reads their data with the Wrangler CLI. Stated plainly, because
	// a reader who assumes an admin panel exists goes looking for its password.
	it("states that having no authenticated surface is deliberate", () => {
		expect(section).toMatch(/no auth/i);
		expect(section).toMatch(/by design|deliberate|on purpose/i);
	});

	// The claim that replaces an admin panel. If the README stops naming the
	// mechanism, "no auth surface" reads as an oversight rather than a trade.
	it("names how an organizer reaches their own data instead", () => {
		expect(section).toMatch(/wrangler d1/);
	});

	// A pointer at the seam is only useful while it resolves. A file that no
	// longer holds the attachment point is a worse lie than no pointer at all.
	it("names the file where authentication attaches, and that file holds the seam", () => {
		const named = section?.match(/`(src\/[^`]+\.ts)`/)?.[1] ?? "";
		expect(named).not.toBe("");
		expect(existsSync(resolve(ROOT, named))).toBe(true);

		const source = readFileSync(resolve(ROOT, named), "utf8");
		expect(source).toContain("createHono");
		expect(source).toContain("ApiMiddleware");
	});

	it("tells a cloner what to do before deploying", () => {
		expect(section).toMatch(/before (you )?deploy/i);
		const steps = (section ?? "").split("\n").filter((l) => /^\s*(-|\d+\.)\s/.test(l));
		expect(steps.length).toBeGreaterThanOrEqual(2);
	});

	// The placeholder database ids are the one deploy-time footgun this slice
	// ships: they are syntactically valid, so a deploy that never replaced them
	// fails at the first query rather than at the first command.
	it("warns that the shipped database ids are placeholders", () => {
		expect(section).toMatch(/database_id|placeholder/i);
	});
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const WRANGLER = resolve(ROOT, "wrangler.jsonc");

/** The file as written, comments and all — what a cloner actually reads. */
const source = readFileSync(WRANGLER, "utf8");

function loadJsonc(path: string): Record<string, unknown> {
	const raw = readFileSync(path, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*/g, "");
	return JSON.parse(raw);
}

/** Deployed environments, as opposed to the top-level block that dev uses. */
const DEPLOYED_ENVS = ["staging", "production"] as const;

type DurableObjects = { bindings?: { name?: string; class_name?: string }[] };

type D1Binding = {
	binding?: string;
	database_name?: string;
	database_id?: string;
	migrations_dir?: string;
};

type EnvBlock = {
	name?: string;
	vars?: Record<string, string>;
	workers_dev?: boolean;
	preview_urls?: boolean;
	upload_source_maps?: boolean;
	routes?: unknown[];
	d1_databases?: D1Binding[];
};

/** Every environment that gets its own block, dev included. */
const ALL_ENVS = ["dev", ...DEPLOYED_ENVS] as const;

describe("wrangler.jsonc", () => {
	const config = loadJsonc(WRANGLER) as EnvBlock & {
		compatibility_date?: string;
		placement?: unknown;
		observability?: {
			enabled?: boolean;
			logs?: { head_sampling_rate?: number };
			traces?: { enabled?: boolean; head_sampling_rate?: number };
		};
		env?: Record<string, EnvBlock | undefined>;
	};

	it("compatibility_date is within 90 days", () => {
		expect(config.compatibility_date).toBeDefined();
		const date = new Date(config.compatibility_date as string);
		const ageDays = (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
		expect(ageDays).toBeLessThan(90);
	});

	it("enables observability with sampling configured", () => {
		expect(config.observability?.enabled).toBe(true);
		expect(config.observability?.logs?.head_sampling_rate).toBeGreaterThan(0);
		expect(config.observability?.traces?.enabled).toBe(true);
	});

	it("declares env.staging and env.production with distinct worker names", () => {
		expect(config.env?.staging?.name).toBeDefined();
		expect(config.env?.production?.name).toBeDefined();
		expect(config.env?.staging?.name).not.toBe(config.name);
		expect(config.env?.production?.name).not.toBe(config.name);
		expect(config.env?.staging?.name).not.toBe(config.env?.production?.name);
	});

	it("scopes CLOUDFLARE_ENV per env block", () => {
		expect(config.env?.staging?.vars?.CLOUDFLARE_ENV).toBe("staging");
		expect(config.env?.production?.vars?.CLOUDFLARE_ENV).toBe("production");
	});

	// Observability without source maps buys logs full of minified frames: the
	// traces are collected and paid for, and point at output nobody can read.
	it("uploads source maps", () => {
		expect(config.upload_source_maps).toBe(true);
	});

	it.each(DEPLOYED_ENVS)("does not turn source maps off for %s", (env) => {
		expect(config.env?.[env]?.upload_source_maps).not.toBe(false);
	});

	// Reachability that is inherited from a platform default is reachability a
	// cloner learns about after deploying, which is the wrong time to learn it.
	it.each(DEPLOYED_ENVS)("states the public-URL posture of %s", (env) => {
		expect(typeof config.env?.[env]?.workers_dev).toBe("boolean");
	});

	it.each(DEPLOYED_ENVS)("states the preview-URL posture of %s", (env) => {
		expect(typeof config.env?.[env]?.preview_urls).toBe("boolean");
	});

	// A petition collects names, e-mail addresses and consents under one
	// campaign's identity. A guessable second URL serving the same form collects
	// them under no identity at all, which is the one default worth overriding
	// outright — the custom domain becomes a precondition rather than a polish
	// step.
	it("keeps production off the workers.dev subdomain", () => {
		expect(config.env?.production?.workers_dev).toBe(false);
		expect(config.env?.production?.preview_urls).toBe(false);
	});
});

describe("wrangler.jsonc routing placeholders", () => {
	const commented = source
		.split("\n")
		.filter((line) => line.trimStart().startsWith("//"))
		.join("\n");

	it("offers a custom-domain placeholder to fill in", () => {
		expect(commented).toMatch(/custom_domain/);
	});

	// `.claude/rules/cloudflare-deployment.md`: custom domains provision DNS and
	// certificates, route patterns with zone_name need a record to exist first.
	// Checked per placeholder, since explaining that preference means naming
	// the thing being avoided.
	it("follows the repository's own preference for custom domains over routes", () => {
		const placeholders = commented.split("\n").filter((line) => line.includes('"routes"'));

		expect(placeholders.length).toBe(DEPLOYED_ENVS.length);
		for (const placeholder of placeholders) {
			expect(placeholder).toMatch(/"custom_domain":\s*true/);
			expect(placeholder).not.toMatch(/zone_name/);
		}
	});

	it("ships no active routes to a domain nobody cloning this owns", () => {
		const config = loadJsonc(WRANGLER) as { routes?: unknown; env?: Record<string, EnvBlock> };
		expect(config.routes).toBeUndefined();
		for (const env of DEPLOYED_ENVS) expect(config.env?.[env]?.routes).toBeUndefined();
	});
});

describe("wrangler.jsonc Smart Placement", () => {
	const config = loadJsonc(WRANGLER) as { placement?: unknown };

	it("ships off", () => {
		expect(config.placement).toBeUndefined();
	});

	it("ships present, so enabling it is uncommenting rather than researching", () => {
		expect(source).toMatch(/"placement":\s*{\s*"mode":\s*"smart"\s*}/);
	});

	// Guidance that lives in two places disagrees in one of them eventually.
	it("points at the decision record instead of restating it", () => {
		const referenced = source.match(/docs\/decisions\/[\w-]+\.md/)?.[0];
		expect(referenced).toBe("docs/decisions/smart-placement.md");
		expect(existsSync(resolve(ROOT, referenced ?? ""))).toBe(true);
	});
});

describe("package.json deploy scripts", () => {
	const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf8")) as {
		scripts: Record<string, string>;
	};

	// `@cloudflare/vite-plugin` selects the wrangler env block from the
	// CLOUDFLARE_ENV variable. Vite's `--mode` is a Vite concept the plugin
	// does not read, so a build that sets only the mode resolves to the
	// top-level block instead — same bundle, but the dev Worker's name, the
	// dev vars, and none of the env's routes. `wrangler deploy` then publishes
	// that over the dev Worker and reports success, which is the worst
	// available outcome: a green deploy of the wrong thing.
	it.each(DEPLOYED_ENVS)("builds %s with CLOUDFLARE_ENV set", (env) => {
		expect(pkg.scripts[`build:${env}`]).toMatch(new RegExp(`CLOUDFLARE_ENV=${env}(\\s|$)`));
		expect(pkg.scripts[`build:${env}`]).toMatch(/vite build/);
	});

	it.each(DEPLOYED_ENVS)("deploys %s from the build it just made", (env) => {
		expect(pkg.scripts[`deploy:${env}`]).toMatch(new RegExp(`build:${env}`));
		expect(pkg.scripts[`deploy:${env}`]).toMatch(/wrangler deploy/);
	});
});

// D1 is the single source of truth for signatures, and `migrations_dir` is the
// only thing tying `pnpm db:generate:<env>` to `pnpm db:migrate:<env>`. Nothing
// fails loudly when those drift: generation writes SQL somewhere Wrangler never
// looks, the apply reports "no migrations to apply", and the deploy is green
// with a table that was never created.
describe("wrangler.jsonc D1 bindings", () => {
	const config = loadJsonc(WRANGLER) as EnvBlock & { env?: Record<string, EnvBlock | undefined> };

	/** The block a given environment resolves to; dev is the top level. */
	function blockFor(env: (typeof ALL_ENVS)[number]): EnvBlock | undefined {
		return env === "dev" ? config : config.env?.[env];
	}

	/** Where `drizzle-<env>.config.ts` writes its migrations. */
	function generatorOutput(env: string): string {
		const source = readFileSync(resolve(ROOT, `drizzle-${env}.config.ts`), "utf8");
		const out = source.match(/out:\s*"\.\/([^"]+)"/)?.[1];
		if (!out) throw new Error(`drizzle-${env}.config.ts declares no out directory`);
		return out;
	}

	it.each(ALL_ENVS)("binds one database as DB in %s", (env) => {
		const bindings = blockFor(env)?.d1_databases;
		expect(bindings?.map((d) => d.binding)).toEqual(["DB"]);
	});

	it.each(ALL_ENVS)("points %s at the directory its generator writes to", (env) => {
		expect(blockFor(env)?.d1_databases?.[0]?.migrations_dir).toBe(generatorOutput(env));
	});

	// Bindings are not inherited from the top level, and a staging Worker that
	// silently fell back to the dev database would look like it was working.
	it("gives every environment its own database", () => {
		const names = ALL_ENVS.map((env) => blockFor(env)?.d1_databases?.[0]?.database_name);
		expect(new Set(names).size).toBe(ALL_ENVS.length);
	});

	// The ids are placeholders a cloner replaces after `wrangler d1 create`. That
	// is only safe while it is obvious — a plausible-looking id would be pasted
	// over by nobody and deployed by everybody.
	it("ships ids that cannot be mistaken for real ones", () => {
		for (const env of ALL_ENVS) {
			expect(blockFor(env)?.d1_databases?.[0]?.database_id).toMatch(/^0{8}-0{4}-0{4}-0{4}-0{12}$/);
		}
	});
});

/**
 * The live counter's wiring, which fails in three different ways if any one
 * piece is missing and in none of them at `pnpm dev`.
 *
 * A binding in only some environments deploys green and leaves one of them
 * without a counter. A class nothing declared in a migration is refused at
 * upload with a message about a namespace that was never created. And a class
 * the entry module does not export is a binding pointing at nothing.
 */
describe("wrangler.jsonc Durable Object", () => {
	const config = loadJsonc(WRANGLER) as EnvBlock & {
		migrations?: { tag?: string; new_sqlite_classes?: string[]; new_classes?: string[] }[];
		env?: Record<string, (EnvBlock & { durable_objects?: DurableObjects }) | undefined>;
		durable_objects?: DurableObjects;
	};

	function blockFor(env: (typeof ALL_ENVS)[number]) {
		return env === "dev" ? config : config.env?.[env];
	}

	// Not inherited from the top level — wrangler says so in the schema, and a
	// staging Worker without the binding would throw on the first page load.
	it.each(ALL_ENVS)("binds the counter in %s", (env) => {
		expect(blockFor(env)?.durable_objects?.bindings).toEqual([
			{ name: "LIVE_COUNTER", class_name: "LiveCounter" },
		]);
	});

	it("declares the bound class in a migration", () => {
		const declared = (config.migrations ?? []).flatMap((migration) => [
			...(migration.new_sqlite_classes ?? []),
			...(migration.new_classes ?? []),
		]);

		expect(declared).toContain("LiveCounter");
	});

	// The runtime looks for the class on the module `main` points at, not
	// wherever it happens to be written.
	it("exports that class from the Worker entry", () => {
		const main = (config as { main?: string }).main ?? "";
		const entry = readFileSync(resolve(ROOT, main), "utf8");

		expect(entry).toMatch(/export\s*\{[^}]*\bLiveCounter\b[^}]*\}/);
	});
});

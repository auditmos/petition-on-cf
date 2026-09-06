import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const WORKFLOW_DIR = resolve(ROOT, ".github", "workflows");

/**
 * The template for `.dev.vars`, named the way Cloudflare's own tooling expects:
 * `<real file>.example`, the same shape as `.env.example`. Deploy-to-Cloudflare
 * reads this name to prompt for a Worker's secrets, so the convention buys
 * something concrete beyond consistency.
 */
const EXAMPLE_VARS = ".dev.vars.example";

type SecretsBlock = { required?: string[] };
type EnvBlock = { secrets?: SecretsBlock; vars?: Record<string, string> };
type WranglerConfig = EnvBlock & { env?: Record<string, EnvBlock> };

function loadWranglerConfig(): WranglerConfig {
	const raw = readFileSync(resolve(ROOT, "wrangler.jsonc"), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*/g, "");
	return JSON.parse(raw) as WranglerConfig;
}

/** Keys of a dotenv-style file, ignoring comments and blank lines. */
function loadEnvKeys(file: string): string[] {
	return readFileSync(resolve(ROOT, file), "utf8")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.map((line) => line.split("=")[0]?.trim() ?? "")
		.filter((key) => key.length > 0);
}

describe("secrets contract", () => {
	const config = loadWranglerConfig();
	const exampleKeys = loadEnvKeys(EXAMPLE_VARS);

	// Stated even while it is empty. This template reaches no third party and
	// stores its data in a binding, so there is currently nothing to put here —
	// and an absent block would look like the question was never asked. The
	// first entry will be the Turnstile secret key (issue #6).
	it("declares the secrets contract in wrangler.jsonc", () => {
		expect(config.secrets?.required).toBeInstanceOf(Array);
	});

	it("declares every required secret in the example vars template", () => {
		for (const secret of config.secrets?.required ?? []) {
			expect(exampleKeys).toContain(secret);
		}
	});

	// `secrets` is not inherited from the top level, so a missing env block means
	// that environment silently falls back to no declared secrets.
	it.each(["staging", "production"])("repeats the same required secrets in env.%s", (env) => {
		expect(config.env?.[env]?.secrets?.required).toEqual(config.secrets?.required);
	});

	// Typegen reads `secrets.required`, so a declared secret is a typed one, and
	// `c.env.TURNSTILE_SECRET_KEY` stops compiling the day somebody drops the
	// declaration. That is the whole reason the block is the source of truth.
	it("puts every required secret into the generated Env type", () => {
		const types = readFileSync(resolve(ROOT, "worker-configuration.d.ts"), "utf8");
		for (const secret of config.secrets?.required ?? []) {
			expect(types).toContain(`${secret}: string;`);
		}
	});

	it("backs every key in the example vars template with a declared secret or var", () => {
		const declared = new Set([
			...(config.secrets?.required ?? []),
			...Object.keys(config.vars ?? {}),
		]);
		for (const key of exampleKeys) {
			expect([...declared]).toContain(key);
		}
	});
});

/**
 * Where a secret is allowed to be, and where it is not.
 *
 * Turnstile's two keys look alike and are not alike: the **site** key is
 * public, is read by a script in the visitor's browser, and therefore belongs
 * in the config file, while the **secret** key is what proves the Worker is
 * the Worker and must only ever arrive as a binding. Putting the second one
 * where the first one goes would ship it to every visitor, in a file whose
 * whole purpose is to be edited by whoever clones this — which is exactly the
 * mistake worth spending a test on.
 */
describe("the Turnstile secret stays out of the source", () => {
	/** Every source file, so the check cannot be dodged by adding a file. */
	function sourceFiles(directory: string): string[] {
		return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
			const path = resolve(directory, entry.name);
			return entry.isDirectory() ? sourceFiles(path) : [path];
		});
	}

	const sources = sourceFiles(resolve(ROOT, "src"));

	/**
	 * Source with the comments removed.
	 *
	 * Naming the secret in prose is how a file explains where the secret is
	 * *not* — `site-config.ts` says so at length, and that paragraph is the
	 * documentation this rule exists to produce. Scanning it as if it were code
	 * would make the guard punish the explanation and pass the mistake.
	 */
	function code(source: string): string {
		return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
	}

	it("finds the source to check", () => {
		expect(sources.length).toBeGreaterThan(20);
	});

	// A real Turnstile secret is `0x` followed by a long opaque run. The test
	// keys Cloudflare publishes start `1x`/`2x`/`3x` and are deliberately not
	// matched: they are documentation, not credentials.
	it("carries no real Turnstile secret key anywhere in the repository", () => {
		const scanned = [
			...sources,
			...["wrangler.jsonc", ".dev.vars.example", "README.md", "vitest.config.ts"].map((f) =>
				resolve(ROOT, f),
			),
		];
		const offenders = scanned.filter((file) =>
			/0x[A-Za-z0-9_-]{30,}/.test(readFileSync(file, "utf8")),
		);

		expect(offenders).toEqual([]);
	});

	// The content module is copy and identity, shipped to the browser whole.
	it("keeps the secret out of the content and config files", () => {
		for (const file of sources.filter((path) => path.includes("/content/"))) {
			expect(code(readFileSync(file, "utf8"))).not.toMatch(/TURNSTILE_SECRET/);
		}
	});

	// The public half, stated as an invariant rather than left to chance: it
	// has to be in the config, because that is what `init-project` rewrites.
	it("keeps the public site key in the config, where a cloner can change it", () => {
		expect(readFileSync(resolve(ROOT, "src/content/site-config.ts"), "utf8")).toMatch(
			/turnstileSiteKey/,
		);
	});

	/**
	 * The Worker may read the secret from exactly one place. `process.env` is
	 * the tempting alternative and it is empty on Workers, so a Worker that
	 * used it would deploy green and refuse every signature.
	 *
	 * Shipped code only. A test naming the secret is asserting about it, not
	 * reading it — and this file names it in a regular expression, so scanning
	 * tests would mean scanning itself. Whether a *value* leaked is the other
	 * check's job, and that one does read every file.
	 */
	it("reads the secret only off the env binding", () => {
		for (const file of sources.filter((path) => !/\.test\.tsx?$/.test(path))) {
			const body = code(readFileSync(file, "utf8"));
			for (const [line] of body.matchAll(/^.*TURNSTILE_SECRET_KEY.*$/gm)) {
				// Spelled as two assertions because `process.env.X` *contains*
				// `env.X`: a single pattern for the good case quietly accepts
				// the bad one, which is the exact swap this test exists to stop.
				expect(line).not.toMatch(/process\.env/);
				expect(line).toMatch(/\benv\.TURNSTILE_SECRET_KEY|TURNSTILE_SECRET_KEY:/);
			}
		}
	});
});

// Declared secrets make `wrangler types` independent of any gitignored file, so
// the workarounds that existed only because typegen read .dev.vars must be gone.
describe("workflows carry no typegen workarounds", () => {
	const workflows = readdirSync(WORKFLOW_DIR)
		.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
		.map((f) => [f, readFileSync(resolve(WORKFLOW_DIR, f), "utf8")] as const);

	it("finds workflows to check", () => {
		expect(workflows.length).toBeGreaterThan(0);
	});

	it.each(workflows)("%s does not disable git hooks", (_name, body) => {
		expect(body).not.toMatch(/SKIP_SIMPLE_GIT_HOOKS/);
	});

	it("compat-date workflow regenerates types instead of skipping typegen", () => {
		// Must be an executed `run:` step. The old workaround mentioned cf-typegen
		// in both a comment and the PR body, either of which a loose match accepts.
		const runSteps = readFileSync(resolve(WORKFLOW_DIR, "compat-date.yml"), "utf8")
			.split("\n")
			.filter((line) => /^\s*run:\s/.test(line));
		expect(runSteps.some((line) => /pnpm (run )?cf-typegen/.test(line))).toBe(true);
	});
});

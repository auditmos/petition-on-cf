import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ENV_TEMPLATES, fanoutEnv } from "./init-project";

const ROOT = resolve(__dirname, "..");

describe("env template fan-out", () => {
	// Renaming a template without renaming it here leaves the bootstrap step
	// reporting "no-template" for every file a cloner needs, and it reports that
	// as a normal outcome rather than an error.
	it.each(ENV_TEMPLATES)("ships the $template template it promises to copy", ({ template }) => {
		expect(existsSync(resolve(ROOT, template))).toBe(true);
	});

	it("names a template for every per-environment file the README tells you to fill", () => {
		const targets = ENV_TEMPLATES.flatMap((t) => t.targets);
		expect(targets).toEqual([".env", ".dev.vars", ".staging.vars", ".production.vars"]);
	});

	describe("copying", () => {
		let root: string;

		beforeEach(() => {
			root = mkdtempSync(join(tmpdir(), "init-project-"));
			writeFileSync(join(root, ".dev.vars.example"), 'TURNSTILE_SECRET_KEY=""\n');
		});

		afterEach(() => {
			rmSync(root, { recursive: true, force: true });
		});

		it("copies the template to a target that is not there yet", () => {
			expect(fanoutEnv(".dev.vars.example", ".dev.vars", root)).toBe("copied");
			expect(readFileSync(join(root, ".dev.vars"), "utf8")).toBe('TURNSTILE_SECRET_KEY=""\n');
		});

		// The second run happens after someone has filled in real credentials.
		it("leaves a filled-in target alone on a re-run", () => {
			writeFileSync(join(root, ".dev.vars"), 'TURNSTILE_SECRET_KEY="real"\n');

			expect(fanoutEnv(".dev.vars.example", ".dev.vars", root)).toBe("skipped");
			expect(readFileSync(join(root, ".dev.vars"), "utf8")).toBe('TURNSTILE_SECRET_KEY="real"\n');
		});

		it("reports a missing template rather than writing an empty file", () => {
			expect(fanoutEnv(".gone.example", ".gone", root)).toBe("no-template");
			expect(existsSync(join(root, ".gone"))).toBe(false);
		});
	});
});

/**
 * The script as a cloner actually runs it: a process, with answers on stdin.
 *
 * `personalize.test.ts` covers what each answer does to which file, with the
 * interview handed a function instead of a terminal. This covers the half that
 * test cannot see — that a real run reads a real pipe, question after
 * question, and does not lose the rest of the buffer when it reads the first
 * line. A per-question readline interface passes every unit test and drops
 * everything after answer one, so this is the assertion that would catch it.
 *
 * ## Assumptions this file encodes
 *
 * - **Answers are positional.** Piping is the non-interactive path, and the
 *   order below is the order the interview asks in. Reordering the interview
 *   is a breaking change for anybody automating it, and breaking this test is
 *   how they find out.
 * - **A short pipe is not a hang.** Answers that run out read as skipped, so
 *   `echo my-app | pnpm run init-project` renames the project and leaves the
 *   identity alone rather than blocking forever on question two.
 * - **`INIT_PROJECT_ROOT` is a testing seam**, and the only way to run the
 *   real script against files that are not this repository's own.
 */
describe("a scripted run", () => {
	/** The files the script reads or rewrites, copied out of this repository. */
	const FIXTURES = [
		"package.json",
		"wrangler.jsonc",
		".env.example",
		".dev.vars.example",
		"src/content/site-config.ts",
	];

	/** Answers in the order the interview asks for them. */
	const ANSWERS = [
		"czyste-powietrze", // project name
		"Petycja o czyste powietrze", // petitionName
		"Minister Klimatu i Środowiska", // petitionAddressee
		"FUNDACJA CZYSTE POWIETRZE", // organizerLegalName
		"Fundacja Czyste Powietrze", // organizerName
		"Fundacja", // organizerShortName
		"Fundacji", // organizerShortNameGen
		"Fundację", // organizerShortNameAcc
		"Fundacją", // organizerShortNameIns
		"ul. Wiejska 4", // organizerStreet
		"00-902 Warszawa", // organizerCity
		"0000123456", // organizerKrs
		"5252445211", // organizerNip
		"146830233", // organizerRegon
		"kontakt@czystepowietrze.pl", // contactEmail
		"https://czystepowietrze.pl/", // domain
		"firma", // signerOrgNoun — known, so no follow-up cases
		"", // facebookUrl, skipped
		"", // xUrl, skipped
		"", // linkedinUrl, skipped
		"", // turnstileSiteKey, skipped
		"y", // collectSignerRole, overriding the default for "firma"
		"replaced-by-hand-in-a-test", // TURNSTILE_SECRET_KEY
	];

	let root: string;

	function run(answers: string[]): string {
		return execFileSync("pnpm", ["exec", "tsx", "scripts/init-project.ts"], {
			cwd: ROOT,
			env: { ...process.env, INIT_PROJECT_ROOT: root },
			input: `${answers.join("\n")}\n`,
			encoding: "utf8",
		});
	}

	const config = () => readFileSync(join(root, "src/content/site-config.ts"), "utf8");
	const vars = () => readFileSync(join(root, ".dev.vars"), "utf8");

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "init-project-run-"));
		mkdirSync(join(root, "src", "content"), { recursive: true });
		for (const file of FIXTURES) copyFileSync(resolve(ROOT, file), join(root, file));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("renames the project and writes every identity answer", () => {
		run(ANSWERS);

		expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name).toBe(
			"czyste-powietrze",
		);
		expect(config()).toContain('petitionName: "Petycja o czyste powietrze"');
		expect(config()).toContain('organizerNip: "5252445211"');
		expect(config()).toContain('signerOrgNounGen: "firmy"');
		expect(config()).toContain('siteUrl: "https://czystepowietrze.pl"');
		expect(config()).toContain("export const COLLECT_SIGNER_ROLE = true;");
	});

	it("puts the secret in the gitignored vars file and nowhere else", () => {
		run(ANSWERS);

		expect(vars()).toContain("TURNSTILE_SECRET_KEY=replaced-by-hand-in-a-test");
		expect(config()).not.toContain("replaced-by-hand-in-a-test");
	});

	// The one file the secret lands in has to be one git will not offer to commit.
	it.each([".dev.vars", ".staging.vars", ".production.vars"])("gitignores %s", (file) => {
		expect(readFileSync(resolve(ROOT, ".gitignore"), "utf8")).toContain(file);
	});

	/**
	 * What "the second run changes nothing" means, precisely.
	 *
	 * Not that the file comes out byte-identical whatever you type — a question
	 * that was skipped is still an open question, and a second run offering it
	 * an answer is supposed to take it. What must hold is that nothing already
	 * answered can be talked out of its answer, whatever the pipe says next.
	 */
	describe("a second run", () => {
		const ANSWERED = {
			petitionName: "Petycja o czyste powietrze",
			organizerLegalName: "FUNDACJA CZYSTE POWIETRZE",
			organizerNip: "5252445211",
			domain: "czystepowietrze.pl",
			signerOrgNoun: "firma",
		};

		it("cannot talk an answered value out of its answer", () => {
			run(ANSWERS);

			// Same project name — the one answer that must stay kebab-case — and
			// something different for every question after it.
			run(ANSWERS.map((answer, index) => (index === 0 || answer === "" ? answer : `${answer} X`)));

			for (const [key, value] of Object.entries(ANSWERED)) {
				expect(config()).toContain(`${key}: ${JSON.stringify(value)},`);
			}
			expect(vars()).toContain("TURNSTILE_SECRET_KEY=replaced-by-hand-in-a-test");
		});

		it("is a byte-for-byte no-op when it answers nothing", () => {
			run(ANSWERS);
			const before = { config: config(), vars: vars() };

			run(["czyste-powietrze"]);

			expect(config()).toBe(before.config);
			expect(vars()).toBe(before.vars);
		});
	});

	// `echo my-app | pnpm run init-project` is a reasonable thing to try.
	it("treats answers that run out as questions skipped", () => {
		run(["czyste-powietrze"]);

		expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name).toBe(
			"czyste-powietrze",
		);
		expect(config()).toContain('petitionName: "Nazwa petycji", // placeholder');
	});
});

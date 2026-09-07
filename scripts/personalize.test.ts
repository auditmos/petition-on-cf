import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Ask, personalize } from "./personalize";

const ROOT = resolve(__dirname, "..");
const CONFIG = "src/content/site-config.ts";
const VARS = ".dev.vars";

/**
 * The identity interview, and what it does to the two files it owns.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is an `ask` and a project root. The interview never touches
 *   stdin here: `personalize` is handed a function that answers, so a test
 *   states the answers rather than staging a terminal.
 * - **An empty answer keeps what the file holds.** That one rule covers both
 *   "skip the optional question" and "this value is already right", which is
 *   what makes the second run of the script a no-op.
 * - **The marker is the contract.** A line carrying `// placeholder` still
 *   holds what the template shipped; a line without one was filled in, by this
 *   script or by hand, and is never asked about or rewritten again.
 * - **Output** is the two files rewritten in place — the site config, and
 *   `.dev.vars` for the one answer that is a secret. The report says which
 *   keys moved, for the script to print.
 * - **Not covered here**: the interview reaching a real terminal, which
 *   `init-project.test.ts` runs as a subprocess with answers piped in; and
 *   what the answers do to the legal texts, which is
 *   `personalize-legal.test.ts`.
 */

/** Fixture root holding real copies of the two files the interview rewrites. */
function fixtureRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "personalize-"));
	mkdirSync(join(root, "src", "content"), { recursive: true });
	copyFileSync(resolve(ROOT, CONFIG), join(root, CONFIG));
	copyFileSync(resolve(ROOT, ".dev.vars.example"), join(root, VARS));
	return root;
}

/**
 * Answers the questions named, and skips every other one.
 *
 * Keyed by the prompt's `key` rather than by position, so a test states only
 * the field it is about and reordering the interview does not rewrite it.
 */
function answering(answers: Record<string, string>): Ask {
	return async (prompt) => answers[prompt.key] ?? "";
}

describe("personalize", () => {
	let root: string;

	beforeEach(() => {
		root = fixtureRoot();
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	const config = () => readFileSync(join(root, CONFIG), "utf8");

	it("writes an answered value into the config", async () => {
		const report = await personalize(
			answering({ petitionName: "Petycja o czyste powietrze" }),
			root,
		);

		expect(config()).toContain('petitionName: "Petycja o czyste powietrze"');
		expect(report.written).toContain("petitionName");
	});

	// The config explains itself at length, and the explanation is most of the
	// file. A rewrite that keeps the values and loses the prose would pass every
	// assertion about values and leave the cloner a table of bare strings.
	it("leaves the documentation around the value it rewrites", async () => {
		await personalize(answering({ petitionName: "Petycja o czyste powietrze" }), root);

		expect(config()).toContain("Petition name, always rendered inside Polish quotes");
	});

	/**
	 * The second run happens after somebody has answered — this script's first
	 * run, or a hand edit. Either way the value is theirs, and a bootstrap step
	 * that overwrites it is worse than one that was never run.
	 */
	describe("a value that has already been answered", () => {
		const asked: string[] = [];
		const recording: Ask = async (prompt) => {
			asked.push(prompt.key);
			return "Nadpisane";
		};

		beforeEach(async () => {
			asked.length = 0;
			await personalize(answering({ petitionName: "Petycja o czyste powietrze" }), root);
		});

		it("is not asked about a second time", async () => {
			await personalize(recording, root);

			expect(asked).not.toContain("petitionName");
		});

		it("survives a run that answers everything else", async () => {
			await personalize(recording, root);

			expect(config()).toContain('petitionName: "Petycja o czyste powietrze"');
		});

		// The marker is what the next run reads, so leaving one behind would make
		// the whole file askable again on every re-run.
		it("no longer carries the marker that says it is a placeholder", async () => {
			expect(config()).not.toMatch(/petitionName:.*\/\/ placeholder/);
		});

		it("reports itself as kept rather than written", async () => {
			const report = await personalize(recording, root);

			expect(report.kept).toContain("petitionName");
			expect(report.written).not.toContain("petitionName");
		});
	});

	/**
	 * Some questions have no answer yet — a campaign with no LinkedIn page, a
	 * deployment not ready to leave Cloudflare's test keys. Skipping is a real
	 * answer, and what it means is "still the shipped default", which is the
	 * same thing the marker means.
	 */
	describe("a question that was skipped", () => {
		beforeEach(async () => {
			await personalize(answering({ petitionName: "Petycja o czyste powietrze" }), root);
		});

		it.each([
			"facebookUrl",
			"xUrl",
			"linkedinUrl",
			"turnstileSiteKey",
		])("leaves %s holding the default that works", (key) => {
			expect(config()).toMatch(new RegExp(`${key}: "[^"]*", // placeholder`));
		});

		// Skipping is not the same as answering, so the next run asks again.
		it("is asked again on the next run", async () => {
			const asked: string[] = [];
			await personalize(async (prompt) => {
				asked.push(prompt.key);
				return "";
			}, root);

			expect(asked).toContain("facebookUrl");
			expect(asked).toContain("turnstileSiteKey");
		});

		it("still accepts an answer later", async () => {
			await personalize(
				answering({ facebookUrl: "https://www.facebook.com/czystepowietrze" }),
				root,
			);

			expect(config()).toContain('facebookUrl: "https://www.facebook.com/czystepowietrze"');
			expect(config()).toContain('xUrl: "", // placeholder');
		});
	});

	/**
	 * The organizer, in every form the legal texts write them in.
	 *
	 * The RODO clause and the privacy policy are captured wording with the
	 * proper nouns punched out, and Polish declines a name by its role in the
	 * sentence — "interes Organizacji", "Z Organizacją". A config that held one
	 * form would produce grammatical nonsense in a document the organizer is
	 * legally bound by, so the interview asks for each case rather than
	 * inflecting a name it has never seen.
	 */
	describe("the organizer", () => {
		const CASES = [
			"organizerShortName",
			"organizerShortNameGen",
			"organizerShortNameAcc",
			"organizerShortNameIns",
		];

		it("is asked for the short name in all four cases", async () => {
			const asked: string[] = [];
			await personalize(async (prompt) => {
				asked.push(prompt.key);
				return "";
			}, root);

			for (const key of CASES) expect(asked).toContain(key);
		});

		it("writes every case it was given, none of them empty", async () => {
			const answers = {
				organizerShortName: "Fundacja Czyste Powietrze",
				organizerShortNameGen: "Fundacji Czyste Powietrze",
				organizerShortNameAcc: "Fundację Czyste Powietrze",
				organizerShortNameIns: "Fundacją Czyste Powietrze",
			};

			await personalize(answering(answers), root);

			for (const [key, value] of Object.entries(answers)) {
				expect(config()).toContain(`${key}: ${JSON.stringify(value)},`);
			}
		});

		// The privacy policy prints these; a personalized deployment that still
		// says NIP 0000000000 is a legal document with a wrong fact in it.
		it.each([
			["organizerLegalName", "FUNDACJA CZYSTE POWIETRZE"],
			["organizerName", "Fundacja Czyste Powietrze"],
			["organizerStreet", "ul. Wiejska 4"],
			["organizerCity", "00-902 Warszawa"],
			["organizerKrs", "0000123456"],
			["organizerNip", "5252445211"],
			["organizerRegon", "146830233"],
			["contactEmail", "kontakt@czystepowietrze.pl"],
			["petitionAddressee", "Minister Klimatu i Środowiska"],
		])("captures %s", async (key, value) => {
			await personalize(answering({ [key]: value }), root);

			expect(config()).toContain(`${key}: ${JSON.stringify(value)},`);
		});
	});

	/**
	 * The word this deployment uses for a signer that is not a person.
	 *
	 * Polish declines it, and the two obvious picks decline differently — "nazwa
	 * firmy" but "nazwa organizacji" — so the config holds one value per case.
	 * For a word the interview knows, asking three times would be asking the
	 * same question three times; for a word it does not, guessing would put
	 * ungrammatical Polish on a legal consent.
	 */
	describe("the signer-type noun", () => {
		it.each([
			["firma", "firmy", "firmie"],
			["organizacja", "organizacji", "organizacji"],
		])("declines %s without asking again", async (noun, gen, loc) => {
			const asked: string[] = [];
			await personalize(async (prompt) => {
				asked.push(prompt.key);
				return prompt.key === "signerOrgNoun" ? noun : "";
			}, root);

			expect(config()).toContain(`signerOrgNoun: ${JSON.stringify(noun)}`);
			expect(config()).toContain(`signerOrgNounGen: ${JSON.stringify(gen)}`);
			expect(config()).toContain(`signerOrgNounLoc: ${JSON.stringify(loc)}`);
			expect(asked).not.toContain("signerOrgNounGen");
		});

		it("asks for the cases of a noun it does not know", async () => {
			const asked: string[] = [];
			await personalize(async (prompt) => {
				asked.push(prompt.key);
				if (prompt.key === "signerOrgNoun") return "instytucja";
				if (prompt.key === "signerOrgNounGen") return "instytucji";
				if (prompt.key === "signerOrgNounLoc") return "instytucji";
				return "";
			}, root);

			expect(asked).toContain("signerOrgNounGen");
			expect(config()).toContain('signerOrgNoun: "instytucja"');
			expect(config()).toContain('signerOrgNounGen: "instytucji"');
			expect(config()).toContain('signerOrgNounLoc: "instytucji"');
		});
	});

	/**
	 * Whether to ask a non-personal signer what their role in it is.
	 *
	 * Worth asking when an association endorses and it matters who signed on
	 * its behalf; noise when a company signs under its own name. So the default
	 * follows the noun, and the person running the script can still say
	 * otherwise.
	 */
	describe("the role question", () => {
		/** Answers the noun, then whatever the test says about the role. */
		const withNoun =
			(noun: string, role: string): Ask =>
			async (prompt) => {
				if (prompt.key === "signerOrgNoun") return noun;
				if (prompt.key === "collectSignerRole") return role;
				return "";
			};

		it.each([
			["firma", "n", "false"],
			["organizacja", "y", "true"],
		])("defaults to %s -> %s", async (noun, shown, written) => {
			let offered = "";
			await personalize(async (prompt) => {
				if (prompt.key === "signerOrgNoun") return noun;
				if (prompt.key === "collectSignerRole") {
					offered = prompt.current;
					return "";
				}
				return "";
			}, root);

			expect(offered).toBe(shown);
			expect(config()).toContain(`export const COLLECT_SIGNER_ROLE = ${written};`);
		});

		it.each([
			["firma", "y", "true"],
			["organizacja", "n", "false"],
		])("lets an explicit answer beat the default for %s", async (noun, answer, written) => {
			await personalize(withNoun(noun, answer), root);

			expect(config()).toContain(`export const COLLECT_SIGNER_ROLE = ${written};`);
		});

		// The question is "what do you want asked of a *firma*" — meaningless
		// before anybody has said what word this deployment uses.
		it("is not asked while the noun is still the shipped placeholder", async () => {
			const asked: string[] = [];
			await personalize(async (prompt) => {
				asked.push(prompt.key);
				return "";
			}, root);

			expect(asked).not.toContain("collectSignerRole");
			expect(config()).toContain("export const COLLECT_SIGNER_ROLE = true; // placeholder");
		});
	});

	/**
	 * Turnstile's secret half, which is the one answer that is not public.
	 *
	 * Every other value in this interview ends up in a tracked file and is
	 * served to every visitor. This one proves the Worker is the Worker, so it
	 * goes to `.dev.vars` — gitignored, never committed — and the interview has
	 * to be incapable of confusing it with the site key it sits next to.
	 */
	describe("the Turnstile secret", () => {
		const SECRET = "replaced-by-hand-in-a-test";
		const vars = () => readFileSync(join(root, VARS), "utf8");

		it("goes into the local secrets file", async () => {
			await personalize(answering({ TURNSTILE_SECRET_KEY: SECRET }), root);

			expect(vars()).toContain(`TURNSTILE_SECRET_KEY=${SECRET}`);
		});

		it("never reaches the config the browser is served", async () => {
			await personalize(answering({ TURNSTILE_SECRET_KEY: SECRET }), root);

			expect(config()).not.toContain(SECRET);
		});

		it("leaves the always-pass test secret in place when skipped", async () => {
			await personalize(answering({}), root);

			expect(vars()).toContain("TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA");
		});

		it("is not asked about again once a real one is there", async () => {
			await personalize(answering({ TURNSTILE_SECRET_KEY: SECRET }), root);

			const asked: string[] = [];
			await personalize(async (prompt) => {
				asked.push(prompt.key);
				return "";
			}, root);

			expect(asked).not.toContain("TURNSTILE_SECRET_KEY");
			expect(vars()).toContain(`TURNSTILE_SECRET_KEY=${SECRET}`);
		});

		// The file explains what the shipped value is and why it works offline.
		it("keeps the explanation around the line it rewrites", async () => {
			await personalize(answering({ TURNSTILE_SECRET_KEY: SECRET }), root);

			expect(vars()).toContain("Cloudflare Turnstile secret key");
			expect(vars()).toContain("CLOUDFLARE_ENV=dev");
		});
	});

	/**
	 * `siteUrl` is `domain` with a scheme on it, and hreflang and Open Graph
	 * both refuse a bare host. Asking twice invites the answer where they
	 * disagree — a canonical URL pointing at one host and the visible domain
	 * saying another — so the interview asks for the host and derives the rest.
	 */
	describe("the domain", () => {
		it("derives the absolute origin from the host that was answered", async () => {
			await personalize(answering({ domain: "czystepowietrze.pl" }), root);

			expect(config()).toContain('domain: "czystepowietrze.pl"');
			expect(config()).toContain('siteUrl: "https://czystepowietrze.pl"');
		});

		// Whoever answers is reading it off a browser's address bar.
		it.each([
			["https://czystepowietrze.pl", "czystepowietrze.pl"],
			["http://czystepowietrze.pl/", "czystepowietrze.pl"],
			["  czystepowietrze.pl/  ", "czystepowietrze.pl"],
		])("takes %s as the host %s", async (answered, host) => {
			await personalize(answering({ domain: answered }), root);

			expect(config()).toContain(`domain: ${JSON.stringify(host)}`);
			expect(config()).toContain(`siteUrl: ${JSON.stringify(`https://${host}`)}`);
		});
	});
});

import fs from "node:fs";
import path from "node:path";

/**
 * The identity interview: who this deployment is, asked once and written down.
 *
 * `init-project` owns the mechanics of turning a template into a project —
 * renaming, env fan-out, next steps. This owns the one part that is a
 * conversation: the proper nouns a petition site says about itself, which live
 * in `src/content/site-config.ts` and reach every sentence as a `{{token}}`.
 *
 * The interface is one function and the two types it needs. Everything else —
 * which questions exist, what order they come in, how a value is written back
 * into a TypeScript file without disturbing the prose around it — is behind it.
 *
 * ## The marker is the idempotency contract
 *
 * Every value this interview owns ships with a trailing `// placeholder`. The
 * marker means "this is still what the template shipped"; writing a real value
 * removes it. So a re-run asks only about what nobody has answered yet, and a
 * value somebody filled in by hand is as untouchable as one this script wrote.
 *
 * The alternative — a table of shipped defaults kept in this file — would say
 * the same thing in a second place, and would go stale the moment the config
 * changed. Worse, it cannot survive personalization: once a deployment has
 * real values, nothing in the repository would still know which ones were
 * placeholders. The marker travels with the value it describes.
 */

/** One question, as the script needs to render it and a test needs to answer it. */
export type Prompt = {
	/** Stable identifier — the config key, where the answer is one. */
	key: string;
	/** What to ask. Carries its own "(optional)" where that is true. */
	question: string;
	/** What the file holds now, kept when the answer is empty. */
	current: string;
};

/** How the interview reaches whoever is answering it. */
export type Ask = (prompt: Prompt) => Promise<string>;

/** What moved, for the script to print. */
export type PersonalizeReport = {
	/** Config keys given a new value by this run. */
	written: string[];
	/** Config keys left exactly as they were — already answered, or skipped. */
	kept: string[];
};

const CONFIG_FILE = path.join("src", "content", "site-config.ts");

/** The trailing comment that marks a value as still the shipped placeholder. */
const MARKER = "// placeholder";

type Field = {
	key: string;
	question: string;
	/** What the config should hold, given what somebody typed. */
	normalize?: (answer: string) => string;
	/** The other config keys this one answer settles. */
	derives?: (value: string) => Record<string, string>;
	/** Questions this answer makes necessary. Empty when it settled them itself. */
	follow?: (value: string) => Field[];
};

/**
 * The two nouns a petition template can decline for you.
 *
 * Any other word is the deployment's own, and the interview asks for its cases
 * rather than guessing: Polish declension is not a suffix rule, and a wrong
 * guess would put ungrammatical Polish on a consent somebody is legally bound
 * by. Whether the role question is worth asking follows from the noun too — an
 * association's signature is somebody's, a company's is the company's.
 */
const DECLENSIONS: Record<string, { gen: string; loc: string; role: boolean }> = {
	firma: { gen: "firmy", loc: "firmie", role: false },
	organizacja: { gen: "organizacji", loc: "organizacji", role: true },
};

/**
 * A host, however it was pasted in.
 *
 * Whoever answers is reading it off a browser's address bar, so the scheme and
 * the trailing slash come along. Both belong to `siteUrl`, which is derived,
 * and neither belongs in the domain the footer prints.
 */
function toHost(answer: string): string {
	return answer
		.trim()
		.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
		.replace(/\/+$/, "");
}

/**
 * The questions, in the order they are asked.
 *
 * Grouped the way somebody answering them thinks: what the petition is, then
 * who is running it, then how a signature is worded, then the things a
 * deployment may not have yet.
 */
const FIELDS: Field[] = [
	{ key: "petitionName", question: "Petition name" },
	{ key: "petitionAddressee", question: "Petition addressee — who is being asked to act" },
	{ key: "organizerLegalName", question: "Organizer's full legal name, as documents write it" },
	{ key: "organizerName", question: "The same name in title case, for running prose" },
	{ key: "organizerShortName", question: "Short name, mianownik — „Organizacja zapewnia”" },
	{ key: "organizerShortNameGen", question: "Short name, dopełniacz — „interes Organizacji”" },
	{ key: "organizerShortNameAcc", question: "Short name, biernik — „przez Organizację”" },
	{ key: "organizerShortNameIns", question: "Short name, narzędnik — „Z Organizacją”" },
	{ key: "organizerStreet", question: "Registered street address" },
	{ key: "organizerCity", question: "Registered postal code and city" },
	{ key: "organizerKrs", question: "KRS number" },
	{ key: "organizerNip", question: "NIP number" },
	{ key: "organizerRegon", question: "REGON number" },
	{ key: "contactEmail", question: "Contact e-mail, printed in the legal texts" },
	{
		key: "domain",
		question: "Public domain (host only, e.g. petycja.example.org)",
		normalize: toHost,
		derives: (host) => ({ siteUrl: `https://${host}` }),
	},
	{
		key: "signerOrgNoun",
		question: 'Word for a signer that is not a person — "firma", "organizacja", or your own',
		normalize: (answer) => answer.trim().toLowerCase(),
		derives: (noun): Record<string, string> => {
			const known = DECLENSIONS[noun];
			return known ? { signerOrgNounGen: known.gen, signerOrgNounLoc: known.loc } : {};
		},
		follow: (noun) =>
			DECLENSIONS[noun]
				? []
				: [
						{ key: "signerOrgNounGen", question: `Genitive of "${noun}" — as in "nazwa …"` },
						{ key: "signerOrgNounLoc", question: `Locative of "${noun}" — as in "funkcja w …"` },
					],
	},
	{ key: "facebookUrl", question: "Facebook page URL (optional)" },
	{ key: "xUrl", question: "X profile URL (optional)" },
	{ key: "linkedinUrl", question: "LinkedIn page URL (optional)" },
	{
		key: "turnstileSiteKey",
		question: "Turnstile site key (optional — the test key signs without an account)",
	},
];

/** Matches `key: "value",` with the placeholder marker still on it. */
function markedLine(key: string): RegExp {
	return new RegExp(`^(\\s*)${key}: "([^"]*)",\\s*${MARKER}\\s*$`, "m");
}

/** Reads the still-unanswered value of `key`, or null once it has been answered. */
function placeholderValue(source: string, key: string): string | null {
	return markedLine(key).exec(source)?.[2] ?? null;
}

/** Replaces the marked value of `key`, dropping the marker with it. */
function writeValue(source: string, key: string, value: string): string {
	return source.replace(markedLine(key), (_whole, indent: string) => {
		return `${indent}${key}: ${JSON.stringify(value)},`;
	});
}

/** The role toggle, which is a boolean beside the config rather than in it. */
const ROLE_KEY = "collectSignerRole";
const ROLE_LINE = new RegExp(
	`^export const COLLECT_SIGNER_ROLE = (true|false);\\s*${MARKER}\\s*$`,
	"m",
);

/**
 * Ask whether a non-personal signer is asked for their role, and write it down.
 *
 * Answered after the noun, because the noun is what makes the question
 * meaningful — and skipped entirely while the noun is still the shipped
 * placeholder, since nobody can sensibly decide what to ask of a *firma*
 * before saying that *firma* is the word. Its default follows the noun, so
 * here an empty answer accepts what was offered rather than deferring: the
 * offer was already derived from something they said.
 */
async function askSignerRole(source: string, ask: Ask, report: PersonalizeReport): Promise<string> {
	if (!ROLE_LINE.test(source)) {
		report.kept.push(ROLE_KEY);
		return source;
	}
	const noun = placeholderValue(source, "signerOrgNoun");
	if (noun !== null) {
		// The noun is still a placeholder — the question has nothing to be about.
		report.kept.push(ROLE_KEY);
		return source;
	}
	const answered = /^\s*signerOrgNoun: "([^"]*)",/m.exec(source)?.[1] ?? "";
	const fallback = DECLENSIONS[answered]?.role ?? true;
	const answer = (
		await ask({
			key: ROLE_KEY,
			question: answered
				? `Ask a signer that is not a person — "${answered}" — for their role in it? (y/n)`
				: "Ask a signer that is not a person for their role in it? (y/n)",
			current: fallback ? "y" : "n",
		})
	)
		.trim()
		.toLowerCase();
	const collect = answer === "" ? fallback : answer.startsWith("y");
	report.written.push(ROLE_KEY);
	return source.replace(ROLE_LINE, `export const COLLECT_SIGNER_ROLE = ${collect};`);
}

/** The local secrets file, and the one line of it this interview owns. */
const VARS_FILE = ".dev.vars";
const SECRET_KEY = "TURNSTILE_SECRET_KEY";
const SECRET_LINE = new RegExp(`^${SECRET_KEY}=(.*)$`, "m");

/**
 * Cloudflare's published always-pass test secret, which is what ships.
 *
 * A dotenv line cannot carry a `// placeholder` marker, so this value plays
 * the marker's part: it is a documented constant rather than a credential, and
 * anything else in that line is somebody's real key. Hard-coding it here does
 * not risk the drift the config's marker avoids — Cloudflare publishes it, and
 * it changes when Cloudflare says so, not when this template does.
 */
const TEST_SECRET = "1x0000000000000000000000000000000AA";

/**
 * Ask for the Turnstile secret, and put it where secrets go.
 *
 * Its public half was asked for with the rest of the config, thirteen
 * questions earlier, and the two look alike enough that a template which let
 * them meet would eventually ship one as the other. They never meet: this
 * writes one line of a gitignored file and touches nothing else.
 */
async function askSecret(root: string, ask: Ask, report: PersonalizeReport): Promise<void> {
	const varsPath = path.join(root, VARS_FILE);
	if (!fs.existsSync(varsPath)) {
		report.kept.push(SECRET_KEY);
		return;
	}
	const source = fs.readFileSync(varsPath, "utf-8");
	const current = SECRET_LINE.exec(source)?.[1];
	if (current !== TEST_SECRET) {
		// Either somebody's real key, or a file this script does not recognise.
		report.kept.push(SECRET_KEY);
		return;
	}
	const answer = (
		await ask({
			key: SECRET_KEY,
			question: "Turnstile secret key (optional — never committed, stays in .dev.vars)",
			current,
		})
	).trim();
	if (answer === "") {
		report.kept.push(SECRET_KEY);
		return;
	}
	fs.writeFileSync(varsPath, source.replace(SECRET_LINE, `${SECRET_KEY}=${answer}`), "utf-8");
	report.written.push(SECRET_KEY);
}

/**
 * Ask for whatever this deployment has not answered yet, and write it down.
 *
 * `root` is the project directory, defaulting to the one this file lives in —
 * the same seam `fanoutEnv` uses, so a test can run the real interview over
 * real copies of the files instead of over a description of them.
 */
export async function personalize(ask: Ask, root: string): Promise<PersonalizeReport> {
	const configPath = path.join(root, CONFIG_FILE);
	let source = fs.readFileSync(configPath, "utf-8");
	const report: PersonalizeReport = { written: [], kept: [] };

	// A queue rather than a loop over `FIELDS`, because one answer can make
	// further questions necessary — a noun this script cannot decline has to be
	// asked for its cases, and those questions come next rather than at the end.
	const queue = [...FIELDS];
	while (queue.length > 0) {
		const field = queue.shift();
		if (!field) continue;
		const current = placeholderValue(source, field.key);
		if (current === null) {
			report.kept.push(field.key);
			continue;
		}
		const answer = (await ask({ key: field.key, question: field.question, current })).trim();
		if (answer === "") {
			report.kept.push(field.key);
			continue;
		}
		const value = field.normalize ? field.normalize(answer) : answer;
		for (const [key, derived] of Object.entries({
			[field.key]: value,
			...field.derives?.(value),
		})) {
			// A derived key somebody already answered by hand keeps their answer:
			// the rewrite only ever matches a line that still carries the marker.
			const before = source;
			source = writeValue(source, key, derived);
			(source === before ? report.kept : report.written).push(key);
		}
		queue.unshift(...(field.follow?.(value) ?? []));
	}

	source = await askSignerRole(source, ask, report);
	fs.writeFileSync(configPath, source, "utf-8");
	await askSecret(root, ask, report);
	return report;
}

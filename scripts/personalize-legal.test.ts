import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { en } from "@/content/en";
import consentPublicListOrganization from "@/content/legal/tokenized/consent-public-list-organization.md?raw";
import consentPublicListPerson from "@/content/legal/tokenized/consent-public-list-person.md?raw";
import consentRodoAcknowledgment from "@/content/legal/tokenized/consent-rodo-acknowledgment.md?raw";
import consentUpdates from "@/content/legal/tokenized/consent-updates.md?raw";
import inlineKlauzula from "@/content/legal/tokenized/inline-klauzula-informacyjna.md?raw";
import rodoClause from "@/content/legal/tokenized/klauzula-rodo-podpisanie-petycji.md?raw";
import privacyPolicy from "@/content/legal/tokenized/polityka-prywatnosci.md?raw";
import { pl } from "@/content/pl";
import { interpolate, TOKEN_PATTERN } from "@/content/tokens";
import { personalize } from "./personalize";

const ROOT = resolve(__dirname, "..");
const CONFIG = "src/content/site-config.ts";
const VARS = ".dev.vars";
/**
 * What a personalized deployment's legal texts and copy actually say.
 *
 * The interview is only worth running if its answers reach the documents. The
 * assertions below are on interpolated text rather than on rendered markup
 * because that is where a token either resolves or does not — the components
 * that render these are tested against the same fixtures in
 * `signature-form-legal.test.tsx` and `legal-text.test.tsx`, and doubling
 * those here would test React twice and the interview not at all.
 *
 * ## Assumptions this file encodes
 *
 * - **A personalized config leaves no placeholder in a legal document.** The
 *   privacy policy printing `NIP 0000000000` is a legal text stating a false
 *   fact, which is worse than an obviously-unconfigured demo.
 * - **Every `{{token}}` any text uses is a key the config has.** A token with
 *   no key behind it survives interpolation and reaches a reader verbatim.
 */

/** The seven approved texts, keyed the way the legal module keys them. */
const LEGAL_TEXTS = {
	consentRodoAcknowledgment,
	consentPublicListPerson,
	consentPublicListOrganization,
	consentUpdates,
	inlineKlauzula,
	rodoClause,
	privacyPolicy,
};

/** One fictional campaign, answering every question the interview asks. */
const CAMPAIGN: Record<string, string> = {
	petitionName: "Petycja o czyste powietrze",
	petitionAddressee: "Minister Klimatu i Środowiska",
	organizerLegalName: "FUNDACJA CZYSTE POWIETRZE",
	organizerName: "Fundacja Czyste Powietrze",
	organizerShortName: "Fundacja",
	organizerShortNameGen: "Fundacji",
	organizerShortNameAcc: "Fundację",
	organizerShortNameIns: "Fundacją",
	organizerStreet: "ul. Wiejska 4",
	organizerCity: "00-902 Warszawa",
	organizerKrs: "0000123456",
	organizerNip: "5252445211",
	organizerRegon: "146830233",
	contactEmail: "kontakt@czystepowietrze.pl",
	domain: "czystepowietrze.pl",
	signerOrgNoun: "firma",
	facebookUrl: "https://www.facebook.com/czystepowietrze",
	xUrl: "https://x.com/czystepowietrze",
	linkedinUrl: "https://www.linkedin.com/company/czystepowietrze",
	turnstileSiteKey: "0x4AAAAAAAsiteKeyExample",
	TURNSTILE_SECRET_KEY: "replaced-by-hand-in-a-test",
};

/** Every string in a content file, however deeply nested. */
function strings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap(strings);
	if (value && typeof value === "object") return Object.values(value).flatMap(strings);
	return [];
}

describe("a config the interview has filled in", () => {
	let root: string;
	let values: Record<string, string>;

	beforeAll(async () => {
		root = mkdtempSync(join(tmpdir(), "personalize-legal-"));
		mkdirSync(join(root, "src", "content"), { recursive: true });
		copyFileSync(resolve(ROOT, CONFIG), join(root, CONFIG));
		copyFileSync(resolve(ROOT, ".dev.vars.example"), join(root, VARS));

		await personalize(async (prompt) => CAMPAIGN[prompt.key] ?? "", root);

		values = Object.fromEntries(
			[...readFileSync(join(root, CONFIG), "utf8").matchAll(/^\t(\w+): "([^"]*)",/gm)].map(
				(match) => [match[1] ?? "", match[2] ?? ""],
			),
		);
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	const resolved = (text: string) => interpolate(text, values);

	it("reads back every answer it was given", () => {
		expect(values.petitionName).toBe(CAMPAIGN.petitionName);
		expect(values.organizerNip).toBe(CAMPAIGN.organizerNip);
		expect(values.siteUrl).toBe("https://czystepowietrze.pl");
	});

	it.each(Object.keys(LEGAL_TEXTS))("resolves every token in %s", (name) => {
		const text = resolved(LEGAL_TEXTS[name as keyof typeof LEGAL_TEXTS]);

		expect([...text.matchAll(TOKEN_PATTERN)].map((m) => m[0])).toEqual([]);
	});

	it("puts the organizer into the RODO clause a signer is shown", () => {
		const text = resolved(LEGAL_TEXTS.rodoClause);

		expect(text).toContain(CAMPAIGN.organizerLegalName);
		expect(text).toContain(CAMPAIGN.contactEmail);
	});

	// The consent beside the checkbox declines the deployment's own noun, so
	// a campaign collecting companies reads "nazwy firmy" and not "organizacji".
	it("declines the signer noun inside the public-list consent", () => {
		const text = resolved(LEGAL_TEXTS.consentPublicListOrganization);

		expect(text).toContain("nazwy firmy");
		expect(text).toContain(CAMPAIGN.petitionName);
	});

	it("puts the registered identity into the privacy policy", () => {
		const text = resolved(LEGAL_TEXTS.privacyPolicy);

		for (const key of ["organizerStreet", "organizerCity", "organizerKrs", "organizerNip"]) {
			expect(text).toContain(CAMPAIGN[key]);
		}
	});

	// The whole point of the interview: after it, nothing still says "example.org".
	it.each([
		"Nazwa petycji",
		"NAZWA ORGANIZATORA PETYCJI",
		"example.org",
		"0000000000",
	])("leaves no trace of the shipped placeholder %s", (placeholder) => {
		const texts = Object.values(LEGAL_TEXTS).map(resolved);

		expect(texts.filter((text) => text.includes(placeholder))).toEqual([]);
	});

	it.each([
		["pl", pl],
		["en", en],
	])("resolves every token the %s copy uses", (_language, file) => {
		const unresolved = strings(file)
			.map(resolved)
			.flatMap((text) => [...text.matchAll(TOKEN_PATTERN)].map((m) => m[0]));

		expect(unresolved).toEqual([]);
	});
});

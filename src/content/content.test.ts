import { contentSchema, getContent, LANGUAGES } from "./index";
import { pl } from "./pl";
import { SITE_CONFIG } from "./site-config";
import { interpolate } from "./tokens";

/**
 * The content module's contract, stated once for both languages.
 *
 * ## Assumptions this file encodes
 *
 * - **One schema.** Polish and English are two values of the same shape, not
 *   two shapes that happen to look alike. Key parity is not a separate check —
 *   it is what a strict schema means.
 * - **Tokens resolve at read time.** `getContent` returns copy the caller can
 *   render as-is; a `{{token}}` reaching the page is a bug, and so is a token
 *   the site config cannot fill.
 * - **Repeating sections are arrays** even where nothing renders them yet, so
 *   adding the fourth FAQ entry is a content edit rather than a schema change.
 * - **Not covered here**: the legal documents, which stay Polish-only and
 *   render in a later slice.
 */

/** Every string the schema holds, wherever it sits in the tree. */
function allStrings(value: unknown, path = ""): { path: string; text: string }[] {
	if (typeof value === "string") return [{ path, text: value }];
	if (Array.isArray(value)) {
		return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
	}
	if (value && typeof value === "object") {
		return Object.entries(value).flatMap(([key, item]) =>
			allStrings(item, path ? `${path}.${key}` : key),
		);
	}
	return [];
}

describe("content files", () => {
	it("ships exactly the two languages the routing serves", () => {
		expect(LANGUAGES).toEqual(["pl", "en"]);
	});

	it.each(LANGUAGES)("validates the %s content file against the schema", (language) => {
		expect(() => getContent(language)).not.toThrow();
	});

	// Parity, stated as a property rather than as a list nobody maintains: the
	// two languages are the same object shape or one of them fails to parse.
	it("gives both languages the same keys", () => {
		const keys = (language: (typeof LANGUAGES)[number]) =>
			allStrings(getContent(language))
				.map((entry) => entry.path)
				.sort();

		expect(keys("en")).toEqual(keys("pl"));
	});

	it("rejects a content file with a key missing", () => {
		const { hero: _dropped, ...withoutHero } = contentSchema.parse(getContent("en"));

		expect(() => contentSchema.parse(withoutHero)).toThrow();
	});

	it.each(LANGUAGES)("leaves no unresolved token in %s", (language) => {
		const unresolved = allStrings(getContent(language)).filter((entry) =>
			entry.text.includes("{{"),
		);

		expect(unresolved).toEqual([]);
	});

	// The placeholder identity is what makes a fresh deployment honest about
	// being a demo — the alternative is copy that reads like somebody's real
	// campaign until they notice it is not theirs.
	it("interpolates the site config into the copy the reader sees", () => {
		const rendered = allStrings(getContent("pl"))
			.map((entry) => entry.text)
			.join("\n");

		expect(rendered).toContain(SITE_CONFIG.petitionName);
	});
});

/**
 * Polish declines the noun a deployment picks for a non-personal signer, and
 * the copy has to decline it too.
 *
 * The failure this guards against is quiet: a content file that writes the
 * nominative into every slot reads correctly for *organizacja* — "nazwa
 * organizacja" is obviously wrong, but only to a Polish reader looking at a
 * deployment nobody has proofread. So the check is to run the raw copy through
 * two different nouns and assert each slot took the case it needs.
 *
 * The raw Polish file is read rather than `getContent`, because the whole point
 * is to substitute a config this deployment does not have.
 */
describe("the signer noun the deployment configures", () => {
	const NOUNS = [
		{ noun: "organizacja", gen: "organizacji", loc: "organizacji" },
		{ noun: "firma", gen: "firmy", loc: "firmie" },
	] as const;

	it.each(NOUNS)("declines $noun into every slot that needs a case", ({ noun, gen, loc }) => {
		const values = {
			...SITE_CONFIG,
			signerOrgNoun: noun,
			signerOrgNounGen: gen,
			signerOrgNounLoc: loc,
		};
		const say = (text: string) => interpolate(text, values);
		const { sign } = pl;

		expect(say(sign.signerType.organization)).toBe(noun);
		expect(say(sign.fields.companyName)).toContain(gen);
		expect(say(sign.fields.signerRole)).toContain(loc);
		expect(say(sign.errors.companyName)).toContain(gen);
	});

	it("never lets the nominative stand in for a declined slot", () => {
		const values = {
			...SITE_CONFIG,
			signerOrgNoun: "firma",
			signerOrgNounGen: "firmy",
			signerOrgNounLoc: "firmie",
		};
		const say = (text: string) => interpolate(text, values);

		// "nazwa firma" and "funkcja w firma" are what a single token produces.
		expect(say(pl.sign.fields.companyName)).not.toContain("firma");
		expect(say(pl.sign.fields.signerRole)).not.toContain("firma");
	});
});

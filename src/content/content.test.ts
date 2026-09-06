import { contentSchema, getContent, LANGUAGES } from "./index";
import { SITE_CONFIG } from "./site-config";

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

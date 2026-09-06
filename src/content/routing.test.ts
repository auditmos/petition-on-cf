import { basePath, languageFromPath, toLanguagePath } from "./routing";

/**
 * Path-based i18n, as arithmetic on a pathname.
 *
 * The switcher's promise — "same page, other language" — is this function being
 * right, so it is tested here rather than through a rendered menu. `/en` is a
 * prefix and not a word: `/energia` is a Polish page whose name happens to
 * start with those two letters, and a switcher that sent its reader to
 * `/ergia` would be a bug nobody notices until that page exists.
 */
describe("languageFromPath", () => {
	it.each([
		["/", "pl"],
		["/podpisz", "pl"],
		["/en", "en"],
		["/en/", "en"],
		["/en/sign", "en"],
		["/energia", "pl"],
		["/end", "pl"],
	])("reads %s as %s", (pathname, language) => {
		expect(languageFromPath(pathname)).toBe(language);
	});
});

describe("basePath", () => {
	it.each([
		["/", "/"],
		["/en", "/"],
		["/en/", "/"],
		["/podpisz", "/podpisz"],
		["/en/sign", "/sign"],
		["/energia", "/energia"],
	])("reduces %s to %s", (pathname, expected) => {
		expect(basePath(pathname)).toBe(expected);
	});
});

describe("toLanguagePath", () => {
	// The switcher keeps the reader where they are. Sending them to the home
	// page instead is the single most common way a language switcher is wrong.
	it.each([
		["/", "en", "/en"],
		["/", "pl", "/"],
		["/en", "pl", "/"],
		["/en", "en", "/en"],
		["/podpisz", "en", "/en/podpisz"],
		["/en/sign", "pl", "/sign"],
		["/energia", "en", "/en/energia"],
	])("maps %s into %s as %s", (pathname, language, expected) => {
		expect(toLanguagePath(pathname, language as "pl" | "en")).toBe(expected);
	});

	it("is its own inverse for either language", () => {
		const there = toLanguagePath("/podpisz", "en");

		expect(toLanguagePath(there, "pl")).toBe("/podpisz");
	});

	// A pathname carrying a query string or a fragment is still that page, and
	// the reader expects to arrive at the same place in the other language.
	it.each([
		["/?r=2", "en", "/en?r=2"],
		["/#podpisz", "en", "/en#podpisz"],
		["/en/sign?x=1#form", "pl", "/sign?x=1#form"],
	])("carries the rest of %s across to %s", (pathname, language, expected) => {
		expect(toLanguagePath(pathname, language as "pl" | "en")).toBe(expected);
	});
});

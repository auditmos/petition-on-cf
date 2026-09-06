import type { Language } from "./index";

/**
 * Where each language lives in the URL, and how to get from one to the other.
 *
 * Polish is served without a prefix because it is the default, which makes the
 * mapping asymmetric — `/podpisz` and `/en/podpisz` are the same page — and
 * asymmetric string surgery is exactly the kind of thing that ends up written
 * three slightly different ways. It is written once here: the switcher, the
 * hreflang pair and the `<html lang>` attribute all ask this module.
 */

/** The path prefix each language is served under. Polish has none. */
const PREFIX: Record<Language, string> = { pl: "", en: "/en" };

/** Splits `/en/sign?x=1#f` into its path and everything trailing it. */
function splitPath(pathname: string): { path: string; rest: string } {
	const cut = pathname.search(/[?#]/);
	return cut === -1
		? { path: pathname, rest: "" }
		: { path: pathname.slice(0, cut), rest: pathname.slice(cut) };
}

/**
 * Which language a pathname is asking for.
 *
 * Matched on the whole first segment, never as a string prefix: `/energia`
 * starts with `/en` and is Polish.
 */
export function languageFromPath(pathname: string): Language {
	const { path } = splitPath(pathname);
	return path === PREFIX.en || path.startsWith(`${PREFIX.en}/`) ? "en" : "pl";
}

/** The same page with its language prefix removed — always starts with `/`. */
export function basePath(pathname: string): string {
	const { path } = splitPath(pathname);
	if (languageFromPath(path) === "pl") return path;
	return path.slice(PREFIX.en.length) || "/";
}

/**
 * The same page, in the given language, query string and fragment intact.
 *
 * This is the switcher's whole job: a reader halfway down the sign section who
 * changes language expects to still be halfway down the sign section.
 */
export function toLanguagePath(pathname: string, language: Language): string {
	const { rest } = splitPath(pathname);
	const base = basePath(pathname);
	const prefixed = base === "/" ? PREFIX[language] || "/" : `${PREFIX[language]}${base}`;
	return `${prefixed}${rest}`;
}

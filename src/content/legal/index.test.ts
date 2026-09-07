import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getContent } from "@/content";
import { getLegalText, LEGAL_DOCUMENT_NAMES, legalDocumentPath } from "./index";

/**
 * The three things that have to agree about a legal document: the fixture, the
 * path the site config links to, and the route file that serves it.
 *
 * A consent checkbox links to `SITE_CONFIG.rodoClauseUrl`. Nothing in the type
 * system says a route answers there, so a renamed route or an edited config
 * value would ship a legal link that 404s — the kind of break nobody notices
 * because nobody clicks their own consent text. This is what notices.
 *
 * ## Assumptions this file encodes
 *
 * - **Route files are named after the path they serve**, which is how
 *   TanStack's file-based routing works: `/polityka-prywatnosci` is
 *   `src/routes/polityka-prywatnosci.tsx`, and its English twin lives under
 *   `src/routes/en/`.
 * - **Every document is announced by both language files**, so a document
 *   added without a title cannot reach a browser tab unnamed.
 */
const ROUTES = resolve(import.meta.dirname, "..", "..", "routes");

describe("legal documents", () => {
	it("names exactly the documents the content files announce", () => {
		expect([...LEGAL_DOCUMENT_NAMES].sort()).toEqual(
			Object.keys(getContent("pl").legal.documents).sort(),
		);
	});

	it.each(
		LEGAL_DOCUMENT_NAMES,
	)("%s has a route in both languages at its configured path", (name) => {
		const path = legalDocumentPath(name);
		const file = `${path.slice(1)}.tsx`;

		expect(path.startsWith("/")).toBe(true);
		expect(existsSync(resolve(ROUTES, file))).toBe(true);
		expect(existsSync(resolve(ROUTES, "en", file))).toBe(true);
	});

	it.each(LEGAL_DOCUMENT_NAMES)("%s renders with nothing left to fill in", (name) => {
		expect(getLegalText(name)).not.toMatch(/\{\{/);
	});
});

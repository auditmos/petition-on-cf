import { renderToString } from "react-dom/server";
import { LegalText } from "@/components/legal/legal-text";
import { LANGUAGES } from "@/content";
import { getLegalText, LEGAL_DOCUMENT_NAMES } from "@/content/legal";

/**
 * The legal documents, rendered the way a reader first receives them: on the
 * server, inside the runtime that actually serves them.
 *
 * The jsdom tests beside this one cover what the page does. What only workerd
 * can answer is whether the pipeline works there at all — the fixtures reach
 * the Worker as `?raw` imports, which is a build-time transform, and a
 * document that resolved under Node but arrived empty in production would be
 * an unreadable legal page nobody noticed.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is a document name and a language. No request, no database.
 * - **Output** is HTML carrying the document's own heading, its links, and no
 *   `{{token}}` — before any client JavaScript has run.
 */
function render(name: (typeof LEGAL_DOCUMENT_NAMES)[number], language: "pl" | "en"): string {
	return renderToString(<LegalText markdown={getLegalText(name)} language={language} />);
}

/** The document's own title line, as the fixture writes it. */
function documentHeading(name: (typeof LEGAL_DOCUMENT_NAMES)[number]): string {
	return (getLegalText(name).split("\n")[0] ?? "").replace(/^#\s+/, "");
}

describe.each(LEGAL_DOCUMENT_NAMES)("%s, server-rendered", (name) => {
	it.each(LANGUAGES)("carries its own heading and no unresolved token in %s", (language) => {
		const html = render(name, language);

		expect(html).toContain("<h1");
		expect(html).toContain(documentHeading(name));
		expect(html).not.toContain("{{");
	});
});

describe("links inside a server-rendered document", () => {
	it("points a Polish reader at the Polish copy of a page on this site", () => {
		expect(render("rodoClause", "pl")).not.toContain('href="/en/');
	});

	it("points an English reader at the English copy", () => {
		const html = render("privacyPolicy", "en");

		expect(html).toContain('href="/en/klauzula-informacyjna-rodo"');
	});
});

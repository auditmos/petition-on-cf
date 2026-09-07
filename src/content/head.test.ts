import { buildHead } from "./head";
import { getContent, LANGUAGES } from "./index";
import { SITE_CONFIG } from "./site-config";

/**
 * What a crawler and a shared link see, asserted on the tags themselves.
 *
 * The route files that emit these are excluded from test discovery — and
 * TanStack Start's server entry cannot boot inside the Workers pool — so the
 * head is built by a module rather than inline in the route, and that module is
 * what this drives. The route's remaining job is to call it, which is a line
 * verified by hand.
 */
function metaFor(language: (typeof LANGUAGES)[number], path = "/") {
	const { meta } = buildHead(language, path);
	return new Map(
		meta.flatMap((tag) => ("name" in tag && tag.name ? [[tag.name, tag.content ?? ""]] : [])),
	);
}

describe.each(LANGUAGES)("buildHead(%s)", (language) => {
	const content = getContent(language);

	it("titles the page in its own language", () => {
		const { meta } = buildHead(language, "/");
		const title = meta.find((tag) => "title" in tag);

		expect(title).toEqual({ title: content.meta.title });
	});

	it("describes the page in its own language, in the tags a share preview reads", () => {
		const tags = metaFor(language);

		expect(tags.get("description")).toBe(content.meta.description);
		expect(tags.get("og:title")).toBe(content.meta.title);
		expect(tags.get("og:description")).toBe(content.meta.description);
	});

	// A share preview that says `pl_PL` on an English page is the kind of wrong
	// nobody sees until somebody posts the link.
	it("declares its own locale to Open Graph", () => {
		expect(metaFor(language).get("og:locale")).toBe(content.meta.ogLocale);
	});

	it("gives Open Graph an absolute URL for this language", () => {
		const expected = language === "pl" ? `${SITE_CONFIG.siteUrl}/` : `${SITE_CONFIG.siteUrl}/en`;

		expect(metaFor(language).get("og:url")).toBe(expected);
	});
});

describe("buildHead alternates", () => {
	/**
	 * The pair has to be complete and mutual: each language names both, or a
	 * crawler treats them as two unrelated pages competing for the same query.
	 */
	it.each(LANGUAGES)("names both languages and a default from the %s page", (language) => {
		const { links } = buildHead(language, "/");
		const alternates = links.filter((link) => link.rel === "alternate");

		expect(alternates).toEqual([
			{ rel: "alternate", hreflang: "pl", href: `${SITE_CONFIG.siteUrl}/` },
			{ rel: "alternate", hreflang: "en", href: `${SITE_CONFIG.siteUrl}/en` },
			{ rel: "alternate", hreflang: "x-default", href: `${SITE_CONFIG.siteUrl}/` },
		]);
	});

	it("points the alternates at the current page, not at the home page", () => {
		const { links } = buildHead("pl", "/podpisz");

		expect(links.filter((link) => link.rel === "alternate").map((link) => link.href)).toEqual([
			`${SITE_CONFIG.siteUrl}/podpisz`,
			`${SITE_CONFIG.siteUrl}/en/podpisz`,
			`${SITE_CONFIG.siteUrl}/podpisz`,
		]);
	});

	it.each(LANGUAGES)("makes the %s page canonical for itself", (language) => {
		const { links } = buildHead(language, "/");
		const canonical = links.find((link) => link.rel === "canonical");

		expect(canonical?.href).toBe(
			language === "pl" ? `${SITE_CONFIG.siteUrl}/` : `${SITE_CONFIG.siteUrl}/en`,
		);
	});
});

/**
 * The two legal documents are pages in their own right: a reader arrives at
 * one from a consent checkbox or from a search result, and a tab titled after
 * the petition would tell them nothing about which document they opened.
 */
describe.each(LANGUAGES)("buildHead for a legal document (%s)", (language) => {
	const document = getContent(language).legal.documents.privacyPolicy;

	it("titles the page after the document, not after the petition", () => {
		const { meta } = buildHead(language, SITE_CONFIG.privacyPolicyUrl, document);

		expect(meta.find((tag) => "title" in tag)).toEqual({ title: document.title });
	});

	it("describes the document in the tags a share preview reads", () => {
		const { meta } = buildHead(language, SITE_CONFIG.privacyPolicyUrl, document);
		const tags = new Map(
			meta.flatMap((tag) => ("name" in tag && tag.name ? [[tag.name, tag.content ?? ""]] : [])),
		);

		expect(tags.get("description")).toBe(document.description);
		expect(tags.get("og:title")).toBe(document.title);
	});

	it("still points the alternates at this document in both languages", () => {
		const { links } = buildHead(language, SITE_CONFIG.privacyPolicyUrl, document);
		const alternates = links.filter(
			(link) => link.rel === "alternate" && link.hreflang !== "x-default",
		);

		expect(alternates.map((link) => link.href)).toEqual([
			`${SITE_CONFIG.siteUrl}${SITE_CONFIG.privacyPolicyUrl}`,
			`${SITE_CONFIG.siteUrl}/en${SITE_CONFIG.privacyPolicyUrl}`,
		]);
	});
});

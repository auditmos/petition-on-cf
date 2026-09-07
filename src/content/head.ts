import { getContent, LANGUAGES, type Language } from "./index";
import { toLanguagePath } from "./routing";
import { SITE_CONFIG } from "./site-config";

/**
 * The localized `<head>` for one page in one language.
 *
 * Built by a function rather than written into each route file because there
 * are two route files per page and they must not disagree: the hreflang pair is
 * only correct if both halves name both halves, and a pair assembled twice by
 * hand is a pair that drifts.
 */

type MetaTag = { title: string } | { name: string; content: string };
type LinkTag = { rel: string; hreflang?: string; href: string };

/**
 * The one address this page answers to, in one language.
 *
 * Absolute, because hreflang and Open Graph both refuse a relative path — and
 * because everything else that hands the URL to somebody else needs the same
 * one. A share button reading `window.location` would send a preview
 * deployment's hostname, or a proxy's, to somebody who cannot open it; the
 * canonical URL is what the `<head>` already promises is this page.
 */
export function canonicalUrl(path: string, language: Language): string {
	return `${SITE_CONFIG.siteUrl}${toLanguagePath(path, language)}`;
}

/** What a page says about itself, when it is not the site's own front page. */
type PageMeta = { title: string; description: string };

/**
 * `path` is the page without a language prefix — `/`, `/polityka-prywatnosci`
 * — so a route passes the same value whichever language it serves.
 *
 * `page` names a page that is not the landing page. Without it the site's own
 * title and description are used, which is right for exactly one page and
 * wrong for every legal document: a reader who opened the privacy policy from
 * a consent checkbox should see which document they opened, in the tab and in
 * a search result.
 */
export function buildHead(
	language: Language,
	path: string,
	page?: PageMeta,
): { meta: MetaTag[]; links: LinkTag[] } {
	const meta = { ...getContent(language).meta, ...page };
	const url = canonicalUrl(path, language);

	return {
		meta: [
			{ title: meta.title },
			{ name: "description", content: meta.description },
			{ name: "og:type", content: "website" },
			{ name: "og:site_name", content: SITE_CONFIG.petitionName },
			{ name: "og:title", content: meta.title },
			{ name: "og:description", content: meta.description },
			{ name: "og:locale", content: meta.ogLocale },
			{ name: "og:url", content: url },
			{ name: "twitter:card", content: "summary" },
			{ name: "twitter:title", content: meta.title },
			{ name: "twitter:description", content: meta.description },
		],
		links: [
			...LANGUAGES.map((alternate) => ({
				rel: "alternate",
				hreflang: alternate,
				href: canonicalUrl(path, alternate),
			})),
			// Polish is what a reader with no language preference gets, which is
			// the same statement as serving it without a prefix.
			{ rel: "alternate", hreflang: "x-default", href: canonicalUrl(path, "pl") },
			{ rel: "canonical", href: url },
		],
	};
}

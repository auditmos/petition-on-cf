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

/** Absolute, because hreflang and Open Graph both refuse a relative path. */
function absolute(path: string, language: Language): string {
	return `${SITE_CONFIG.siteUrl}${toLanguagePath(path, language)}`;
}

/**
 * `path` is the page without a language prefix — `/`, `/podpisz` — so a route
 * passes the same value whichever language it serves.
 */
export function buildHead(language: Language, path: string): { meta: MetaTag[]; links: LinkTag[] } {
	const { meta } = getContent(language);
	const url = absolute(path, language);

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
				href: absolute(path, alternate),
			})),
			// Polish is what a reader with no language preference gets, which is
			// the same statement as serving it without a prefix.
			{ rel: "alternate", hreflang: "x-default", href: absolute(path, "pl") },
			{ rel: "canonical", href: url },
		],
	};
}

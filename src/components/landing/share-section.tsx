import { ShareLinks } from "@/components/landing/share-links";
import type { Content, Language } from "@/content";
import { canonicalUrl } from "@/content/head";

/** The id the navigation scrolls to when a reader wants to pass the page on. */
export const SHARE_SECTION_ID = "udostepnij";

/**
 * Where a reader hands the petition to somebody else.
 *
 * The section is the copy and the layout; `ShareLinks` is the behaviour, and
 * it is the same component the floating bar renders — a reader who shares from
 * here and a reader who shares from the bar must send the same address.
 *
 * That address is the canonical URL of this page in the language being read: a
 * Polish reader must not send their friends to `/en`, and a preview deployment
 * must not share a hostname nobody else can open, which is what
 * `window.location` would have given.
 */
export function ShareSection({
	copy,
	language,
	path,
}: {
	copy: Content["share"];
	language: Language;
	/** This page without a language prefix — the same value the head is built from. */
	path: string;
}) {
	return (
		<section id={SHARE_SECTION_ID} className="border-t border-divider bg-ground py-20 sm:py-24">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>
				<p className="mt-6 max-w-2xl text-sm leading-relaxed text-quiet">{copy.note}</p>

				<div className="mt-10">
					<ShareLinks copy={copy} url={canonicalUrl(path, language)} variant="labelled" />
				</div>
			</div>
		</section>
	);
}

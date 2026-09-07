import { SignatureCount } from "@/components/counter/signature-count";
import type { Content, Language } from "@/content";

/** The id the navigation scrolls to when a reader asks how many have signed. */
export const COUNTER_SECTION_ID = "podpisy";

/**
 * The landing page's counter block.
 *
 * The count is a prop rather than something this fetches: it is read from D1 in
 * the route loader so it is present in the first server-rendered byte, which is
 * the whole point of putting a number on a petition page.
 */
export function CounterSection({
	count,
	language,
	copy,
}: {
	count: number;
	language: Language;
	copy: Content["counter"];
}) {
	return (
		<section id={COUNTER_SECTION_ID} className="border-t border-divider bg-ground py-20 sm:py-24">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>

				<div className="mt-4">
					<SignatureCount count={count} language={language} nouns={copy.nouns} />
				</div>

				<p className="mt-6 max-w-2xl text-sm leading-relaxed text-quiet">{copy.note}</p>
			</div>
		</section>
	);
}

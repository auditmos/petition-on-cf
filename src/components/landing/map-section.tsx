import { VoivodeshipMap } from "@/components/map/voivodeship-map";
import type { Content, Language } from "@/content";
import type { SignatureCounts } from "@/core/signature-counts";

/**
 * The landing page's map block.
 *
 * It sits after the form rather than beside the headline number, because the
 * two answer different questions: the counter says how many, and the map is
 * what a reader looks at once they have signed and want to know who else did.
 *
 * The counts are a prop for the same reason the count is — the loader reads
 * them from D1 on the server, so the map is shaded in the first byte the
 * browser receives rather than after a fetch.
 */
export function MapSection({
	counts,
	language,
	copy,
	nouns,
}: {
	counts: SignatureCounts;
	language: Language;
	copy: Content["map"];
	nouns: Content["counter"]["nouns"];
}) {
	return (
		<section className="border-t border-divider bg-ground py-20 sm:py-24">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>
				<p className="mt-6 max-w-2xl text-sm leading-relaxed text-quiet">{copy.note}</p>

				<div className="mt-14">
					<VoivodeshipMap counts={counts} language={language} copy={copy} nouns={nouns} />
				</div>
			</div>
		</section>
	);
}

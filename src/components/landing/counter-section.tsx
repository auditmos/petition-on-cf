import { LastSignature } from "@/components/counter/last-signature";
import { SignatureCount } from "@/components/counter/signature-count";
import type { Content, Language } from "@/content";
import type { SignatureCounts } from "@/core/signature-counts";

/** The id the navigation scrolls to when a reader asks how many have signed. */
export const COUNTER_SECTION_ID = "podpisy";

/**
 * The landing page's counter block: how many have signed, and how long ago the
 * last of them did.
 *
 * Both are props rather than something this fetches: they are read from D1 in
 * the route loader so they are present in the first server-rendered byte, which
 * is the whole point of putting a number on a petition page. The whole
 * `SignatureCounts` arrives rather than the total alone, because the two
 * figures answer one question between them — a number that is moving and the
 * tempo it is moving at — and reading them off one object is what stops them
 * being updated a moment apart.
 *
 * The tempo is here and not in the floating bar. The bar is 375 px wide on a
 * phone and already carries a number and a call to action; a second sentence in
 * it would push one of those off.
 */
export function CounterSection({
	counts,
	language,
	copy,
}: {
	counts: SignatureCounts;
	language: Language;
	copy: Content["counter"];
}) {
	return (
		<section id={COUNTER_SECTION_ID} className="border-t border-divider bg-ground py-20 sm:py-24">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>

				<div className="mt-4">
					<SignatureCount count={counts.total} language={language} nouns={copy.nouns} />
				</div>

				{/*
				 * The key is the reset, and it is load-bearing. The label counts on
				 * from the duration it was given, so every push has to hand it a
				 * fresh stopwatch — and a push cannot be recognised by the duration
				 * alone, because two signatures a few seconds apart are both "0
				 * seconds ago". Naming the measurement — this many signatures, this
				 * long since the last — is what makes the second of them a new
				 * component rather than the first one's props changed to the same
				 * value. Without it a steadily signed petition reports a tempo that
				 * falls further behind the counter beside it with every signature.
				 */}
				<LastSignature
					key={`${counts.total}:${counts.secondsSinceLastSignature}`}
					secondsAgo={counts.secondsSinceLastSignature}
					language={language}
					label={copy.lastSignature}
				/>

				<p className="mt-6 max-w-2xl text-sm leading-relaxed text-quiet">{copy.note}</p>
			</div>
		</section>
	);
}

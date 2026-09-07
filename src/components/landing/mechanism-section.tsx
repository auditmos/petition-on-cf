import type { Content } from "@/content";

/** The id the navigation scrolls to when a reader asks what is being demanded. */
export const MECHANISM_SECTION_ID = "postulaty";

/**
 * What the petition asks for.
 *
 * The demands are an ordered list rather than paragraphs because a signature
 * is agreement to specific asks, and a reader has to be able to point at the
 * second one. Numbering them is the section's whole layout decision: the
 * figure carries the order, the title carries the ask, and the paragraph under
 * it is what a campaign uses to justify the ask rather than to restate it.
 */
export function MechanismSection({ copy }: { copy: Content["mechanism"] }) {
	return (
		<section id={MECHANISM_SECTION_ID} className="border-t border-divider bg-ground py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>
				<p className="mt-6 max-w-2xl text-base leading-relaxed text-quiet">{copy.lede}</p>

				<ol className="mt-14 space-y-8">
					{copy.demands.map((demand, index) => (
						<li key={demand.title} className="flex gap-5 sm:gap-8">
							<span
								aria-hidden="true"
								className="font-display text-3xl tabular-nums leading-none text-brand sm:text-4xl"
							>
								{index + 1}
							</span>
							<div className="max-w-3xl">
								<h3 className="text-lg text-ink sm:text-xl">{demand.title}</h3>
								<p className="mt-2 text-sm leading-relaxed text-quiet">{demand.description}</p>
							</div>
						</li>
					))}
				</ol>

				<p className="mt-14 max-w-2xl border-l-2 border-brand-soft-border pl-4 text-sm leading-relaxed text-quiet">
					{copy.note}
				</p>
			</div>
		</section>
	);
}

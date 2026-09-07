import type { Content } from "@/content";

/** The id the navigation scrolls to when a reader asks for the evidence. */
export const STATS_SECTION_ID = "dowody";

/**
 * The evidence: the figures a visitor is asked to act on.
 *
 * Every one of them carries the line that says where it came from, and that is
 * not a nicety — a petition is a claim about the world, and a number nobody
 * can trace is the part of the claim a sceptical reader stops at. The schema
 * makes `source` mandatory so no content file can ship a figure without one;
 * this component only has to render it where the eye lands after the figure.
 *
 * The source is a link when the content file gave a URL and plain text when it
 * did not, because some evidence is a page in a printed report and pretending
 * otherwise would mean either a dead link or a missing citation.
 */
export function StatsSection({ copy }: { copy: Content["stats"] }) {
	return (
		<section id={STATS_SECTION_ID} className="border-t border-divider bg-paper py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>

				<dl className="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2">
					{copy.facts.map((fact) => (
						<div key={fact.label}>
							<dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<span className="font-display text-4xl tabular-nums text-brand sm:text-5xl">
									{fact.figure}
								</span>
								<span className="text-base font-semibold text-ink">{fact.label}</span>
							</dt>
							<dd className="mt-3 text-sm leading-relaxed text-quiet">{fact.note}</dd>
							<dd className="mt-2 text-xs leading-relaxed text-quiet">
								{copy.sourceLead}:{" "}
								{fact.sourceUrl ? (
									<a
										href={fact.sourceUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="underline underline-offset-2 transition-colors hover:text-brand-dark"
									>
										{fact.source}
									</a>
								) : (
									fact.source
								)}
							</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}

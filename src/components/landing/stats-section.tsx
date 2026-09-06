import type { Content } from "@/content";

export function StatsSection({ copy }: { copy: Content["stats"] }) {
	return (
		<section className="border-t border-divider bg-paper py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>

				<dl className="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2">
					{copy.facts.map((fact) => (
						<div key={fact.label}>
							<dt className="flex items-baseline gap-3">
								<span className="font-display text-4xl tabular-nums text-brand sm:text-5xl">
									{fact.figure}
								</span>
								<span className="text-base font-semibold text-ink">{fact.label}</span>
							</dt>
							<dd className="mt-3 text-sm leading-relaxed text-quiet">{fact.note}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}

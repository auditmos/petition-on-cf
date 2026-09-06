import type { Content } from "@/content";

export function HowItWorksSection({ copy }: { copy: Content["howItWorks"] }) {
	return (
		<section id="start" className="border-t border-divider bg-paper py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>

				<div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
					{copy.paths.map((path) => (
						<article key={path.title} className="rounded-xl border border-divider bg-ground p-8">
							<p className="text-xs font-medium uppercase tracking-wider text-brand">
								{path.step} · {path.phase}
							</p>
							<h3 className="mt-3 text-xl text-ink">{path.title}</h3>
							<ol className="mt-6 space-y-4">
								{path.steps.map((step, index) => (
									<li key={step} className="flex gap-4">
										<span className="font-display text-lg tabular-nums leading-6 text-brand">
											{index + 1}
										</span>
										<span className="text-sm leading-relaxed text-quiet">{step}</span>
									</li>
								))}
							</ol>
						</article>
					))}
				</div>

				<div id="architektura" className="mt-20 border-t border-divider pt-14">
					<p className="text-xs font-medium uppercase tracking-wider text-quiet">
						{copy.architecture.eyebrow}
					</p>
					<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.architecture.heading}</h2>

					<dl className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
						{copy.architecture.rules.map((rule) => (
							<div key={rule.term}>
								<dt className="text-base font-semibold text-ink">{rule.term}</dt>
								<dd className="mt-2 text-sm leading-relaxed text-quiet">{rule.definition}</dd>
							</div>
						))}
					</dl>
				</div>
			</div>
		</section>
	);
}

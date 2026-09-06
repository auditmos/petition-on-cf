import {
	FileText,
	Globe,
	ListChecks,
	Map as MapIcon,
	PenLine,
	Radio,
	ShieldCheck,
	Table2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Content } from "@/content";

/**
 * Icons are components, so they stay in the component; the content file names
 * one with a `key` and says nothing about how it is drawn.
 */
const ICONS = {
	form: PenLine,
	live: Radio,
	map: MapIcon,
	bots: ShieldCheck,
	list: ListChecks,
	legal: FileText,
	i18n: Globe,
	data: Table2,
} as const;

export function FeaturesSection({ copy }: { copy: Content["features"] }) {
	return (
		<section id="funkcje" className="border-t border-divider bg-ground py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>
				<p className="mt-4 max-w-2xl text-base leading-relaxed text-quiet">{copy.lede}</p>

				<div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
					{copy.items.map((feature) => {
						const Icon = ICONS[feature.key as keyof typeof ICONS] ?? PenLine;
						return (
							<article key={feature.key} className="rounded-xl border border-divider bg-paper p-6">
								<div className="flex items-start justify-between gap-4">
									<div className="flex items-center gap-3">
										<Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
										<h3 className="text-lg text-ink">{feature.title}</h3>
									</div>
									<Badge
										variant="outline"
										className="shrink-0 border-brand-soft-border bg-brand-soft text-xs font-medium text-brand-dark"
									>
										{feature.phase}
									</Badge>
								</div>
								<p className="mt-4 text-sm leading-relaxed text-quiet">{feature.description}</p>
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}

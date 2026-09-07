import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Content } from "@/content";

/** The id the navigation scrolls to when a reader has a doubt. */
export const FAQ_SECTION_ID = "pytania";

/**
 * The doubts a visitor has before signing, answered on the page.
 *
 * Folded rather than laid out, because a reader with one question should not
 * have to read five answers to reach it — and because the questions read as a
 * list of what the campaign knows people worry about, which is itself
 * reassuring.
 *
 * Each entry opens on its own. The alternative — one open at a time — closes
 * an answer the reader may still be comparing against, and buys nothing but a
 * tidier page.
 *
 * The control is a `button` rather than a styled `div`, which is the whole of
 * the keyboard story: focus, Enter and Space come from the element, and the
 * `aria-expanded` Radix keeps on it is what a screen reader reads out.
 */
export function FaqSection({ copy }: { copy: Content["faq"] }) {
	return (
		<section id={FAQ_SECTION_ID} className="border-t border-divider bg-paper py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>

				<dl className="mt-12 max-w-3xl divide-y divide-divider border-y border-divider">
					{copy.items.map((item) => (
						<Collapsible key={item.question} asChild>
							<div className="py-2">
								<dt>
									<CollapsibleTrigger className="group flex w-full items-start justify-between gap-6 py-4 text-left text-base font-medium text-ink transition-colors hover:text-brand-dark">
										{item.question}
										<ChevronDown
											aria-hidden="true"
											className="mt-1 h-4 w-4 shrink-0 text-quiet transition-transform group-data-[state=open]:rotate-180"
										/>
									</CollapsibleTrigger>
								</dt>
								<CollapsibleContent asChild>
									<dd className="pb-5 pr-10 text-sm leading-relaxed text-quiet">{item.answer}</dd>
								</CollapsibleContent>
							</div>
						</Collapsible>
					))}
				</dl>

				<p className="mt-10 max-w-3xl text-sm leading-relaxed text-quiet">{copy.note}</p>
			</div>
		</section>
	);
}

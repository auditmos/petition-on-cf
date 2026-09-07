import { ArrowRight, PenLine } from "lucide-react";
import { MECHANISM_SECTION_ID } from "@/components/landing/mechanism-section";
import { focusSignForm, SIGN_SECTION_ID } from "@/components/landing/sign-section";
import { Button } from "@/components/ui/button";
import type { Content } from "@/content";

/**
 * The id the floating bar watches. It reveals itself when this section is no
 * longer on screen, so the two have to agree on one string and this is where
 * it is written.
 */
export const HERO_SECTION_ID = "hero";

/**
 * The first screen: what the petition asks for, and the way to sign it.
 *
 * The primary call to action stays an ordinary anchor to the form, so it works
 * with scripting off and survives being copied as a link. What the click adds
 * on top is the focus move — a reader who asked to sign should find the cursor
 * in the form rather than at the top of a page that merely scrolled.
 */
export function HeroSection({ copy }: { copy: Content["hero"] }) {
	return (
		<section
			id={HERO_SECTION_ID}
			className="bg-gradient-to-br from-brand-deep via-brand-dark to-brand text-white"
		>
			<div className="mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:px-8">
				<p className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-white/70">
					<span aria-hidden="true" className="h-px w-8 bg-white/50" />
					{copy.eyebrow}
				</p>

				<h1 className="mt-6 max-w-3xl text-4xl leading-tight sm:text-5xl lg:text-6xl">
					{copy.headline}
				</h1>

				<p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">{copy.lede}</p>

				<div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
					<Button
						size="lg"
						asChild
						className="group bg-white text-brand-dark hover:bg-white/90 hover:text-brand-deep"
					>
						<a
							href={`#${SIGN_SECTION_ID}`}
							onClick={(event) => {
								event.preventDefault();
								focusSignForm();
							}}
						>
							<PenLine className="mr-2 h-4 w-4" />
							{copy.primaryCta}
						</a>
					</Button>

					<a
						href={`#${MECHANISM_SECTION_ID}`}
						className="group inline-flex items-center self-start border-b border-white/40 pb-1 text-sm font-medium text-white transition-colors hover:border-white sm:self-auto"
					>
						{copy.secondaryCta}
						<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
					</a>
				</div>

				<p className="mt-12 max-w-2xl border-l-2 border-white/30 pl-4 text-sm leading-relaxed text-white/70">
					<strong className="font-semibold text-white">{copy.noteLead}</strong> {copy.note}
				</p>
			</div>
		</section>
	);
}

import { useEffect, useState } from "react";
import { formatCount } from "@/components/counter/signature-count";
import { Button } from "@/components/ui/button";
import type { Content, Language } from "@/content";

/**
 * The bar that follows the reader down the page: the live count, and a way
 * back to the form from wherever they got to.
 *
 * It is absent rather than hidden while the hero is on screen. At the top of
 * the page the form's own call to action is right there, so a second one would
 * be a bar covering the page to repeat what the page already says — and a
 * hidden element would still be in the tab order and still be read out.
 *
 * What reveals it is the hero leaving the viewport, watched with an
 * `IntersectionObserver` rather than measured off `scrollY`. The hero's height
 * is whatever the copy in it happens to need, in whichever language, at
 * whichever width; a pixel threshold would be a guess that is wrong on a phone
 * or wrong on a desktop and could not be right on both.
 */
export function FloatingBar({
	count,
	language,
	copy,
	watching,
}: {
	count: number;
	language: Language;
	copy: Content;
	/** Id of the element whose leaving the screen brings the bar in. */
	watching: string;
}) {
	const [past, setPast] = useState(false);

	useEffect(() => {
		const anchor = document.getElementById(watching);
		if (!anchor) return;

		const observer = new IntersectionObserver(([entry]) => {
			if (entry) setPast(!entry.isIntersecting);
		});

		observer.observe(anchor);
		return () => observer.disconnect();
	}, [watching]);

	if (!past) return null;

	const { figure, noun } = formatCount(count, language, copy.counter.nouns);

	return (
		<aside
			aria-label={copy.floatingBar.label}
			className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-paper/95 backdrop-blur"
		>
			<div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 lg:px-8">
				{/*
				 * Not a live region, deliberately. The counter section's own
				 * `output` announces the number when it moves, and a second live
				 * region showing the same value would announce every signature
				 * twice.
				 */}
				<p className="flex items-baseline gap-2">
					<span
						data-testid="floating-bar-figure"
						className="font-display text-2xl tabular-nums text-brand"
					>
						{figure}
					</span>
					<span data-testid="floating-bar-noun" className="text-sm text-quiet">
						{noun}
					</span>
				</p>

				<Button asChild size="sm">
					<a href={`#${SIGN_SECTION_ID}`}>{copy.floatingBar.cta}</a>
				</Button>
			</div>
		</aside>
	);
}

/** Where the bar's call to action goes. The sign section answers to this id. */
const SIGN_SECTION_ID = "podpisz";

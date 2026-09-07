import { useEffect, useState } from "react";
import { formatCount } from "@/components/counter/signature-count";
import { ShareLinks } from "@/components/landing/share-links";
import { SIGN_SECTION_ID } from "@/components/landing/sign-section";
import { Button } from "@/components/ui/button";
import type { Content, Language } from "@/content";
import { canonicalUrl } from "@/content/head";

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
	path,
}: {
	count: number;
	language: Language;
	copy: Content;
	/** Id of the element whose leaving the screen brings the bar in. */
	watching: string;
	/** This page without a language prefix, for the links that share it. */
	path: string;
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
		<>
			{/*
			 * The footprint, given back to the page.
			 *
			 * A fixed element is out of flow, so at the end of the document the
			 * bar would sit on top of the last strip of the footer with no
			 * further scroll to bring it out. Mid-page that is harmless — a
			 * reader scrolls another inch — but the end of the page has no
			 * further inch. The spacer is rendered here rather than as padding
			 * on the page because the height belongs to the bar: one constant,
			 * one file, nothing to keep in sync.
			 */}
			<div aria-hidden="true" data-testid="floating-bar-spacer" className={BAR_HEIGHT} />

			<aside
				aria-label={copy.floatingBar.label}
				className={`fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-paper/95 backdrop-blur ${BAR_HEIGHT}`}
			>
				<div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
					{/*
					 * Not a live region, deliberately. The counter section's own
					 * `output` announces the number when it moves, and a second live
					 * region showing the same value would announce every signature
					 * twice.
					 */}
					{/*
					 * `shrink-0`: the count is the one thing in the row that must not
					 * give way. Left shrinkable it is squeezed to a few pixels by the
					 * icons beside it on a narrow screen — a bar whose whole left-hand
					 * job is to show a number, showing a sliver of one.
					 */}
					<p className="flex shrink-0 items-baseline gap-2 whitespace-nowrap">
						<span
							data-testid="floating-bar-figure"
							className="font-display text-2xl tabular-nums text-brand"
						>
							{figure}
						</span>
						{/*
						 * The noun is the first thing to go on a narrow screen. The
						 * figure beside a count of signatures is legible without it,
						 * and the room it frees is what lets the share icons ride
						 * along on a phone — which is where a shared link mostly gets
						 * opened in the first place.
						 */}
						<span
							data-testid="floating-bar-noun"
							className="hidden truncate text-sm text-quiet sm:inline"
						>
							{noun}
						</span>
					</p>

					<div className="flex shrink-0 items-center gap-1 sm:gap-3">
						<ShareLinks copy={copy.share} url={canonicalUrl(path, language)} variant="compact" />

						<Button asChild size="sm" className="shrink-0">
							<a href={`#${SIGN_SECTION_ID}`}>{copy.floatingBar.cta}</a>
						</Button>
					</div>
				</div>
			</aside>
		</>
	);
}

/**
 * The bar's height, and therefore the space it gives back.
 *
 * Stated rather than left to the content, because the spacer above has to
 * match it and two elements agreeing by coincidence is not agreement. The row
 * is held to one line — `whitespace-nowrap` on the count, `shrink-0` on the
 * button — so a long figure or a long translation cannot wrap the bar taller
 * than the space it reserved.
 */
const BAR_HEIGHT = "h-16";

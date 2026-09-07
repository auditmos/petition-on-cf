import { useEffect, useState } from "react";
import type { Language } from "@/content";

/**
 * How often the line re-reads its own clock, in milliseconds.
 *
 * It is written in minutes, so this only has to be short enough that a reader
 * watching the boundary does not catch it lying for long. Fifteen seconds
 * re-renders one paragraph four times a minute, which costs nothing next to
 * being the one part of a live page that has visibly stopped.
 */
const TICK_MS = 15_000;

/** Seconds in the units the sentence is allowed to use. */
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * The petition's tempo, beside its total: "Ostatni podpis 5 minut temu".
 *
 * `secondsAgo` is a duration D1 measured, not an instant — see
 * `SignatureCounts`. That is what makes this component safe to server-render:
 * its first render performs no subtraction against a clock, so the markup the
 * browser receives and the markup it produces while hydrating are the same
 * markup, whatever the reader's machine believes the time to be. Only after
 * mounting does it start counting on, and only from its own starting point, so
 * a wrong system clock cannot make a signature look older than it is or place
 * it in the future.
 *
 * Every push resets it. A page that nothing is happening to still moves,
 * because the alternative is a live page with one dead line in it.
 *
 * The words are `Intl`'s. Polish takes three forms of "minuta" depending on the
 * number in front of it and English takes two, and asking the platform for them
 * is what keeps that out of the content files — which would otherwise need a
 * plural table per unit rather than the one `counter.nouns` already has.
 */
export function LastSignature({
	secondsAgo,
	language,
	label,
}: {
	/** Seconds since the newest signature, or null if there has been none. */
	secondsAgo: number | null;
	language: Language;
	label: string;
}) {
	const elapsed = useElapsed(secondsAgo);

	// A petition nobody has signed has no tempo, and a "0 seconds ago" beside a
	// zero would describe a signature that does not exist.
	if (elapsed === null) return null;

	return (
		<p data-testid="last-signature" className="mt-4 text-sm text-quiet">
			{label} {relativeTime(elapsed, language)}
		</p>
	);
}

/**
 * The duration, counted on from where the server left it.
 *
 * `drift` is zero on the first render — the server's and the browser's alike —
 * which is the whole hydration contract. It is measured from the moment this
 * component was given `base` rather than from any absolute time, so the only
 * clock involved is a stopwatch, and a stopwatch cannot be set wrong.
 *
 * The stopwatch runs for the life of the component and is never restarted,
 * because one component is one measurement: the caller keys this component on
 * the measurement it is describing, so a push delivers a new instance rather
 * than new props. That is deliberate rather than incidental — an effect that
 * restarted on a changed `secondsAgo` would miss the case that matters, two
 * signatures inside one second, which are both measured as zero.
 */
function useElapsed(base: number | null): number | null {
	const [drift, setDrift] = useState(0);

	useEffect(() => {
		setDrift(0);
		const from = Date.now();
		const tick = setInterval(() => setDrift(Math.round((Date.now() - from) / 1000)), TICK_MS);
		return () => clearInterval(tick);
	}, []);

	return base === null ? null : base + drift;
}

/**
 * "5 minut temu", "yesterday" — the largest unit the duration fills.
 *
 * `numeric: "auto"` is what turns nothing at all into "teraz" rather than
 * "0 sekund temu", and a day into "wczoraj". Both read as a person would say
 * them, which is the point of putting the line on the page.
 */
function relativeTime(seconds: number, language: Language): string {
	const say = new Intl.RelativeTimeFormat(language, { numeric: "auto" });

	if (seconds < MINUTE) return say.format(-seconds, "second");
	if (seconds < HOUR) return say.format(-Math.floor(seconds / MINUTE), "minute");
	if (seconds < DAY) return say.format(-Math.floor(seconds / HOUR), "hour");
	return say.format(-Math.floor(seconds / DAY), "day");
}

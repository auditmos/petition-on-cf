import type { Content, Language } from "@/content";

/**
 * The petition's headline number.
 *
 * Presentational on purpose: the count arrives as a prop, so the same component
 * serves the server-rendered first paint and — once issue #7 lands the
 * `LiveCounter` Durable Object — a value pushed over a WebSocket. Nothing here
 * knows where the number came from.
 *
 * The noun beside it is a lookup rather than a string with an `s` appended:
 * Polish picks between three forms by the last two digits, so "5 podpisów" and
 * "22 podpisy" are both regular. `Intl.PluralRules` decides which form; the
 * content file supplies it. Grouping separators come from `Intl` too, which is
 * why the language reaches this component at all.
 */
export function SignatureCount({
	count,
	language,
	nouns,
}: {
	count: number;
	language: Language;
	nouns: Content["counter"]["nouns"];
}) {
	const figure = new Intl.NumberFormat(language).format(count);
	const noun = nouns[new Intl.PluralRules(language).select(count)];

	return (
		// `output` carries an implicit `status` role, so the count is announced
		// without the element claiming a role it does not have.
		<output
			aria-live="polite"
			className="flex items-baseline gap-3 font-display text-5xl tabular-nums text-brand sm:text-6xl"
		>
			<span data-testid="signature-count-figure">{figure}</span>
			<span data-testid="signature-count-noun" className="text-2xl sm:text-3xl">
				{noun}
			</span>
		</output>
	);
}

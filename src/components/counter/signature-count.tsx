/**
 * The petition's headline number.
 *
 * Presentational on purpose: the count arrives as a prop, so the same component
 * serves the server-rendered first paint and — once issue #7 lands the
 * `LiveCounter` Durable Object — a value pushed over a WebSocket. Nothing here
 * knows where the number came from.
 */

const FIGURE_FORMAT = new Intl.NumberFormat("pl-PL");
const PLURAL_RULES = new Intl.PluralRules("pl-PL");

/** Polish picks between three forms of the noun; `other` never fires for integers. */
const NOUN: Record<Intl.LDMLPluralRule, string> = {
	zero: "podpisów",
	one: "podpis",
	two: "podpisy",
	few: "podpisy",
	many: "podpisów",
	other: "podpisów",
};

export function SignatureCount({ count }: { count: number }) {
	return (
		// `output` carries an implicit `status` role, so the count is announced
		// without the element claiming a role it does not have.
		<output
			aria-live="polite"
			className="flex items-baseline gap-3 font-display text-5xl tabular-nums text-brand sm:text-6xl"
		>
			<span data-testid="signature-count-figure">{FIGURE_FORMAT.format(count)}</span>
			<span data-testid="signature-count-noun" className="text-2xl sm:text-3xl">
				{NOUN[PLURAL_RULES.select(count)]}
			</span>
		</output>
	);
}

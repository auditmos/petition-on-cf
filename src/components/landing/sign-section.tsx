import { SignatureForm } from "@/components/signature-form";
import type { Content, Language } from "@/content";

/**
 * The id everything that sends a reader to the form points at: the hero's call
 * to action, the floating bar's, and the navigation. Written here because this
 * is the section that answers to it.
 */
export const SIGN_SECTION_ID = "podpisz";

/**
 * Send the reader to the form and give it the cursor.
 *
 * An anchor alone lands the page beside the form but leaves focus where it
 * was, so a reader who arrived by keyboard would have to tab back through
 * everything they just scrolled past. Focus moves first and without scrolling
 * of its own — `preventScroll`, because focusing an input jumps the page and
 * would fight the smooth scroll below.
 *
 * The section is the fallback target for a form that currently shows no field:
 * after a successful signature it is a thank-you, and focus still belongs
 * where the reader was sent.
 */
export function focusSignForm(): void {
	const section = document.getElementById(SIGN_SECTION_ID);
	if (!section) return;

	const field = section.querySelector<HTMLElement>("input, select, textarea");
	(field ?? section).focus({ preventScroll: true });
	section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Where the page asks for the signature.
 *
 * The section is the copy and the layout; the form is the behaviour. Keeping
 * them apart is what lets one be translated without the other being touched.
 */
export function SignSection({
	copy,
	legal,
	language,
}: {
	copy: Content["sign"];
	legal: Content["legal"];
	language: Language;
}) {
	return (
		<section
			id={SIGN_SECTION_ID}
			// Focusable only as a target: the fallback above hands it the cursor
			// when the form has no field to take it, and a reader who follows the
			// `#podpisz` anchor lands on it rather than at the top of the document.
			tabIndex={-1}
			className="border-t border-divider bg-paper py-20 outline-none sm:py-24"
		>
			<div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:px-8">
				<div>
					<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
					<h2 className="mt-3 text-3xl sm:text-4xl">{copy.heading}</h2>
					<p className="mt-4 max-w-xl text-base leading-relaxed text-quiet">{copy.lede}</p>
					<p className="mt-4 max-w-xl text-sm leading-relaxed text-quiet">{copy.note}</p>
				</div>

				<div className="lg:max-w-md">
					<SignatureForm copy={copy} legal={legal} language={language} />
				</div>
			</div>
		</section>
	);
}

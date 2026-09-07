import { SignatureForm } from "@/components/signature-form";
import type { Content, Language } from "@/content";

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
		<section id="podpisz" className="border-t border-divider bg-paper py-20 sm:py-24">
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

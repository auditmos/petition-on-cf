import { SignatureCount } from "@/components/counter/signature-count";

/**
 * The landing page's counter block.
 *
 * The count is a prop rather than something this fetches: it is read from D1 in
 * the route loader so it is present in the first server-rendered byte, which is
 * the whole point of putting a number on a petition page.
 */
export function CounterSection({ count }: { count: number }) {
	return (
		<section className="border-t border-divider bg-ground py-20 sm:py-24">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">
					Poparcie dla tej sprawy
				</p>

				<div className="mt-4">
					<SignatureCount count={count} />
				</div>

				<p className="mt-6 max-w-2xl text-sm leading-relaxed text-quiet">
					Liczba pochodzi wprost z bazy podpisów tego wdrożenia i jest wyliczana przy każdym wejściu
					na stronę. Formularz podpisu powstaje w kolejnym etapie — dopóki go nie ma, licznik
					pokazuje zero.
				</p>
			</div>
		</section>
	);
}

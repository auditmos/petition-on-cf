const facts = [
	{
		figure: "1",
		label: "wdrożenie = jedna petycja",
		note: "Model danych nie zna pojęcia „wiele petycji”. Druga sprawa to druga kopia repozytorium — dzięki temu nie ma panelu, kont ani wspólnej bazy, którą trzeba pilnować.",
	},
	{
		figure: "2",
		label: "języki treści: polski i angielski",
		note: "Adres główny prowadzi na wersję polską, prefiks /en na angielską. Dokumenty prawne zostają po polsku, z wyraźną informacją o tym po angielsku.",
	},
	{
		figure: "0",
		label: "usług spoza Cloudflare",
		note: "Baza D1, Durable Object i Turnstile — nic poza tym. Szablon nigdy nie wysyła e-maili, więc nie potrzebuje dostawcy poczty ani domeny nadawcy.",
	},
	{
		figure: "3",
		label: "zgody przy podpisie",
		note: "Obowiązkowe potwierdzenie zapoznania się z klauzulą RODO oraz dwie zgody dobrowolne: na publiczną listę poparcia i na wiadomości o przebiegu sprawy.",
	},
];

export function StatsSection() {
	return (
		<section className="border-t border-divider bg-paper py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">
					Najważniejsze założenia
				</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">
					Cztery decyzje, które opisują ten szablon
				</h2>

				<dl className="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2">
					{facts.map((fact) => (
						<div key={fact.label}>
							<dt className="flex items-baseline gap-3">
								<span className="font-display text-4xl tabular-nums text-brand sm:text-5xl">
									{fact.figure}
								</span>
								<span className="text-base font-semibold text-ink">{fact.label}</span>
							</dt>
							<dd className="mt-3 text-sm leading-relaxed text-quiet">{fact.note}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}

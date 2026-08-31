const paths = [
	{
		step: "Droga pierwsza",
		title: "Wdrożenie jednym kliknięciem",
		phase: "Faza 11",
		steps: [
			"Przycisk „Deploy to Cloudflare” kopiuje repozytorium na Twoje konto GitHub.",
			"Cloudflare zakłada bazę D1 i Durable Object na podstawie pliku konfiguracyjnego — bez klikania w panelu.",
			"Migracje bazy wykonują się w ramach wdrożenia, więc świeża instalacja nigdy nie startuje bez tabel.",
			"Strona działa od razu na testowych kluczach Turnstile: można podpisać się na próbę, zanim pojawią się prawdziwe klucze.",
		],
	},
	{
		step: "Droga druga",
		title: "Dostosowanie do swojej sprawy",
		phase: "Faza 10",
		steps: [
			"Sklonuj swoją kopię repozytorium i uruchom skrypt personalizacji.",
			"Odpowiedz na pytania o nazwę petycji, organizatora, adresata, adres kontaktowy i domenę.",
			"Wartości publiczne trafiają do pliku konfiguracyjnego, klucz prywatny Turnstile — wyłącznie do lokalnego pliku sekretów.",
			"Wypchnij zmiany: dalsze wdrożenia robi już CI. Ponowne uruchomienie skryptu niczego nie nadpisuje.",
		],
	},
];

const architecture = [
	{
		term: "Baza D1 jest jedynym źródłem prawdy",
		definition:
			"Durable Object służy tylko za pamięć podręczną i nadajnik — po restarcie odtwarza liczniki z bazy i nigdy do niej nie zapisuje.",
	},
	{
		term: "Zapis idzie w jedną stronę",
		definition:
			"Worker sprawdza zgłoszenie, zapisuje je w bazie, a dopiero potem powiadamia Durable Object, nie czekając na odpowiedź. Powtórzone adresy odsiewa ograniczenie unikalności w samej bazie.",
	},
	{
		term: "W komponentach nie ma żadnych tekstów",
		definition:
			"Cała treść mieszka w plikach dla poszczególnych języków, sprawdzanych wspólnym schematem. Brak tłumaczenia zatrzymuje budowanie, a nie użytkownika na produkcji.",
	},
	{
		term: "Nie ma logowania ani panelu",
		definition:
			"Strona jest w całości publiczna. Organizator sięga po dane gotowymi zapytaniami z wiersza poleceń, więc nie istnieje konto, które można przejąć.",
	},
];

export function HowItWorksSection() {
	return (
		<section id="start" className="border-t border-divider bg-paper py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">Uruchomienie</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">Od kliknięcia do własnej petycji</h2>

				<div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
					{paths.map((path) => (
						<article key={path.title} className="rounded-xl border border-divider bg-ground p-8">
							<p className="text-xs font-medium uppercase tracking-wider text-brand">
								{path.step} · {path.phase}
							</p>
							<h3 className="mt-3 text-xl text-ink">{path.title}</h3>
							<ol className="mt-6 space-y-4">
								{path.steps.map((step, index) => (
									<li key={step} className="flex gap-4">
										<span className="font-display text-lg tabular-nums leading-6 text-brand">
											{index + 1}
										</span>
										<span className="text-sm leading-relaxed text-quiet">{step}</span>
									</li>
								))}
							</ol>
						</article>
					))}
				</div>

				<div id="architektura" className="mt-20 border-t border-divider pt-14">
					<p className="text-xs font-medium uppercase tracking-wider text-quiet">Architektura</p>
					<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">
						Cztery zasady, od których nie ma odstępstw
					</h2>

					<dl className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
						{architecture.map((rule) => (
							<div key={rule.term}>
								<dt className="text-base font-semibold text-ink">{rule.term}</dt>
								<dd className="mt-2 text-sm leading-relaxed text-quiet">{rule.definition}</dd>
							</div>
						))}
					</dl>
				</div>
			</div>
		</section>
	);
}

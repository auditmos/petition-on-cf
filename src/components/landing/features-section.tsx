import {
	FileText,
	Globe,
	ListChecks,
	Map as MapIcon,
	PenLine,
	Radio,
	ShieldCheck,
	Table2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const features = [
	{
		icon: PenLine,
		title: "Formularz podpisu",
		phase: "Faza 2 i 7",
		description:
			"Imię, nazwisko, adres e-mail i miejscowość, wybór między osobą prywatną a firmą oraz trzy pola zgód. Adres e-mail jest kluczem, po którym rozpoznawany jest ponowny podpis — kto podpisał drugi raz, dostaje życzliwy komunikat zamiast błędu.",
	},
	{
		icon: Radio,
		title: "Licznik podpisów na żywo",
		phase: "Faza 5",
		description:
			"Durable Object trzyma bieżące liczby i rozsyła je przez WebSocket, łącząc powiadomienia do jednego na sekundę. Gdy połączenie nie dojdzie do skutku, strona po cichu przechodzi na cykliczne odpytywanie i nigdy nie wygląda na zepsutą.",
	},
	{
		icon: MapIcon,
		title: "Mapa poparcia",
		phase: "Faza 6",
		description:
			"Mapa Polski z szesnastoma województwami, cieniowana liczbą podpisów i odświeżana razem z licznikiem. Województwo bierze się z danych o zapytaniu, a nie z wpisanej ręcznie miejscowości — literówka nie psuje statystyki.",
	},
	{
		icon: ShieldCheck,
		title: "Ochrona przed botami",
		phase: "Faza 4",
		description:
			"Turnstile sprawdzany po stronie serwera, limit zgłoszeń z jednego adresu IP i odrzucanie powtórzonych adresów e-mail. Osoba podpisująca nie rozwiązuje żadnej łamigłówki, a liczba podpisów daje się obronić przed adresatem petycji.",
	},
	{
		icon: ListChecks,
		title: "Publiczna lista poparcia",
		phase: "Faza 8",
		description:
			"Podzielona na strony lista w formacie „Imię N., Miejscowość” albo nazwa firmy — wyłącznie dla osób, które zaznaczyły zgodę na publikację. Kto zgody nie zaznaczył, nie pojawia się na niej nigdy.",
	},
	{
		icon: FileText,
		title: "Warstwa prawna",
		phase: "Faza 7",
		description:
			"Klauzula informacyjna dostępna bez opuszczania formularza oraz klauzula RODO i polityka prywatności jako zwykłe podstrony. Nazwy organizatora i adresata wstawiane są w teksty automatycznie z pliku konfiguracyjnego.",
	},
	{
		icon: Globe,
		title: "Dwie wersje językowe",
		phase: "Faza 3",
		description:
			"Polska pod adresem głównym, angielska pod prefiksem /en, przełącznik zachowujący bieżącą stronę oraz znaczniki hreflang i Open Graph w obu językach. Cała treść mieszka w plikach sprawdzanych schematem, nie w kodzie komponentów.",
	},
	{
		icon: Table2,
		title: "Dostęp do danych",
		phase: "Faza 10",
		description:
			"Zamiast panelu administracyjnego — gotowe zapytania wiersza poleceń: pełny eksport podpisów do pliku CSV i lista adresów osób, które zgodziły się na kontakt. Brak panelu oznacza brak logowania i brak powierzchni do zaatakowania.",
	},
];

export function FeaturesSection() {
	return (
		<section id="funkcje" className="border-t border-divider bg-ground py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">Zakres szablonu</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">Co znajdzie się na gotowej stronie</h2>
				<p className="mt-4 max-w-2xl text-base leading-relaxed text-quiet">
					Każdy element powstaje jako osobna, działająca całość. Etykieta przy nazwie mówi, w której
					fazie planu dany fragment jest budowany — nic z tej listy nie jest jeszcze ukończone.
				</p>

				<div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
					{features.map((feature) => {
						const Icon = feature.icon;
						return (
							<article
								key={feature.title}
								className="rounded-xl border border-divider bg-paper p-6"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex items-center gap-3">
										<Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
										<h3 className="text-lg text-ink">{feature.title}</h3>
									</div>
									<Badge
										variant="outline"
										className="shrink-0 border-brand-soft-border bg-brand-soft text-xs font-medium text-brand-dark"
									>
										{feature.phase}
									</Badge>
								</div>
								<p className="mt-4 text-sm leading-relaxed text-quiet">{feature.description}</p>
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}

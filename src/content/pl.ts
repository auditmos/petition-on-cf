/**
 * Polish copy — the default language, served at `/`.
 *
 * Everything the page says, with the deployment's proper nouns punched out as
 * `{{tokens}}` that `src/content/site-config.ts` fills. Nothing here knows how
 * it will be laid out, and nothing in a component knows what it will say.
 */
export const pl = {
	meta: {
		title: "petition-on-cf — szablon strony petycji na Cloudflare Workers",
		description:
			"Otwarty szablon strony petycji: formularz podpisu ze zgodami RODO, licznik podpisów na żywo, mapa poparcia i treści po polsku oraz po angielsku. Jedno wdrożenie to jedna petycja, w całości na Twoim koncie Cloudflare.",
		ogLocale: "pl_PL",
	},

	nav: {
		brand: "petition-on-cf",
		tagline: "Szablon petycji",
		items: [
			{ label: "Zakres szablonu", sectionId: "funkcje" },
			{ label: "Uruchomienie", sectionId: "start" },
			{ label: "Architektura", sectionId: "architektura" },
		],
		repositoryLabel: "GitHub",
		openMenuLabel: "Otwórz menu nawigacji",
		menuTitle: "Nawigacja",
	},

	languageSwitch: {
		label: "Zmień język",
		options: { pl: "Polski", en: "English" },
	},

	hero: {
		eyebrow: "Szablon open source · Cloudflare Workers",
		headline: "Strona petycji, którą wdrażasz na własnym koncie",
		lede: "Jedno wdrożenie to jedna petycja. Formularz podpisu ze zgodami RODO, licznik podpisów aktualizowany na żywo, mapa poparcia w województwach i treści po polsku oraz po angielsku. Wszystko działa na Twoim koncie Cloudflare — bez platformy pośredniczącej, bez abonamentu i bez oddawania komukolwiek danych osób podpisujących.",
		primaryCta: "Zobacz repozytorium",
		secondaryCta: "Przeczytaj założenia projektu",
		noteLead: "Szablon powstaje na Twoich oczach.",
		note: "Ta strona opisuje, co znajdzie się w gotowym szablonie i na jakim etapie jest każdy element. Nic tu nie jest prawdziwą petycją — formularz poniżej działa, ale zbiera podpisy wyłącznie na potrzeby pokazu.",
	},

	counter: {
		eyebrow: "Poparcie dla tej sprawy",
		note: "Liczba pochodzi wprost z bazy podpisów tego wdrożenia i jest wyliczana przy każdym wejściu na stronę. Po złożeniu podpisu odśwież stronę, żeby zobaczyć nową wartość — licznik aktualizowany na żywo powstaje w kolejnym etapie.",
		nouns: {
			zero: "podpisów",
			one: "podpis",
			two: "podpisy",
			few: "podpisy",
			many: "podpisów",
			other: "podpisów",
		},
	},

	sign: {
		eyebrow: "Podpis",
		heading: "Podpisz petycję „{{petitionName}}”",
		lede: "To wersja demonstracyjna szablonu, a nie prawdziwa petycja — nie wysyłaj tu danych, na których Ci zależy. Podpis trafia do bazy tego wdrożenia i zwiększa licznik powyżej.",
		note: "Adres e-mail rozpoznaje ponowny podpis: kto podpisał już wcześniej, dostanie o tym informację zamiast drugiego wpisu. Kod pocztowy jest nieobowiązkowy.",
		fields: {
			firstName: "Imię",
			surname: "Nazwisko",
			email: "Adres e-mail",
			city: "Miejscowość",
			postalCode: "Kod pocztowy (nieobowiązkowy)",
		},
		consentRodo:
			"Zapoznałam/zapoznałem się z klauzulą informacyjną o przetwarzaniu danych osobowych. Wersja obowiązująca dla tej petycji pojawi się tutaj razem z warstwą prawną.",
		submit: "Podpisz petycję",
		success: {
			heading: "Dziękujemy — Twój podpis został zapisany.",
			note: "Odśwież stronę, żeby zobaczyć zaktualizowaną liczbę podpisów.",
		},
		duplicate: "Ten adres e-mail już podpisał tę petycję — nie trzeba nic więcej robić.",
		invalidSubmission: "Nie udało się zapisać podpisu — popraw zaznaczone pola.",
		botCheckFailed:
			"Nie udało się potwierdzić, że podpis składa człowiek. Odśwież stronę i spróbuj ponownie.",
		rateLimited: "Z tego adresu wysłano zbyt wiele podpisów naraz. Spróbuj ponownie za minutę.",
		failure: "Nie udało się zapisać podpisu. Spróbuj ponownie za chwilę.",
		errors: {
			firstName: "Podaj imię.",
			surname: "Podaj nazwisko.",
			email: "Podaj poprawny adres e-mail.",
			city: "Podaj miejscowość.",
			postalCode: "Kod pocztowy ma format 00-000.",
			consentRodo: "Bez tej zgody nie możemy zapisać podpisu.",
			turnstile: "Poczekaj, aż zakończy się weryfikacja zabezpieczająca przed botami.",
			tooLong: "To pole może mieć najwyżej 100 znaków.",
			emailTooLong: "Adres e-mail może mieć najwyżej 254 znaki.",
		},
	},

	stats: {
		eyebrow: "Najważniejsze założenia",
		heading: "Cztery decyzje, które opisują ten szablon",
		facts: [
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
		],
	},

	features: {
		eyebrow: "Zakres szablonu",
		heading: "Co znajdzie się na gotowej stronie",
		lede: "Każdy element powstaje jako osobna, działająca całość. Etykieta przy nazwie mówi, w której fazie planu dany fragment jest budowany — nic z tej listy nie jest jeszcze ukończone.",
		items: [
			{
				key: "form",
				title: "Formularz podpisu",
				phase: "Faza 2 i 7",
				description:
					"Imię, nazwisko, adres e-mail i miejscowość, wybór między osobą prywatną a firmą oraz trzy pola zgód. Adres e-mail jest kluczem, po którym rozpoznawany jest ponowny podpis — kto podpisał drugi raz, dostaje życzliwy komunikat zamiast błędu.",
			},
			{
				key: "live",
				title: "Licznik podpisów na żywo",
				phase: "Faza 5",
				description:
					"Durable Object trzyma bieżące liczby i rozsyła je przez WebSocket, łącząc powiadomienia do jednego na sekundę. Gdy połączenie nie dojdzie do skutku, strona po cichu przechodzi na cykliczne odpytywanie i nigdy nie wygląda na zepsutą.",
			},
			{
				key: "map",
				title: "Mapa poparcia",
				phase: "Faza 6",
				description:
					"Mapa Polski z szesnastoma województwami, cieniowana liczbą podpisów i odświeżana razem z licznikiem. Województwo bierze się z kodu pocztowego albo z danych o zapytaniu, a nie z wpisanej ręcznie miejscowości — literówka nie psuje statystyki.",
			},
			{
				key: "bots",
				title: "Ochrona przed botami",
				phase: "Faza 4",
				description:
					"Turnstile sprawdzany po stronie serwera, limit zgłoszeń z jednego adresu IP i odrzucanie powtórzonych adresów e-mail. Osoba podpisująca nie rozwiązuje żadnej łamigłówki, a liczba podpisów daje się obronić przed adresatem petycji.",
			},
			{
				key: "list",
				title: "Publiczna lista poparcia",
				phase: "Faza 8",
				description:
					"Podzielona na strony lista w formacie „Imię N., Miejscowość” albo nazwa {{signerOrgNounGen}} — wyłącznie dla osób, które zaznaczyły zgodę na publikację. Kto zgody nie zaznaczył, nie pojawia się na niej nigdy.",
			},
			{
				key: "legal",
				title: "Warstwa prawna",
				phase: "Faza 7",
				description:
					"Klauzula informacyjna dostępna bez opuszczania formularza oraz klauzula RODO i polityka prywatności jako zwykłe podstrony. Nazwy organizatora i adresata wstawiane są w teksty automatycznie z pliku konfiguracyjnego.",
			},
			{
				key: "i18n",
				title: "Dwie wersje językowe",
				phase: "Faza 3",
				description:
					"Polska pod adresem głównym, angielska pod prefiksem /en, przełącznik zachowujący bieżącą stronę oraz znaczniki hreflang i Open Graph w obu językach. Cała treść mieszka w plikach sprawdzanych schematem, nie w kodzie komponentów.",
			},
			{
				key: "data",
				title: "Dostęp do danych",
				phase: "Faza 10",
				description:
					"Zamiast panelu administracyjnego — gotowe zapytania wiersza poleceń: pełny eksport podpisów do pliku CSV i lista adresów osób, które zgodziły się na kontakt. Brak panelu oznacza brak logowania i brak powierzchni do zaatakowania.",
			},
		],
	},

	howItWorks: {
		eyebrow: "Uruchomienie",
		heading: "Od kliknięcia do własnej petycji",
		paths: [
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
		],
		architecture: {
			eyebrow: "Architektura",
			heading: "Cztery zasady, od których nie ma odstępstw",
			rules: [
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
			],
		},
	},

	faq: {
		eyebrow: "Pytania",
		heading: "Częste pytania",
		items: [],
	},

	footer: {
		name: "petition-on-cf",
		description:
			"Szablon strony petycji na Cloudflare Workers. Rozwijany publicznie jako projekt otwarty — dokumenty poniżej opisują, co powstaje i w jakiej kolejności.",
		documentsHeading: "Dokumenty",
		documents: [
			{ key: "repository", label: "Repozytorium na GitHubie" },
			{ key: "prd", label: "Założenia projektu (PRD)" },
			{ key: "plan", label: "Plan wdrożenia w fazach" },
			{ key: "issues", label: "Zadania i postęp prac" },
		],
		disclaimer:
			"Odpowiedzialność za zgodność treści prawnych konkretnej kampanii spoczywa na jej organizatorze.",
		licenseLead: "Licencja",
		licenseLabel: "MIT",
	},

	theme: {
		label: "Motyw",
		options: {
			light: { label: "Jasny", description: "Używaj jasnego motywu" },
			dark: { label: "Ciemny", description: "Używaj ciemnego motywu" },
			system: { label: "Systemowy", description: "Używaj motywu systemu" },
		},
	},

	notFound: {
		heading: "Nie ma takiej strony",
		description: "Strona, której szukasz, nie istnieje albo została przeniesiona.",
		back: "Wróć",
		home: "Strona główna",
		hint: "Sprawdź adres albo wróć na stronę główną.",
	},

	errorBoundary: {
		heading: "Coś poszło nie tak",
		description: "Wystąpił nieoczekiwany błąd. Spróbuj jeszcze raz.",
		fallbackMessage: "Wystąpił nieoczekiwany błąd.",
		retry: "Spróbuj ponownie",
		home: "Strona główna",
		back: "Wróć",
		detailsToggle: "Szczegóły techniczne",
		stackHeading: "Ślad stosu",
		supportNote: "Jeśli błąd się powtarza, napisz do organizatora petycji.",
		report: "Zgłoś błąd",
		reportSubject: "Zgłoszenie błędu",
		reportIntro: "W aplikacji wystąpił błąd:",
		reportPrompt: "Opisz, co robiłaś lub robiłeś, gdy pojawił się ten błąd:",
	},

	legal: {
		polishOnlyNotice:
			"Dokumenty prawne tej petycji obowiązują w wersji polskiej i tylko ona jest wiążąca.",
	},
} as const;

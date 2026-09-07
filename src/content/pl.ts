/**
 * Polish copy — the default language, served at `/`.
 *
 * Everything the page says, with the deployment's proper nouns punched out as
 * `{{tokens}}` that `src/content/site-config.ts` fills. Nothing here knows how
 * it will be laid out, and nothing in a component knows what it will say.
 */
export const pl = {
	meta: {
		title: "Podpisz petycję „{{petitionName}}”",
		description:
			"Petycja „{{petitionName}}”: czego dotyczy sprawa, czego żądamy od jej adresata i jak dołączyć do osób, które już ją podpisały. Podpis zajmuje minutę, a liczba podpisów jest widoczna na żywo.",
		ogLocale: "pl_PL",
	},

	nav: {
		brand: "{{petitionName}}",
		tagline: "Petycja",
		items: [
			{ label: "Dowody", sectionId: "dowody" },
			{ label: "Czego żądamy", sectionId: "postulaty" },
			{ label: "Podpisz", sectionId: "podpisz" },
			{ label: "Pytania", sectionId: "pytania" },
		],
		openMenuLabel: "Otwórz menu nawigacji",
		menuTitle: "Nawigacja",
	},

	languageSwitch: {
		label: "Zmień język",
		options: { pl: "Polski", en: "English" },
	},

	hero: {
		eyebrow: "Petycja obywatelska",
		headline: "Jedno zdanie, dla którego ludzie podpisują tę petycję",
		lede: "Tu wpisz, o co chodzi w sprawie i czego oczekujesz od adresata — dwa albo trzy zdania, bez żargonu i bez wstępu. Po ich przeczytaniu odwiedzający ma wiedzieć, pod czym się podpisuje, jeszcze zanim przewinie stronę niżej.",
		primaryCta: "Podpisz petycję",
		secondaryCta: "Zobacz, czego żądamy",
		noteLead: "To jest wersja demonstracyjna.",
		note: "Wdrożenie nie zostało jeszcze spersonalizowane: wszystkie teksty są ogólne, a nazwa petycji i dane organizatora pochodzą z pliku konfiguracyjnego. Formularz działa, ale zebrane podpisy służą wyłącznie do pokazu.",
	},

	counter: {
		eyebrow: "Poparcie dla tej sprawy",
		note: "Liczba pochodzi wprost z bazy podpisów tego wdrożenia. Aktualizuje się sama, bez odświeżania strony: każdy nowy podpis dociera do wszystkich otwartych kart w ciągu sekundy. Jeśli Twoja sieć blokuje połączenia na żywo, strona po cichu przechodzi na odpytywanie co kilkanaście sekund.",
		nouns: {
			zero: "podpisów",
			one: "podpis",
			two: "podpisy",
			few: "podpisy",
			many: "podpisów",
			other: "podpisów",
		},
	},

	floatingBar: {
		label: "Licznik podpisów i skrót do formularza",
		cta: "Podpisz petycję",
	},

	map: {
		eyebrow: "Skąd pochodzą podpisy",
		heading: "Poparcie w całej Polsce",
		note: "Nasycenie koloru pokazuje, jak dużo podpisów zebrało województwo w porównaniu z najsilniejszym — samo w sobie nie jest liczbą, dlatego pod mapą każdy region ma swoją wprost wypisaną. Województwo bierze się z kodu pocztowego, a gdy go nie podano, z sieci, z której przyszedł podpis.",
		figureLabel: "Mapa Polski, województwa wycieniowane liczbą podpisów",
		unknownLabel: "Bez przypisanego województwa",
		regions: {
			"PL-DS": "Dolnośląskie",
			"PL-KP": "Kujawsko-pomorskie",
			"PL-LU": "Lubelskie",
			"PL-LB": "Lubuskie",
			"PL-LD": "Łódzkie",
			"PL-MA": "Małopolskie",
			"PL-MZ": "Mazowieckie",
			"PL-OP": "Opolskie",
			"PL-PK": "Podkarpackie",
			"PL-PD": "Podlaskie",
			"PL-PM": "Pomorskie",
			"PL-SL": "Śląskie",
			"PL-SK": "Świętokrzyskie",
			"PL-WN": "Warmińsko-mazurskie",
			"PL-WP": "Wielkopolskie",
			"PL-ZP": "Zachodniopomorskie",
		},
	},

	supporters: {
		eyebrow: "Kto podpisał",
		heading: "Lista popierających",
		note: "Widnieją tu tylko te podpisy, których autorzy zgodzili się na publikację: imię i pierwsza litera nazwiska oraz miejscowość, a w przypadku {{signerOrgNounGen}} — jej nazwa. Lista nie odświeża się na żywo, w odróżnieniu od licznika i mapy; nowe podpisy pojawią się na niej po przeładowaniu strony.",
		empty: "Nikt jeszcze nie zgodził się na publikację swojego podpisu.",
		loadMore: "Pokaż więcej",
		loadMoreFailed: "Nie udało się wczytać kolejnych podpisów. Spróbuj ponownie.",
		invalidCursor: "Nieprawidłowy wskaźnik strony listy.",
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
			companyName: "Nazwa {{signerOrgNounGen}}",
			signerRole: "Twoja funkcja w {{signerOrgNounLoc}} (nieobowiązkowa)",
		},
		signerType: {
			label: "Podpisuję jako",
			person: "osoba prywatna",
			organization: "{{signerOrgNoun}}",
		},
		klauzulaToggle: "Klauzula informacyjna",
		submit: "Podpisz petycję",
		success: {
			heading: "Dziękujemy — Twój podpis został zapisany.",
			note: "Licznik powyżej uwzględnia już Twój podpis — i podpisy, które składają teraz inni.",
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
			companyName: "Podaj nazwę {{signerOrgNounGen}}.",
			consentRodo: "Bez tej zgody nie możemy zapisać podpisu.",
			turnstile: "Poczekaj, aż zakończy się weryfikacja zabezpieczająca przed botami.",
			tooLong: "To pole może mieć najwyżej 100 znaków.",
			emailTooLong: "Adres e-mail może mieć najwyżej 254 znaki.",
		},
	},

	stats: {
		eyebrow: "Dowody",
		heading: "Skala sprawy w liczbach",
		sourceLead: "Źródło",
		facts: [
			{
				figure: "00 000",
				label: "osób, których dotyczy sprawa",
				note: "Zacznij od liczby, która pokazuje skalę: ilu ludzi mierzy się z problemem opisanym w petycji. Wpisz tutaj własną — ta jest miejscem na nią, a nie danymi.",
				source: "Nazwa raportu, instytucja, rok wydania",
			},
			{
				figure: "0 %",
				label: "tyle osób popiera zmianę w badaniach",
				note: "Jeśli ktoś zbadał opinię publiczną w tej sprawie, to najmocniejszy argument, jaki masz: pokazuje, że petycja nie jest głosem wąskiej grupy.",
				source: "Nazwa badania, pracownia badawcza, rok",
			},
			{
				figure: "00",
				label: "lat bez zmiany przepisów",
				note: "Czas jest argumentem sam w sobie. Data ostatniej nowelizacji mówi czytelnikowi, jak długo problem czeka na rozwiązanie.",
				source: "Dziennik Ustaw — numer pozycji i rok",
			},
			{
				figure: "0",
				label: "odpowiedzi na wcześniejsze wnioski",
				note: "Petycja zwykle nie jest pierwszą próbą. Jeśli wcześniejsze pisma zostały bez odpowiedzi, napisz to wprost — to uzasadnia, dlaczego sprawa trafia do opinii publicznej.",
				source: "Korespondencja organizatora, rok",
			},
		],
	},

	mechanism: {
		eyebrow: "Czego żądamy",
		heading: "O co prosimy adresata petycji",
		lede: "Petycja działa wtedy, gdy prosi o coś konkretnego. Zamiast opisywać problem po raz drugi, wypisz tu żądania — każde sformułowane tak, żeby adresat wiedział, co ma zrobić, a osoba podpisująca wiedziała, pod czym się podpisuje.",
		demands: [
			{
				title: "Pierwszy postulat — zmiana, o którą chodzi najbardziej",
				description:
					"Napisz, co konkretnie ma się zmienić: który przepis, która decyzja, która praktyka urzędu. Jedno zdanie, bez ogólników — to ono trafi do pisma przewodniego i do nagłówków.",
			},
			{
				title: "Drugi postulat — termin",
				description:
					"Żądanie bez terminu można odłożyć w nieskończoność. Podaj datę albo okres, w którym oczekujesz decyzji, i napisz, dlaczego akurat taki.",
			},
			{
				title: "Trzeci postulat — jawność",
				description:
					"Poproś o to, żeby odpowiedź była publiczna. Dzięki temu osoby, które podpisały, dowiedzą się o rozstrzygnięciu razem z Tobą, a sprawa nie kończy się na korespondencji między dwiema stronami.",
			},
		],
		note: "Po zakończeniu zbiórki organizator przekaże adresatowi treść petycji wraz z liczbą i listą podpisów. Podpis nie jest głosem w wyborach ani wnioskiem urzędowym — jest publicznym poparciem dla powyższych żądań.",
	},

	share: {
		eyebrow: "Przekaż dalej",
		heading: "Jeden udostępniony link to kilka kolejnych podpisów",
		note: "Petycję podpisuje się najczęściej dlatego, że przysłał ją ktoś znajomy. Poniższe przyciski otwierają okno wybranego serwisu z gotowym linkiem — nic nie publikują za Ciebie i nie wysyłają żadnych danych o Tobie.",
		message: "Podpisałam/podpisałem petycję „{{petitionName}}”. Przyłączysz się?",
		networks: {
			facebook: "Udostępnij na Facebooku",
			x: "Udostępnij na X",
			linkedin: "Udostępnij na LinkedInie",
			whatsapp: "Wyślij przez WhatsApp",
		},
		copyLink: "Skopiuj link",
		copied: "Link skopiowany do schowka.",
		copyFailed: "Przeglądarka nie pozwoliła skopiować linku — zaznacz go w pasku adresu.",
	},

	faq: {
		eyebrow: "Pytania",
		heading: "Zanim podpiszesz",
		note: "Nie ma tu Twojego pytania? Napisz na {{contactEmail}} — odpowiedź, która przyda się innym, trafi na tę listę.",
		items: [
			{
				question: "Kto zobaczy moje dane?",
				answer:
					"Imię, nazwisko, adres e-mail i miejscowość trafiają do bazy petycji i widzi je organizator. Publicznie pokazujemy wyłącznie podpisy osób, które zaznaczyły na to zgodę, i tylko w formie „Imię N., Miejscowość”. Adres e-mail nie jest publikowany nigdy.",
			},
			{
				question: "Po co adres e-mail, skoro nic na niego nie wysyłacie?",
				answer:
					"Adres jest kluczem, po którym rozpoznajemy ponowny podpis — dzięki niemu liczba podpisów daje się obronić przed adresatem petycji. Wiadomości wysyłamy tylko wtedy, gdy zaznaczysz zgodę na informacje o przebiegu sprawy.",
			},
			{
				question: "Czy mogę wycofać swój podpis?",
				answer:
					"Tak. Napisz na {{contactEmail}} z adresu, którym się podpisano, a podpis zostanie usunięty razem z danymi. Nie musisz podawać powodu.",
			},
			{
				question: "Czy podpis w internecie ma jakąkolwiek moc?",
				answer:
					"Ta petycja to publiczne poparcie dla żądań opisanych wyżej, a nie wniosek składany w trybie ustawy o petycjach ani głos w wyborach. Jej siłą jest liczba osób, które podpisały, i to, że każda z nich jest policzalna oraz sprawdzalna.",
			},
			{
				question: "Podpisuję w imieniu firmy albo organizacji — jak to zaznaczyć?",
				answer:
					"W formularzu wybierz „{{signerOrgNoun}}” zamiast osoby prywatnej. Pojawi się wtedy pole na nazwę, a jeśli wdrożenie o to prosi — także na Twoją funkcję. Na publicznej liście widoczna jest wtedy nazwa {{signerOrgNounGen}}, bez miejscowości.",
			},
		],
	},

	footer: {
		name: "{{organizerName}}",
		description:
			"Organizator petycji „{{petitionName}}” i administrator danych osób, które ją podpisały.",
		legalHeading: "Dokumenty prawne",
		socialHeading: "Organizator w sieci",
		socialNetworks: {
			facebook: "Facebook",
			x: "X",
			linkedin: "LinkedIn",
		},
		disclaimer:
			"Odpowiedzialność za zgodność treści prawnych tej kampanii spoczywa na jej organizatorze.",
		colophon: "Zbudowane na szablonie petition-on-cf",
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
		documents: {
			rodoClause: {
				title: "Klauzula informacyjna RODO",
				description:
					"Jak przetwarzamy dane osób podpisujących petycję „{{petitionName}}” — administrator, cele, podstawy prawne, okres przechowywania i Twoje prawa.",
			},
			privacyPolicy: {
				title: "Polityka prywatności",
				description:
					"Co serwis {{domain}} zbiera, czego nie zbiera, komu powierza dane i jak długo je przechowuje.",
			},
		},
	},
} as const;

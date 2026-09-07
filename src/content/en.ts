/**
 * English copy — served under the `/en` prefix.
 *
 * A translation of `pl.ts`, not a second draft: the two files say the same
 * things because they are the same page. The legal documents are the one thing
 * that stays Polish, and `legal.polishOnlyNotice` is how an English reader
 * finds that out.
 */
export const en = {
	meta: {
		title: "petition-on-cf — a petition site template for Cloudflare Workers",
		description:
			"An open-source petition site template: a signature form with GDPR consents, a live signature counter, a support map and content in Polish and English. One deployment is one petition, running entirely on your own Cloudflare account.",
		ogLocale: "en_GB",
	},

	nav: {
		brand: "petition-on-cf",
		tagline: "Petition template",
		items: [
			{ label: "What it covers", sectionId: "funkcje" },
			{ label: "Getting started", sectionId: "start" },
			{ label: "Architecture", sectionId: "architektura" },
		],
		repositoryLabel: "GitHub",
		openMenuLabel: "Open navigation menu",
		menuTitle: "Navigation",
	},

	languageSwitch: {
		label: "Change language",
		options: { pl: "Polski", en: "English" },
	},

	hero: {
		eyebrow: "Open-source template · Cloudflare Workers",
		headline: "A petition site you deploy on your own account",
		lede: "One deployment is one petition. A signature form with GDPR consents, a counter that updates live, a map of support by region, and content in both Polish and English. All of it runs on your own Cloudflare account — no intermediary platform, no subscription, and nobody else holding your signers' data.",
		primaryCta: "View the repository",
		secondaryCta: "Read the project brief",
		noteLead: "This template is being built in the open.",
		note: "This page describes what the finished template will contain and how far each part has got. Nothing here is a real petition — the form below works, but it collects signatures for demonstration only.",
	},

	counter: {
		eyebrow: "Support for this cause",
		note: "The number comes straight from this deployment's signature database. It updates on its own, with no page reload: every new signature reaches all open tabs within about a second. If your network blocks live connections, the page quietly falls back to asking every few seconds.",
		nouns: {
			zero: "signatures",
			one: "signature",
			two: "signatures",
			few: "signatures",
			many: "signatures",
			other: "signatures",
		},
	},

	floatingBar: {
		label: "Signature count and a shortcut to the form",
		cta: "Sign the petition",
	},

	map: {
		eyebrow: "Where the signatures come from",
		heading: "Support across Poland",
		note: "Colour depth shows how much a voivodeship has gathered against the strongest one — it is a comparison rather than a number, so every region's count is written out below the map. The voivodeship comes from the postal code, or from the network the signature arrived on when none was given.",
		figureLabel: "Map of Poland, voivodeships shaded by number of signatures",
		unknownLabel: "No voivodeship recorded",
		regions: {
			"PL-DS": "Lower Silesia",
			"PL-KP": "Kuyavia-Pomerania",
			"PL-LU": "Lublin",
			"PL-LB": "Lubusz",
			"PL-LD": "Łódź",
			"PL-MA": "Lesser Poland",
			"PL-MZ": "Mazovia",
			"PL-OP": "Opole",
			"PL-PK": "Subcarpathia",
			"PL-PD": "Podlaskie",
			"PL-PM": "Pomerania",
			"PL-SL": "Silesia",
			"PL-SK": "Holy Cross",
			"PL-WN": "Warmia-Masuria",
			"PL-WP": "Greater Poland",
			"PL-ZP": "West Pomerania",
		},
	},

	sign: {
		eyebrow: "Sign",
		heading: "Sign the “{{petitionName}}” petition",
		lede: "This is a demonstration of the template, not a real petition — do not send anything here that matters to you. Your signature goes into this deployment's database and increases the counter above.",
		note: "The e-mail address is what recognises a repeat signature: anyone who has signed before is told so rather than added twice. The postal code is optional.",
		fields: {
			firstName: "First name",
			surname: "Surname",
			email: "E-mail address",
			city: "Town or city",
			postalCode: "Postal code (optional)",
			companyName: "Organisation name",
			signerRole: "Your role in the organisation (optional)",
		},
		signerType: {
			label: "Signing as",
			person: "a private person",
			organization: "an organisation",
		},
		klauzulaToggle: "Information notice",
		submit: "Sign the petition",
		success: {
			heading: "Thank you — your signature has been recorded.",
			note: "Reload the page to see the updated signature count.",
		},
		invalidSubmission: "The signature could not be saved — please correct the marked fields.",
		botCheckFailed:
			"We could not confirm that a person is signing. Please reload the page and try again.",
		rateLimited:
			"Too many signatures have been submitted from this address at once. Please try again in a minute.",
		duplicate:
			"This e-mail address has already signed this petition — there is nothing more to do.",
		failure: "The signature could not be saved. Please try again in a moment.",
		errors: {
			firstName: "Enter your first name.",
			surname: "Enter your surname.",
			email: "Enter a valid e-mail address.",
			city: "Enter your town or city.",
			postalCode: "A postal code looks like 00-000.",
			companyName: "Enter the organisation's name.",
			consentRodo: "Without this consent we cannot record your signature.",
			turnstile: "Please wait for the anti-bot check to finish.",
			tooLong: "This field can hold at most 100 characters.",
			emailTooLong: "An e-mail address can hold at most 254 characters.",
		},
	},

	stats: {
		eyebrow: "The main decisions",
		heading: "Four decisions that describe this template",
		facts: [
			{
				figure: "1",
				label: "deployment = one petition",
				note: "The data model has no concept of “many petitions”. A second cause is a second copy of the repository — which is why there is no admin panel, no accounts and no shared database to police.",
			},
			{
				figure: "2",
				label: "content languages: Polish and English",
				note: "The root address serves Polish, the /en prefix serves English. Legal documents stay in Polish, with a clear notice about that in English.",
			},
			{
				figure: "0",
				label: "services outside Cloudflare",
				note: "A D1 database, a Durable Object and Turnstile — nothing else. The template never sends e-mail, so it needs no mail provider and no sender domain.",
			},
			{
				figure: "3",
				label: "consents at signing",
				note: "A mandatory acknowledgement of the GDPR notice, plus two optional consents: to appear on the public list of support, and to receive news about the cause.",
			},
		],
	},

	features: {
		eyebrow: "What it covers",
		heading: "What the finished site will have",
		lede: "Each part is built as a separate working whole. The label beside each name says which phase of the plan builds it — nothing on this list is finished yet.",
		items: [
			{
				key: "form",
				title: "Signature form",
				phase: "Phases 2 and 7",
				description:
					"First name, surname, e-mail address and town, a choice between a private person and an organisation, and three consent fields. The e-mail address is the key that recognises a repeat signature — anyone signing twice gets a friendly message rather than an error.",
			},
			{
				key: "live",
				title: "Live signature counter",
				phase: "Phase 5",
				description:
					"A Durable Object holds the current numbers and broadcasts them over WebSockets, coalescing notifications to one per second. If the connection cannot be established the page quietly falls back to polling and never looks broken.",
			},
			{
				key: "map",
				title: "Map of support",
				phase: "Phase 6",
				description:
					"A map of Poland's sixteen voivodeships, shaded by signature count and refreshed alongside the counter. The region comes from the postal code or from request metadata rather than from a hand-typed town name, so a typo cannot distort the statistics.",
			},
			{
				key: "bots",
				title: "Bot protection",
				phase: "Phase 4",
				description:
					"Turnstile verified server-side, a per-IP submission limit, and rejection of repeated e-mail addresses. The person signing solves no puzzle, and the signature count can be defended to whoever the petition is addressed to.",
			},
			{
				key: "list",
				title: "Public list of support",
				phase: "Phase 8",
				description:
					"A paginated list in the form “First name S., Town”, or an organisation's name — only for people who ticked the consent to be published. Anyone who did not tick it never appears on it.",
			},
			{
				key: "legal",
				title: "Legal layer",
				phase: "Phase 7",
				description:
					"The information notice available without leaving the form, plus the GDPR clause and the privacy policy as ordinary sub-pages. The organizer's and addressee's names are inserted into the texts automatically from the configuration file.",
			},
			{
				key: "i18n",
				title: "Two language versions",
				phase: "Phase 3",
				description:
					"Polish at the root address, English under the /en prefix, a switcher that keeps you on the current page, and hreflang and Open Graph tags in both languages. All content lives in schema-validated files rather than in component code.",
			},
			{
				key: "data",
				title: "Access to the data",
				phase: "Phase 10",
				description:
					"Instead of an admin panel — ready-made command-line queries: a full export of signatures to a CSV file, and a list of the addresses of people who agreed to be contacted. No panel means no login and no surface to attack.",
			},
		],
	},

	howItWorks: {
		eyebrow: "Getting started",
		heading: "From one click to your own petition",
		paths: [
			{
				step: "Path one",
				title: "Deploy in a single click",
				phase: "Phase 11",
				steps: [
					"The “Deploy to Cloudflare” button copies the repository to your GitHub account.",
					"Cloudflare creates the D1 database and the Durable Object from the configuration file — with no clicking around the dashboard.",
					"Database migrations run as part of the deployment, so a fresh installation never starts without its tables.",
					"The site works immediately on Turnstile's test keys: you can sign as a trial run before the real keys exist.",
				],
			},
			{
				step: "Path two",
				title: "Adapt it to your own cause",
				phase: "Phase 10",
				steps: [
					"Clone your copy of the repository and run the personalisation script.",
					"Answer its questions about the petition name, the organizer, the addressee, the contact address and the domain.",
					"Public values go into the configuration file; the private Turnstile key goes only into the local secrets file.",
					"Push your changes: CI handles every deployment from then on. Running the script again overwrites nothing.",
				],
			},
		],
		architecture: {
			eyebrow: "Architecture",
			heading: "Four rules with no exceptions",
			rules: [
				{
					term: "The D1 database is the only source of truth",
					definition:
						"The Durable Object is a cache and a broadcaster only — after a restart it rebuilds its counters from the database, and it never writes to it.",
				},
				{
					term: "Writes go one way",
					definition:
						"The Worker validates a submission, stores it in the database, and only then notifies the Durable Object without waiting for a reply. Repeated addresses are filtered out by the uniqueness constraint in the database itself.",
				},
				{
					term: "Components contain no text at all",
					definition:
						"All content lives in per-language files validated by a shared schema. A missing translation stops the build rather than a user in production.",
				},
				{
					term: "There is no login and no admin panel",
					definition:
						"The site is entirely public. The organizer reaches the data with ready-made command-line queries, so no account exists that could be taken over.",
				},
			],
		},
	},

	faq: {
		eyebrow: "Questions",
		heading: "Frequently asked questions",
		items: [],
	},

	footer: {
		name: "petition-on-cf",
		description:
			"A petition site template for Cloudflare Workers. Developed in the open — the documents below describe what is being built and in what order.",
		documentsHeading: "Documents",
		documents: [
			{ key: "repository", label: "Repository on GitHub" },
			{ key: "prd", label: "Project brief (PRD)" },
			{ key: "plan", label: "Phased implementation plan" },
			{ key: "issues", label: "Work items and progress" },
		],
		legalHeading: "Legal documents",
		disclaimer:
			"Responsibility for the legal texts of any given campaign rests with its organizer.",
		licenseLead: "Licence",
		licenseLabel: "MIT",
	},

	theme: {
		label: "Theme",
		options: {
			light: { label: "Light", description: "Use the light theme" },
			dark: { label: "Dark", description: "Use the dark theme" },
			system: { label: "System", description: "Use the system theme" },
		},
	},

	notFound: {
		heading: "Page not found",
		description: "The page you are looking for does not exist or has been moved.",
		back: "Go back",
		home: "Home",
		hint: "Check the address, or go back to the home page.",
	},

	errorBoundary: {
		heading: "Something went wrong",
		description: "An unexpected error occurred. Please try again.",
		fallbackMessage: "An unexpected error occurred.",
		retry: "Try again",
		home: "Home",
		back: "Go back",
		detailsToggle: "Technical details",
		stackHeading: "Stack trace",
		supportNote: "If this keeps happening, write to the petition's organizer.",
		report: "Report the error",
		reportSubject: "Error report",
		reportIntro: "An error occurred in the application:",
		reportPrompt: "Please describe what you were doing when this error occurred:",
	},

	legal: {
		polishOnlyNotice:
			"The legal documents for this petition are binding in their Polish version, and only that version is binding.",
		documents: {
			rodoClause: {
				title: "GDPR information notice (in Polish)",
				description:
					"How the data of people signing the “{{petitionName}}” petition is processed — controller, purposes, legal bases, retention and your rights. The document itself is in Polish.",
			},
			privacyPolicy: {
				title: "Privacy policy (in Polish)",
				description:
					"What {{domain}} collects, what it does not, who processes the data and how long it is kept. The document itself is in Polish.",
			},
		},
	},
} as const;

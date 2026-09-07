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
		title: "Sign the “{{petitionName}}” petition",
		description:
			"The “{{petitionName}}” petition: what the matter is, what we demand of its addressee, and how to join the people who have already signed. Signing takes a minute, and the running total is visible live.",
		ogLocale: "en_GB",
	},

	nav: {
		brand: "{{petitionName}}",
		tagline: "Petition",
		items: [
			{ label: "Evidence", sectionId: "dowody" },
			{ label: "Demands", sectionId: "postulaty" },
			{ label: "Sign", sectionId: "podpisz" },
			{ label: "Questions", sectionId: "pytania" },
		],
		openMenuLabel: "Open navigation menu",
		menuTitle: "Navigation",
	},

	languageSwitch: {
		label: "Change language",
		options: { pl: "Polski", en: "English" },
	},

	hero: {
		eyebrow: "A citizens' petition",
		headline: "The one sentence people sign this petition for",
		lede: "Write here what the matter is about and what you expect the addressee to do — two or three sentences, no jargon and no preamble. Having read them, a visitor should know what they are putting their name to before they scroll any further.",
		primaryCta: "Sign the petition",
		secondaryCta: "See what we demand",
		noteLead: "This is a demonstration.",
		note: "The deployment has not been personalised yet: every text is generic, and the petition's name and the organiser's details come from a configuration file. The form works, but the signatures it collects are for demonstration only.",
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

	supporters: {
		eyebrow: "Who signed",
		heading: "The people backing this",
		note: "Only signatures whose authors agreed to publication appear here: a first name, the first letter of a surname and a town — or, for an organisation, its name. Unlike the counter and the map, this list is not live; new signatures show up on it after a reload.",
		empty: "Nobody has agreed to have their signature published yet.",
		loadMore: "Show more",
		loadMoreFailed: "The next signatures could not be loaded. Please try again.",
		invalidCursor: "That is not a valid list page marker.",
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
		eyebrow: "Evidence",
		heading: "The scale of the problem, in figures",
		sourceLead: "Source",
		facts: [
			{
				figure: "00,000",
				label: "people affected by the problem",
				note: "Start with the figure that shows the scale: how many people live with the problem the petition describes. Replace this one with your own — it is a place for a number, not a number.",
				source: "Report title, institution, year of publication",
			},
			{
				figure: "0%",
				label: "support the change in surveys",
				note: "If anyone has polled opinion on the matter, this is the strongest argument you have: it shows the petition is not the voice of a narrow group.",
				source: "Survey title, polling institute, year",
			},
			{
				figure: "00",
				label: "years without a change in the law",
				note: "Time is an argument in itself. The date of the last amendment tells a reader how long the problem has been waiting for a solution.",
				source: "Journal of Laws — item number and year",
			},
			{
				figure: "0",
				label: "replies to earlier requests",
				note: "A petition is rarely the first attempt. If earlier letters went unanswered, say so plainly — it is what justifies bringing the matter to the public.",
				source: "Organiser's correspondence, year",
			},
		],
	},

	mechanism: {
		eyebrow: "What we demand",
		heading: "What we are asking the addressee to do",
		lede: "A petition works when it asks for something specific. Rather than describing the problem a second time, list the demands here — each one worded so the addressee knows what to do, and the signer knows what they are putting their name to.",
		addresseeLabel: "Petition addressee",
		addressee: "{{petitionAddressee}}",
		demands: [
			{
				title: "First demand — the change that matters most",
				description:
					"Write down what exactly has to change: which provision, which decision, which administrative practice. One sentence, no generalities — this is the one that goes into the covering letter and into the headlines.",
			},
			{
				title: "Second demand — a deadline",
				description:
					"A demand without a deadline can be postponed indefinitely. Give the date or the period within which you expect a decision, and say why that one.",
			},
			{
				title: "Third demand — publication",
				description:
					"Ask for the reply to be made public. That way everyone who signed learns the outcome when you do, and the matter does not end as correspondence between two parties.",
			},
		],
		note: "Once the collection ends, the organiser will deliver the text of the petition to its addressee along with the number and the list of signatures. A signature is neither a vote nor a formal administrative request — it is public support for the demands above.",
	},

	share: {
		eyebrow: "Pass it on",
		heading: "One shared link is several more signatures",
		note: "People usually sign a petition because somebody they know sent it to them. The buttons below open the chosen service with the link already filled in — they publish nothing on your behalf and send no data about you.",
		message: "I have signed the petition “{{petitionName}}”. Will you join in?",
		networks: {
			facebook: "Share on Facebook",
			x: "Share on X",
			linkedin: "Share on LinkedIn",
			whatsapp: "Send on WhatsApp",
		},
		copyLink: "Copy link",
		copied: "Link copied to the clipboard.",
		copyFailed: "The browser would not copy the link — select it in the address bar instead.",
	},

	faq: {
		eyebrow: "Questions",
		heading: "Before you sign",
		note: "Your question is not here? Write to {{contactEmail}} — an answer that helps others will join this list.",
		items: [
			{
				question: "Who will see my details?",
				answer:
					"Your first name, surname, e-mail address and town go into the petition's database, where the organiser can see them. Publicly we show only the signatures of people who consented to it, and only as “First name S., Town”. The e-mail address is never published.",
			},
			{
				question: "Why an e-mail address, if you send nothing to it?",
				answer:
					"The address is the key that recognises a repeat signature, which is what makes the total defensible to the petition's addressee. We send messages only if you tick the consent to hear how the matter progresses.",
			},
			{
				question: "Can I withdraw my signature?",
				answer:
					"Yes. Write to {{contactEmail}} from the address you signed with and the signature will be deleted along with the data. You do not have to give a reason.",
			},
			{
				question: "Does an online signature carry any weight?",
				answer:
					"This petition is public support for the demands set out above, not a request filed under the Polish Petitions Act and not a vote. Its force is the number of people who signed, and the fact that every one of them is countable and checkable.",
			},
			{
				question: "I am signing for a company or an organisation — how?",
				answer:
					"In the form, choose an organisation rather than a private person. A field for the name appears, and — if this deployment asks for it — one for your role. The public list then shows the organisation's name, with no town beside it.",
			},
		],
	},

	footer: {
		name: "{{organizerName}}",
		description:
			"Organiser of the “{{petitionName}}” petition and controller of the data of everyone who signed it.",
		legalHeading: "Legal documents",
		socialHeading: "The organiser online",
		socialNetworks: {
			facebook: "Facebook",
			x: "X",
			linkedin: "LinkedIn",
		},
		disclaimer: "Responsibility for the legal texts of this campaign rests with its organizer.",
		colophon: "Built on the petition-on-cf template",
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

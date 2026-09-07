import { z } from "zod";
import { VOIVODESHIP_CODES } from "@/core/voivodeship";

/**
 * The shape a language file has to have, for every language.
 *
 * Polish and English are two values of one type rather than two files that
 * resemble each other, so key parity is not a check somebody remembers to run —
 * it is what parsing against this means. A translation that forgot a heading
 * fails at build time instead of rendering a blank one in production.
 *
 * Repeating sections are arrays even where nothing renders them yet. Adding the
 * fourth statistic or the first FAQ entry is then a content edit; modelling
 * them as `fact1`/`fact2` would have made it a schema change every time.
 *
 * No copy lives here — only the fact that a piece of copy exists. Components
 * hold no strings at all; `src/content/no-hardcoded-copy.test.ts` enforces it.
 */

/** A non-empty line of copy. Empty means "somebody left the translation out". */
const line = z.string().min(1);

const section = z.object({
	eyebrow: line,
	heading: line,
});

export const contentSchema = z.object({
	/** Localized `<head>`: what a search result and a shared link say. */
	meta: z.object({
		title: line,
		description: line,
		/** BCP 47 with a region, the form Open Graph wants: `pl_PL`, `en_GB`. */
		ogLocale: line,
	}),

	/**
	 * The bar at the top. `sectionId` names an element on the landing page, and
	 * `landing-page.test.tsx` fails if one of them names nothing — a menu entry
	 * that scrolls nowhere is the quiet result of a section being renamed.
	 */
	nav: z.object({
		brand: line,
		tagline: line,
		items: z.array(z.object({ label: line, sectionId: line })),
		openMenuLabel: line,
		menuTitle: line,
	}),

	/** The language switcher's own copy, in the language it is written in. */
	languageSwitch: z.object({
		label: line,
		/** What each destination calls itself — "Polski", never "Polish". */
		options: z.object({ pl: line, en: line }),
	}),

	hero: z.object({
		eyebrow: line,
		headline: line,
		lede: line,
		primaryCta: line,
		secondaryCta: line,
		noteLead: line,
		note: line,
	}),

	counter: z.object({
		eyebrow: line,
		note: line,
		/**
		 * The noun beside the number, one form per CLDR plural category.
		 *
		 * Polish picks between three of these and English between two, which is
		 * why the noun cannot be a single string with an `s` appended by the
		 * component. Every category is required so a language that needs `few`
		 * cannot silently fall through to `other`.
		 */
		nouns: z.object({
			zero: line,
			one: line,
			two: line,
			few: line,
			many: line,
			other: line,
		}),
	}),

	/**
	 * The bar that follows the reader down the page. It shows the same number
	 * the counter section does, so it borrows that section's nouns and needs
	 * only its own label and its own call to action.
	 */
	floatingBar: z.object({
		/** Names the region for a reader who arrives at it by keyboard. */
		label: line,
		cta: line,
	}),

	/**
	 * The map of where the signatures came from.
	 *
	 * `regions` is keyed by ISO 3166-2:PL rather than by a name, because the
	 * key is the value the trust pipeline stored and the name is the thing
	 * being translated. Keying it by the code enum also makes the record
	 * exhaustive: a seventeenth code could not be added to the pipeline without
	 * both language files being made to name it.
	 */
	map: section.extend({
		note: line,
		/** Names the drawing for a reader who cannot see it. */
		figureLabel: line,
		regions: z.record(z.enum(VOIVODESHIP_CODES), line),
		/**
		 * Signatures the pipeline could attribute to no voivodeship. They count
		 * toward the total, so the map has to say they exist rather than let
		 * sixteen regions quietly fail to add up to the headline number.
		 */
		unknownLabel: line,
	}),

	/**
	 * The public list of who signed.
	 *
	 * It renders only the signers who ticked the publication consent, so the
	 * note beside it has to say that — a reader who signed and cannot find
	 * themselves is owed the reason, and a reader who can find somebody else is
	 * owed the assurance that they agreed to it.
	 */
	supporters: section.extend({
		note: line,
		/** Said when nobody has consented yet, which is a fresh deployment. */
		empty: line,
		loadMore: line,
		/** Said when the next page could not be fetched — the reader can retry. */
		loadMoreFailed: line,
		/**
		 * The endpoint's answer to a cursor it never issued. Nobody's browser can
		 * produce one, so this is read by whoever crafted the request.
		 */
		invalidCursor: line,
	}),

	sign: z.object({
		eyebrow: line,
		heading: line,
		lede: line,
		note: line,
		fields: z.object({
			firstName: line,
			surname: line,
			email: line,
			city: line,
			postalCode: line,
			companyName: line,
			signerRole: line,
		}),
		/**
		 * The signer-type toggle. `organization` names whatever noun this
		 * deployment chose, which is why it is a token rather than a word.
		 */
		signerType: z.object({ label: line, person: line, organization: line }),
		/** Opens the clause that sits under the submit button, and closes it. */
		klauzulaToggle: line,
		submit: line,
		success: z.object({ heading: line, note: line }),
		duplicate: line,
		/** What the endpoint says when a payload never reaches the database. */
		invalidSubmission: line,
		/** Said when the bot check refused the submission, not the signer. */
		botCheckFailed: line,
		/** Said when this address has submitted too often, too fast. */
		rateLimited: line,
		failure: line,
		/**
		 * Validation messages. They belong to the copy, not to the schema that
		 * rejects the value — the rule is the same in both languages, only the
		 * sentence explaining it changes.
		 */
		errors: z.object({
			firstName: line,
			surname: line,
			email: line,
			city: line,
			postalCode: line,
			companyName: line,
			consentRodo: line,
			/** Shown when the signer submits before the widget has vouched for them. */
			turnstile: line,
			tooLong: line,
			emailTooLong: line,
		}),
	}),

	/**
	 * The evidence, one entry per figure.
	 *
	 * `source` is required rather than optional, which is the whole decision:
	 * a petition's credibility is the traceability of its numbers, and an
	 * optional field is one a hurried campaign leaves empty. `sourceUrl` is
	 * optional because some evidence is a page in a printed report.
	 */
	stats: section.extend({
		/** Introduces every source line — "Źródło", "Source". */
		sourceLead: line,
		facts: z.array(
			z.object({
				figure: line,
				label: line,
				note: line,
				source: line,
				sourceUrl: line.optional(),
			}),
		),
	}),

	/**
	 * What the petition asks for, as separable demands rather than as prose.
	 *
	 * A signature is agreement to something specific, so the asks are a list a
	 * reader can count and a campaign can extend without a schema change. At
	 * least one, because a petition demanding nothing is not a petition.
	 */
	mechanism: section.extend({
		lede: line,
		/** Names the body being asked to act — "Adresat petycji". */
		addresseeLabel: line,
		/**
		 * The body itself, which is the site config's `{{petitionAddressee}}`
		 * rather than a sentence. It is a content key so that a campaign can
		 * write around it — some petitions address two offices at once — without
		 * the component learning anything about how it is worded.
		 */
		addressee: line,
		demands: z.array(z.object({ title: line, description: line })).min(1),
		/** What happens to the demands once the collection ends. */
		note: line,
	}),

	/**
	 * Passing the petition on.
	 *
	 * The network names are copy rather than constants because what the label
	 * says is "share on X", not "X" — a phrase that translates and that a
	 * screen reader announces as an action.
	 */
	share: section.extend({
		note: line,
		/** The sentence that travels with the link where a network accepts one. */
		message: line,
		networks: z.object({ facebook: line, x: line, linkedin: line, whatsapp: line }),
		copyLink: line,
		/** Confirms the address is on the reader's clipboard. */
		copied: line,
		/** Said when the browser refused the clipboard, so the reader can select it. */
		copyFailed: line,
	}),

	faq: section.extend({
		note: line,
		items: z.array(z.object({ question: line, answer: line })).min(1),
	}),

	/**
	 * Who is behind the petition, and where its documents are.
	 *
	 * The identity block is not decoration: the consent texts above it name an
	 * administrator, and a reader who wants to check that claim — or to write
	 * to them — should not have to open a legal document to find an address.
	 */
	footer: z.object({
		name: line,
		description: line,
		/** Heads this deployment's own legal documents. */
		legalHeading: line,
		socialHeading: line,
		/** What each profile link is called; shown only for a configured profile. */
		socialNetworks: z.object({ facebook: line, x: line, linkedin: line }),
		disclaimer: line,
		/** One link back to the software, whole — never a sentence split around it. */
		colophon: line,
		licenseLead: line,
		licenseLabel: line,
	}),

	/** The theme control's labels — it sits in the navigation bar on every page. */
	theme: z.object({
		label: line,
		options: z.object({
			light: z.object({ label: line, description: line }),
			dark: z.object({ label: line, description: line }),
			system: z.object({ label: line, description: line }),
		}),
	}),

	/**
	 * The two pages a reader reaches by accident. They are pages like any other
	 * and a visitor arrives at them in the same language they were browsing in,
	 * so their copy is translated rather than left in the base template's
	 * English.
	 */
	notFound: z.object({
		heading: line,
		description: line,
		back: line,
		home: line,
		hint: line,
	}),

	errorBoundary: z.object({
		heading: line,
		description: line,
		/** Shown when the thrown error carried no message of its own. */
		fallbackMessage: line,
		retry: line,
		home: line,
		back: line,
		detailsToggle: line,
		stackHeading: line,
		supportNote: line,
		report: line,
		/** Subject and body of the mail the report button opens. */
		reportSubject: line,
		reportIntro: line,
		reportPrompt: line,
	}),

	/**
	 * The legal layer. The documents themselves are Polish-only Markdown
	 * fixtures in `src/content/legal/tokenized/` and are not translated — a
	 * second wording would be a second legal text nobody has approved. What a
	 * language file carries is everything around them: the notice an English
	 * reader gets about that, and how each document is announced to a browser
	 * tab, a search result and a link in the footer.
	 *
	 * `documents` is keyed by the names in `src/content/legal`;
	 * `src/content/legal/index.test.ts` is what keeps the two in step.
	 */
	legal: z.object({
		polishOnlyNotice: line,
		documents: z.object({
			rodoClause: z.object({ title: line, description: line }),
			privacyPolicy: z.object({ title: line, description: line }),
		}),
	}),
});

export type Content = z.infer<typeof contentSchema>;

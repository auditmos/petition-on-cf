import { z } from "zod";

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

	nav: z.object({
		brand: line,
		tagline: line,
		items: z.array(z.object({ label: line, sectionId: line })),
		repositoryLabel: line,
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
		}),
		consentRodo: line,
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
			consentRodo: line,
			/** Shown when the signer submits before the widget has vouched for them. */
			turnstile: line,
			tooLong: line,
			emailTooLong: line,
		}),
	}),

	stats: section.extend({
		facts: z.array(z.object({ figure: line, label: line, note: line })),
	}),

	features: section.extend({
		lede: line,
		/** `key` selects the icon; icons are components and stay in components. */
		items: z.array(z.object({ key: line, title: line, phase: line, description: line })),
	}),

	howItWorks: section.extend({
		paths: z.array(z.object({ step: line, title: line, phase: line, steps: z.array(line).min(1) })),
		architecture: section.extend({
			rules: z.array(z.object({ term: line, definition: line })),
		}),
	}),

	/**
	 * Reserved by the plan and modelled now so the section that renders it is a
	 * component change rather than a schema change. Ships empty.
	 */
	faq: section.extend({
		items: z.array(z.object({ question: line, answer: line })),
	}),

	footer: z.object({
		name: line,
		description: line,
		documentsHeading: line,
		documents: z.array(z.object({ key: line, label: line })),
		disclaimer: line,
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
	 * The legal layer's slot. The documents themselves are Polish-only verbatim
	 * fixtures that render in a later slice; what a language file carries is the
	 * notice an English reader gets about that.
	 */
	legal: z.object({
		polishOnlyNotice: line,
	}),
});

export type Content = z.infer<typeof contentSchema>;

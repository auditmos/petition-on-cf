/**
 * Token vocabulary for the tokenized legal fixtures.
 *
 * The fixtures in `tokenized/` carry the legal wording captured from the
 * reference site with every proper noun replaced by a `{{token}}`. No identity
 * value from that site is stored anywhere in this repository — see
 * `capture/README.md`.
 *
 * `PLACEHOLDER_VALUES` is the honestly-generic demo identity the template ships
 * with (PRD story 29). `init-project` (issue #12) overwrites it with a real
 * organizer's values; issue #9 renders the fixtures through it.
 *
 * ## Why the short name has four entries
 *
 * Polish declines nouns, so an organizer's short name appears in a different
 * form depending on its role in the sentence — "interes Organizacji" but "Z
 * Organizacją". String substitution cannot decline a noun, so the config has to
 * supply each form the legal texts actually use. Four cases cover them: this is
 * the fix for the finding that the reference wording is only grammatical for an
 * organizer whose short name declines exactly like the original's.
 */
export const PLACEHOLDER_VALUES = {
	/** Petition name, always rendered inside Polish quotes: „…”. */
	petitionName: "Nazwa petycji",
	/** Administrator's full legal name, in caps as legal documents write it. */
	organizerLegalName: "NAZWA ORGANIZATORA PETYCJI",
	/** The same entity in title case, for running prose. */
	organizerName: "Nazwa Organizatora Petycji",
	/** Short name, mianownik — "(„Organizacja”)", "Organizacja zapewnia". */
	organizerShortName: "Organizacja",
	/** Short name, dopełniacz — "interes Organizacji". */
	organizerShortNameGen: "Organizacji",
	/** Short name, biernik — "przez Organizację". */
	organizerShortNameAcc: "Organizację",
	/** Short name, narzędnik — "Z Organizacją". */
	organizerShortNameIns: "Organizacją",
	organizerStreet: "ul. Przykładowa 1",
	organizerCity: "00-001 Miasto",
	organizerKrs: "0000000000",
	organizerNip: "0000000000",
	organizerRegon: "000000000",
	contactEmail: "kontakt@example.org",
	domain: "example.org",
	/** Route the legal layer serves the RODO clause at, not a PDF path. */
	rodoClauseUrl: "/klauzula-informacyjna-rodo",
	privacyPolicyUrl: "/polityka-prywatnosci",
} as const;

export type LegalToken = keyof typeof PLACEHOLDER_VALUES;

export const LEGAL_TOKENS = Object.keys(PLACEHOLDER_VALUES) as LegalToken[];

/** Matches any `{{token}}` placeholder, whether or not the name is known. */
export const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

/** Replace every `{{token}}` with the value `values` gives for it. */
export function interpolate(text: string, values: Record<LegalToken, string>): string {
	return text.replace(TOKEN_PATTERN, (whole, name: string) =>
		name in values ? values[name as LegalToken] : whole,
	);
}

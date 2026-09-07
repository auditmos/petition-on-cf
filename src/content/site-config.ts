/**
 * Who this deployment is, in one place.
 *
 * Every proper noun the site says about itself lives here and reaches the copy
 * as a `{{token}}`: the content files carry sentences, this carries identity.
 * `init-project` (issue #12) overwrites these values with a real organizer's;
 * what ships is honestly-generic placeholder text, so a fresh deployment reads
 * as a demo rather than as somebody's real campaign with the wrong name on it.
 *
 * ## Why some names carry one entry per grammatical case
 *
 * Polish declines nouns, so a name appears in a different form depending on its
 * role in the sentence — "interes Organizacji" but "Z Organizacją". String
 * substitution cannot decline a noun, so the config has to supply each form the
 * texts actually use.
 *
 * That applies twice. The organizer's short name needs four cases, which is
 * what makes the wording grammatical for an organizer whose short name does not
 * decline like the reference one's. The noun for a non-personal signer needs its
 * own, because the deployment chooses that word: "firma" and "organizacja"
 * decline differently ("nazwy firmy" vs "nazwy organizacji"), so it cannot be
 * one token reused everywhere either.
 */
export const SITE_CONFIG = {
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
	/**
	 * The word this deployment uses for a non-personal signer, in the three
	 * cases the copy declines it into. The deployment picks the noun once
	 * (issue #12) and every sentence that mentions it reads from here — a
	 * campaign signing companies writes "firma" and gets "nazwa firmy" and
	 * "funkcja w firmie" without editing a single sentence.
	 *
	 * Mianownik — the signer-type toggle: "organizacja".
	 */
	signerOrgNoun: "organizacja",
	/** Dopełniacz — the name label and the public-list consent: "nazwa organizacji". */
	signerOrgNounGen: "organizacji",
	/** Miejscownik — the role label: "Twoja funkcja w organizacji". */
	signerOrgNounLoc: "organizacji",
	/**
	 * Turnstile site key — public by design, which is why it lives here rather
	 * than in the Worker's secrets: the widget script reads it in the browser,
	 * so it is served to everyone who loads the page anyway. Its secret half is
	 * `TURNSTILE_SECRET_KEY`, which never leaves the Worker.
	 *
	 * What ships is Cloudflare's official always-pass **test** key: it renders
	 * a real widget that approves every visitor, so a fresh clone signs without
	 * a Cloudflare account. Replace it with a real one from Turnstile → Add
	 * widget, and push the matching secret, before collecting anything real —
	 * the README's "Turnstile keys" section is the whole procedure.
	 */
	turnstileSiteKey: "1x00000000000000000000AA",
	organizerStreet: "ul. Przykładowa 1",
	organizerCity: "00-001 Miasto",
	organizerKrs: "0000000000",
	organizerNip: "0000000000",
	organizerRegon: "000000000",
	contactEmail: "kontakt@example.org",
	domain: "example.org",
	/** Absolute origin, needed by hreflang and Open Graph — both refuse a path. */
	siteUrl: "https://example.org",
	/** Route the legal layer serves the RODO clause at, not a PDF path. */
	rodoClauseUrl: "/klauzula-informacyjna-rodo",
	privacyPolicyUrl: "/polityka-prywatnosci",
	/**
	 * Where the template itself lives. These stay pointed at this repository
	 * even after `init-project` runs: they are about the software, not about
	 * the campaign deploying it.
	 */
	repositoryUrl: "https://github.com/auditmos/petition-on-cf",
	prdUrl: "https://github.com/auditmos/petition-on-cf/issues/1",
	planUrl: "https://github.com/auditmos/petition-on-cf/blob/main/plans/petition-template.md",
	issuesUrl: "https://github.com/auditmos/petition-on-cf/issues",
	licenseUrl: "https://github.com/auditmos/petition-on-cf/blob/main/LICENSE",
} as const;

export type SiteToken = keyof typeof SITE_CONFIG;

/**
 * Whether this deployment asks a non-personal signer for their role in it.
 *
 * "Twoja funkcja w organizacji" is worth asking when an association or an NGO
 * endorses and it matters who signed on its behalf; it is noise when a company
 * signs under its own name. So it is the deployment's choice, and the default
 * follows the noun above — collected for *organizacja*, not for *firma*.
 * `init-project` (issue #12) sets it. When shown it is never required, and the
 * column behind it is nullable whichever way this goes, so changing it is never
 * a migration.
 *
 * It lives beside `SITE_CONFIG` rather than in it because that object is a
 * record of strings, interpolated into copy. This is neither a string nor
 * something a sentence can contain.
 */
export const COLLECT_SIGNER_ROLE = true;

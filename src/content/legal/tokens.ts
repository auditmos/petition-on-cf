import { SITE_CONFIG, type SiteToken } from "@/content/site-config";

/**
 * Token vocabulary for the tokenized legal fixtures.
 *
 * The fixtures in `tokenized/` carry the legal wording captured from the
 * reference site with every proper noun replaced by a `{{token}}`. No identity
 * value from that site is stored anywhere in this repository — see
 * `capture/README.md`.
 *
 * The values come from `src/content/site-config.ts`, the same place the UI copy
 * draws on, so an organizer's name is written once and reads the same in a
 * heading and in a consent checkbox. What stays here is which of those tokens
 * the legal texts are allowed to use: the config is deliberately wider, and a
 * legal fixture reaching for a token that belongs to the interface is a
 * mistake this list catches.
 */
export const LEGAL_TOKENS = [
	"petitionName",
	"organizerLegalName",
	"organizerName",
	"organizerShortName",
	"organizerShortNameGen",
	"organizerShortNameAcc",
	"organizerShortNameIns",
	"signerOrgNounGen",
	"organizerStreet",
	"organizerCity",
	"organizerKrs",
	"organizerNip",
	"organizerRegon",
	"contactEmail",
	"domain",
	"rodoClauseUrl",
	"privacyPolicyUrl",
] as const satisfies readonly SiteToken[];

export type LegalToken = (typeof LEGAL_TOKENS)[number];

/**
 * The demo identity the legal fixtures resolve against (PRD story 29).
 *
 * Narrowed from the site config rather than restated, so the two cannot say
 * different things about the same organizer. `init-project` (issue #12)
 * overwrites the config; issue #9 renders the fixtures through this.
 */
export const PLACEHOLDER_VALUES = Object.fromEntries(
	LEGAL_TOKENS.map((token) => [token, SITE_CONFIG[token]]),
) as Record<LegalToken, string>;

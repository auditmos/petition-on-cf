import { SITE_CONFIG } from "@/content/site-config";
import { interpolate } from "@/content/tokens";
import consentPublicListOrganization from "./tokenized/consent-public-list-organization.md?raw";
import consentPublicListPerson from "./tokenized/consent-public-list-person.md?raw";
import consentRodoAcknowledgment from "./tokenized/consent-rodo-acknowledgment.md?raw";
import consentUpdates from "./tokenized/consent-updates.md?raw";
import inlineKlauzula from "./tokenized/inline-klauzula-informacyjna.md?raw";
import rodoClause from "./tokenized/klauzula-rodo-podpisanie-petycji.md?raw";
import privacyPolicy from "./tokenized/polityka-prywatnosci.md?raw";

/**
 * The legal layer's texts, ready to render.
 *
 * The fixtures in `tokenized/` are the wording; the site config is the
 * identity; this is where the two meet. A caller asks for a text by name and
 * gets Markdown with every `{{token}}` already resolved — it never sees a file
 * path, an import, or a token.
 *
 * Some of these are pages and some are a line beside a checkbox, but they are
 * one kind of thing: wording this deployment is legally bound by, which no
 * component is allowed to paraphrase. Only the routed ones carry a `path`.
 *
 * ## Where they come from
 *
 * Everything except the privacy policy is captured wording — verbatim from the
 * reference site, per issue #3, with every proper noun tokenized. The privacy
 * policy is not: the reference one described a scam-reporting operation this
 * template does not run, and a clause describing processing that never happens
 * is worse than no clause. So it was written here, against what the code
 * actually does — the fields the form collects, the IP that is spent on the bot
 * check and never stored, the theme preference that lives in the browser, the
 * e-mail that is never sent. A deployment that collects anything else has to
 * amend it, and every organizer is responsible for having it reviewed before
 * going live; the footer says as much on every page.
 */
const TEXTS = {
	consentRodoAcknowledgment,
	consentPublicListPerson,
	consentPublicListOrganization,
	consentUpdates,
	inlineKlauzula,
	rodoClause,
	privacyPolicy,
} as const;

export type LegalTextName = keyof typeof TEXTS;

/**
 * The texts that are also pages, and where each is served.
 *
 * The path comes from the site config, so the route, the footer link and the
 * href inside a consent checkbox are all reading one value — a document cannot
 * move and leave its links behind.
 */
const DOCUMENT_PATHS = {
	rodoClause: SITE_CONFIG.rodoClauseUrl,
	privacyPolicy: SITE_CONFIG.privacyPolicyUrl,
} as const satisfies Partial<Record<LegalTextName, string>>;

export type LegalDocumentName = keyof typeof DOCUMENT_PATHS;

/** Every document, for anything that has to cover all of them. */
export const LEGAL_DOCUMENT_NAMES = Object.keys(DOCUMENT_PATHS) as LegalDocumentName[];

/** The text, with this deployment's identity filled in. */
export function getLegalText(name: LegalTextName): string {
	return interpolate(TEXTS[name], SITE_CONFIG);
}

/** The path this document is served at, without a language prefix. */
export function legalDocumentPath(name: LegalDocumentName): string {
	return DOCUMENT_PATHS[name];
}

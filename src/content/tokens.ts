/**
 * `{{token}}` substitution, shared by the two things that need it.
 *
 * The UI copy and the legal fixtures are written the same way — sentences with
 * the deployment's proper nouns punched out — so they resolve the same way.
 * One implementation means a token that works in a consent checkbox works in a
 * heading, and a bug in the matching is one bug rather than two.
 */

/** Matches any `{{token}}` placeholder, whether or not the name is known. */
export const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Replace every `{{token}}` with the value `values` gives for it.
 *
 * An unknown token is left standing rather than blanked: a visible `{{oops}}`
 * is a bug somebody fixes, and a silent empty string is a sentence that reads
 * fine and says the wrong thing.
 */
export function interpolate(text: string, values: Readonly<Record<string, string>>): string {
	return text.replace(TOKEN_PATTERN, (whole, name: string) => values[name] ?? whole);
}

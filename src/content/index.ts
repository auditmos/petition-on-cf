import { en } from "./en";
import { pl } from "./pl";
import { type Content, contentSchema } from "./schema";
import { SITE_CONFIG } from "./site-config";
import { interpolate } from "./tokens";

/**
 * The one way to read this site's copy.
 *
 * Callers ask for a language and get validated, fully interpolated content —
 * they never see a raw content file, a schema, or a `{{token}}`. That narrow
 * interface is what lets everything behind it change: the files could become
 * JSON, the token syntax could change, a third language could arrive, and no
 * component would notice.
 *
 * Validation and interpolation happen on every read rather than once at module
 * load. Both are pure work over a few kilobytes of frozen literals, and the
 * alternative — a memoised singleton — buys microseconds in exchange for a
 * cache that has to be right on a Worker isolate reused across requests.
 */

/** Polish is served at `/`, English under `/en`. Order is the routing's. */
export const LANGUAGES = ["pl", "en"] as const;

export type Language = (typeof LANGUAGES)[number];

const FILES: Record<Language, unknown> = { pl, en };

/**
 * Every string in `value`, with `{{tokens}}` replaced from the site config.
 *
 * Walking the parsed object is what keeps the schema and the interpolation
 * independent: a section added to the schema is interpolated the day it is
 * added, without this function learning its name.
 */
function resolveTokens<T>(value: T): T {
	if (typeof value === "string") return interpolate(value, SITE_CONFIG) as T;
	if (Array.isArray(value)) return value.map(resolveTokens) as T;
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, resolveTokens(item)]),
		) as T;
	}
	return value;
}

/** This site's copy in one language, ready to render. */
export function getContent(language: Language): Content {
	return resolveTokens(contentSchema.parse(FILES[language]));
}

export { contentSchema };
export type { Content };

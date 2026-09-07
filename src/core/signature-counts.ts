import { z } from "zod";

/**
 * How many have signed, split by where they signed from.
 *
 * The one shape three places agree on: what D1 is asked for, and what the
 * `LiveCounter` Durable Object and `/api/signatures/snapshot` each put inside
 * the `LiveUpdate` they hand to a page. It lives in `core/` rather than in
 * `src/db/signatures/` because that barrel re-exports query functions —
 * importing the type from there would put Drizzle and the D1 driver on the
 * browser's import graph.
 *
 * A schema rather than an interface because two of those three places are
 * network boundaries the browser reads from, and what arrives over a socket is
 * whatever arrived over a socket.
 */
export const signatureCountsSchema = z.object({
	/** Every stored signature, whatever could or could not be said about it. */
	total: z.number().int().nonnegative(),
	/**
	 * Signatures per stored voivodeship code, including the `unknown` bucket.
	 *
	 * Only codes D1 actually holds appear — a voivodeship nobody has signed
	 * from is absent rather than zero. Filling the other fifteen in is the
	 * map's job (#8), because a map decides what an empty region looks like and
	 * a count query should not.
	 */
	byVoivodeship: z.record(z.string(), z.number().int().nonnegative()),
	/**
	 * How long ago the newest signature arrived, in seconds, or null on a
	 * petition nobody has signed.
	 *
	 * A duration rather than a timestamp because the label built from it is
	 * rendered twice — once on the server, once when the browser hydrates — and
	 * a timestamp turned into "5 minutes ago" needs a clock at each end. The two
	 * clocks disagree by the length of the round trip at best, and by whatever
	 * the reader's machine happens to be set to at worst. A duration is the same
	 * number in both renders, so the page paints a figure it can stand behind
	 * and the browser counts on from there.
	 */
	secondsSinceLastSignature: z.number().int().nonnegative().nullable(),
});

export type SignatureCounts = z.infer<typeof signatureCountsSchema>;

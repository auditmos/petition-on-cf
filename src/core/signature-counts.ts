import { z } from "zod";

/**
 * How many have signed, split by where they signed from.
 *
 * The one shape three places agree on: what D1 is asked for, what the
 * `LiveCounter` Durable Object broadcasts over a WebSocket, and what
 * `/api/signatures/snapshot` answers with. It lives in `core/` rather than in
 * `src/db/signatures/` because that barrel re-exports query functions —
 * importing the type from there would put Drizzle and the D1 driver on the
 * browser's import graph.
 *
 * A schema rather than an interface because two of those three places are
 * network boundaries the browser reads from, and what arrives over a socket is
 * whatever arrived over a socket.
 */
const signatureCountsSchema = z.object({
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
});

export type SignatureCounts = z.infer<typeof signatureCountsSchema>;

/**
 * Counts read off the network, or nothing if what arrived was not counts.
 *
 * Nothing rather than a throw, and nothing rather than a zero: a caller that
 * cannot read a push should go on showing the number it last verified. A zero
 * would be a petition announcing it had lost every signature.
 */
export function parseSignatureCounts(payload: unknown): SignatureCounts | null {
	const parsed = signatureCountsSchema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}

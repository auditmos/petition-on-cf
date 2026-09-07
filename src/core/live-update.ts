import { z } from "zod";
import { signatureCountsSchema } from "./signature-counts";
import { supporterSchema } from "./supporters";

/**
 * What the petition pushes at a page that is watching it.
 *
 * One object rather than two, because the counter and the list are two views of
 * the same event: a signature arrives, the number moves, and — if its signer
 * agreed to be named — a name appears. Sending them separately would let a page
 * hold a total from one moment beside a name from another.
 *
 * `supporters` is not the list. It is the handful of newest published names the
 * sender believes the receiver has not seen, bounded so that a push costs the
 * same whether the petition has twenty signatures or twenty thousand. What the
 * page does with them — prepend, deduplicate, leave the loaded pages alone — is
 * the page's business, and it is why the client keys on `id`.
 *
 * A schema rather than an interface because this is what arrives over a socket
 * and out of a fetch, and what arrives over a socket is whatever arrived over a
 * socket.
 */
const liveUpdateSchema = z.object({
	counts: signatureCountsSchema,
	supporters: z.array(supporterSchema),
});

export type LiveUpdate = z.infer<typeof liveUpdateSchema>;

/**
 * An update read off the network, or nothing if what arrived was not one.
 *
 * Nothing rather than a throw, and nothing rather than an empty update: a
 * caller that cannot read a push should go on showing the number and the names
 * it last verified. A zero would be a petition announcing it had lost every
 * signature, and an empty list would be one announcing nobody had signed it.
 */
export function parseLiveUpdate(payload: unknown): LiveUpdate | null {
	const parsed = liveUpdateSchema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}

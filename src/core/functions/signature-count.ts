import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { readSignatureCounts } from "@/db/signatures";

/**
 * The landing page's count, read on the server.
 *
 * A server function rather than a plain loader body: a loader runs in the
 * browser too on client-side navigation, and neither the D1 binding nor the
 * Drizzle driver belongs in a bundle the browser downloads.
 *
 * `env` comes from `cloudflare:workers` because a loader has no request context
 * to carry a binding on — the Worker's bindings are reachable from anywhere
 * inside the isolate, which is exactly what this needs and nothing more.
 *
 * It reads D1 rather than the `LiveCounter` Durable Object on purpose. This is
 * the first paint, which has to be right; the DO is a cache whose whole job is
 * to be cheap afterwards. The socket takes over from here, and the number it
 * pushes comes from the same query.
 */
export const fetchSignatureCount = createServerFn({ method: "GET" }).handler(async () => {
	const { total } = await readSignatureCounts(env.DB);
	return total;
});

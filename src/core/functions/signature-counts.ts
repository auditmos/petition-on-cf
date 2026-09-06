import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import type { SignatureCounts } from "@/core/signature-counts";
import { readSignatureCounts } from "@/db/signatures";

/**
 * The landing page's counts, read on the server.
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
 * to be cheap afterwards. The socket takes over from here, and the counts it
 * pushes come from the same query.
 *
 * The whole `SignatureCounts` is returned rather than the total because the
 * map is server-rendered too — shading it from a fetch after hydration would
 * paint an empty country first and fill it in a moment later.
 */
export const fetchSignatureCounts = createServerFn({ method: "GET" }).handler(
	async (): Promise<SignatureCounts> => readSignatureCounts(env.DB),
);

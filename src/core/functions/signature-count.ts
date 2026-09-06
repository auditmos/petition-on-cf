import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { countSignatures } from "@/db/signatures";

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
 * Issue #7 replaces this read with a cached value from the `LiveCounter`
 * Durable Object; D1 stays the source of truth behind it.
 */
export const fetchSignatureCount = createServerFn({ method: "GET" }).handler(() =>
	countSignatures(env.DB),
);

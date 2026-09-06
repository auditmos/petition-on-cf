import { Hono, type MiddlewareHandler } from "hono";

/** Middleware that can be attached to an endpoint built by {@link createHono}. */
export type ApiMiddleware = MiddlewareHandler<{ Bindings: Env }>;

/**
 * Builds a Hono endpoint typed against the Worker's `Env` bindings.
 *
 * ## Authentication seam
 *
 * Every middleware passed here runs on `*` before any handler the endpoint
 * registers, so this is the attachment point for authentication, and the one
 * place to attach it from — an endpoint is only as protected as the factory
 * that built it.
 *
 * ```ts
 * const requireApiKey: ApiMiddleware = async (c, next) => {
 *   if (c.req.header("authorization") !== `Bearer ${c.env.API_TOKEN}`) {
 *     return c.json({ error: "Unauthorized" }, 401);
 *   }
 *   await next();
 * };
 *
 * const reportsEndpoint = createHono(requireApiKey);
 * ```
 *
 * This template ships **no** middleware attached, and needs none: the petition
 * site is entirely public and an organizer reads their own data with `wrangler
 * d1` rather than through a protected endpoint. The seam exists for the
 * endpoint this template does not have. See the README's "Security posture"
 * section.
 */
export const createHono = (...middleware: ApiMiddleware[]) => {
	const endpoint = new Hono<{ Bindings: Env }>();
	for (const handler of middleware) {
		endpoint.use("*", handler);
	}
	return endpoint;
};

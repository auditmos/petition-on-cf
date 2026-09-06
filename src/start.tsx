import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

declare module "@tanstack/react-start" {
	interface Register {
		server: {
			requestContext: {
				fromFetch: boolean;
			};
		};
	}
}

/**
 * Same-origin check on every server-function call.
 *
 * Server functions are RPC endpoints the browser reaches over HTTP, so without
 * this any site could invoke them from a visitor's browser. The middleware
 * compares `Sec-Fetch-Site`, then `Origin`, then `Referer` against this origin
 * and answers 403 when none of them matches.
 *
 * Today that guards one read — `fetchSignatureCount`, a public number the page
 * already prints — so it closes nothing that is currently open. It is here as
 * the default the next server function inherits rather than as a fix, and
 * because a template other people deploy should not ship with a security
 * warning switched off.
 *
 * Note what it does *not* cover: the sign endpoint is a Hono route, not a
 * server function, so `POST /api/signatures` never reaches this. Nor would it
 * help there — the site has no session cookie for a forged request to ride on,
 * so anyone wanting to post signatures can do it from their own server. Bot
 * protection is issue #6's job, not this middleware's.
 */
const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => {
	return {
		defaultSsr: true,
		requestMiddleware: [csrfMiddleware],
	};
});

startInstance.createMiddleware().server(({ next }) => {
	return next({
		context: {
			fromStartInstanceMw: true,
		},
	});
});

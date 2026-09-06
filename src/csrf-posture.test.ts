import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const start = readFileSync(resolve(ROOT, "src/start.tsx"), "utf8");
const viteConfig = readFileSync(resolve(ROOT, "vite.config.ts"), "utf8");

/**
 * Server functions are same-origin RPC endpoints reachable over HTTP, so
 * without an origin check any site could invoke them from a visitor's browser.
 * TanStack Start warns when they are unguarded; this keeps the guard in place
 * rather than the warning switched off.
 *
 * The protection is currently worth little on its own — the one server
 * function returns a public count — but it is the default the next one
 * inherits, and re-deriving that decision is what these assertions prevent.
 */
describe("server-function CSRF posture", () => {
	it("registers the CSRF middleware on the start instance", () => {
		expect(start).toMatch(/createCsrfMiddleware/);
		expect(start).toMatch(/requestMiddleware:\s*\[[^\]]*csrfMiddleware/);
	});

	// Scoped to server functions on purpose: applying it to router requests
	// would gate ordinary page loads, which carry no ambient authority and
	// legitimately arrive from anywhere.
	it("scopes the check to server functions rather than to every request", () => {
		expect(start).toMatch(/handlerType\s*===\s*["']serverFn["']/);
	});

	/**
	 * The framework offers a flag that silences the warning without adding the
	 * middleware. Reaching for it turns a security default into a quiet one, so
	 * a deployment of this template would ship unguarded and look fine doing it.
	 */
	it("does not silence the warning instead of answering it", () => {
		expect(viteConfig).not.toMatch(/disableCsrfMiddlewareWarning/);
	});
});

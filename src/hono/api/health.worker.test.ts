import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { resetDatabase } from "@/db/test-support";
import { apiHono } from "@/hono/api";

/**
 * The sibling `health.test.ts` hands the handler an env object it invented, so
 * it proves the handler reads `c.env` and nothing more. Here the bindings come
 * from wrangler.jsonc by way of workerd, so a binding that stopped being wired
 * fails in this file rather than on the first request after a deploy.
 */
describe("environment bindings in the Workers runtime", () => {
	beforeEach(resetDatabase);

	it("binds the vars declared in wrangler.jsonc", () => {
		expect(env.CLOUDFLARE_ENV).toBe("dev");
	});

	it("binds the D1 database", () => {
		expect(typeof env.DB?.prepare).toBe("function");
	});

	// D1 is a binding rather than a remote host, so readiness in a test is the
	// same readiness a deploy has: reachable. The old Postgres driver could only
	// ever report `disconnected` here, which made this assertion vacuous.
	it("carries the binding through a real HTTP request into the handler", async () => {
		const ctx = createExecutionContext();
		const res = await apiHono.fetch(new Request("https://example.com/api/health/ready"), env, ctx);
		await waitOnExecutionContext(ctx);

		const body = (await res.json()) as { env: string; database: string };
		expect(body.env).toBe(env.CLOUDFLARE_ENV);
		expect(body.database).toBe("connected");
		expect(res.status).toBe(200);
	});
});

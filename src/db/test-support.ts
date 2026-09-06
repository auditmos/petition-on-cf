import { applyD1Migrations, type D1Migration, env } from "cloudflare:test";

/**
 * The migrations `vitest.config.ts` read off disk, delivered as a miniflare
 * binding because that is the only way a Node-side value reaches workerd.
 *
 * It is deliberately not added to `Cloudflare.Env`: the Worker does not have
 * this binding, and typing it as though it did would let application code
 * reference a fixture. The cast is the seam, and it lives here once.
 */
function testMigrations(): D1Migration[] {
	return (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;
}

/**
 * Puts the local D1 into the state a fresh deployment starts in.
 *
 * The pool shares one database across the tests in a file, so a clean slate is
 * something each test asks for rather than something it inherits. Applying the
 * migrations is idempotent; emptying the tables is what isolates.
 */
export async function resetDatabase(): Promise<void> {
	await applyD1Migrations(env.DB, testMigrations());
	await env.DB.prepare("DELETE FROM signatures").run();
}

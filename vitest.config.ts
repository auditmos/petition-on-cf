import { resolve } from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const alias = { "@": resolve(import.meta.dirname, "src") };

/**
 * The migrations Wrangler would apply, read off disk rather than restated.
 *
 * Storage is isolated per test, so a Workers test that needs the schema applies
 * these itself with `applyD1Migrations` — which means the thing under test is
 * the migration that ships, and a schema change with no migration behind it
 * fails here rather than after a deploy.
 */
const D1_MIGRATIONS = await readD1Migrations(resolve(import.meta.dirname, "src/db/migrations/dev"));

/**
 * Anything ending `.worker.test.ts(x)` runs in workerd; everything else in Node.
 *
 * The `.tsx` half is not a component test that wandered in: a Worker renders
 * React on the server, so proving that a D1 count reaches the markup needs both
 * the runtime's bindings and JSX in the same file.
 */
const WORKER_TESTS = "src/**/*.worker.test.{ts,tsx}";

/** A `.tsx` test renders something, so it gets a DOM. */
const COMPONENT_TESTS = "src/**/*.test.tsx";

const APP_ENTRY = "@tanstack/react-start/server-entry";
const APP_ENTRY_STUB = "\0app-entry-stub";

/**
 * Stands in for TanStack Start's server entry inside workerd.
 *
 * The real entry resolves `#tanstack-router-entry` and friends, which only
 * exist once the Start plugin has run a full build — importing it here fails
 * before a single test runs. Stubbing it is not a loss: what these tests are
 * for is the dispatch in `src/server.ts`, and a stub that answers with a
 * recognisable marker proves a request reached the application handler far
 * more precisely than rendered HTML would. Server-side rendering is covered by
 * the component test project, not this one.
 */
const stubAppEntry = () => ({
	name: "stub-tanstack-start-entry",
	enforce: "pre" as const,
	resolveId: (id: string) => (id === APP_ENTRY ? APP_ENTRY_STUB : null),
	load: (id: string) =>
		id === APP_ENTRY_STUB
			? `export default { fetch: () => new Response("app", { headers: { "x-handled-by": "app" } }) }`
			: null,
});

export default defineConfig({
	test: {
		projects: [
			// Configuration and documentation invariants. No runtime needed, so
			// paying for one would only slow them down.
			{
				resolve: { alias },
				test: {
					name: "node",
					globals: true,
					include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
					exclude: ["src/routes/**", WORKER_TESTS],
				},
			},
			// Components, under a DOM. Rendering is the whole point of these, so
			// they get jsdom rather than a runtime that can only answer requests.
			{
				resolve: { alias },
				test: {
					name: "components",
					globals: true,
					environment: "jsdom",
					setupFiles: ["./src/dom-shims.ts"],
					include: [COMPONENT_TESTS],
					exclude: ["src/routes/**", WORKER_TESTS],
				},
			},
			// The real thing: workerd, the bindings from wrangler.jsonc, and the
			// entry point that actually gets deployed.
			{
				plugins: [
					stubAppEntry(),
					cloudflareTest({
						wrangler: { configPath: "./wrangler.jsonc" },
						miniflare: {
							// Not a binding the Worker has — a test fixture, delivered the
							// only way a Node-side value can reach workerd. The D1 binding
							// itself comes from wrangler.jsonc, as a real local database.
							bindings: { TEST_MIGRATIONS: D1_MIGRATIONS },
						},
					}),
				],
				resolve: { alias },
				test: {
					name: "workers",
					globals: true,
					include: [WORKER_TESTS],
					exclude: ["src/routes/**"],
				},
			},
		],
	},
});

import { defineConfig } from "drizzle-kit";

/**
 * Generates SQLite migrations for Cloudflare D1; Wrangler applies them
 * (`pnpm db:migrate:staging`). Generation reads the schema off disk and needs
 * no database credentials at all — which is why a clone can produce and apply
 * the whole schema locally before it has a Cloudflare account.
 */
export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations/staging",
	dialect: "sqlite",
});

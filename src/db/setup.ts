import { drizzle } from "drizzle-orm/d1";

/**
 * The one place that knows which Drizzle driver this project uses.
 *
 * D1 is a binding, not a connection: there is no handshake to amortise and no
 * pool to keep warm, so the wrapper is built per call rather than cached in a
 * module variable. Passing the binding in — instead of reaching for `env` here —
 * is what lets a test hand a query its own isolated database.
 *
 * `src/db/driver-boundary.test.ts` keeps this the only importer of a driver.
 */
export function getDb(binding: D1Database) {
	return drizzle(binding);
}

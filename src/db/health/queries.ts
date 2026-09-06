import { sql } from "drizzle-orm";
import { rootCauseMessage } from "@/core/errors";
import { getDb } from "@/db/setup";
import type { DatabaseStatus } from "./schema";

export async function checkDatabase(binding: D1Database): Promise<DatabaseStatus> {
	try {
		await getDb(binding).run(sql`SELECT 1`);
		return "connected";
	} catch (err) {
		// biome-ignore lint/suspicious/noConsole: structured log for failed health checks surfaces in Workers tail
		console.error(
			JSON.stringify({
				message: "db health check failed",
				error: rootCauseMessage(err),
			}),
		);
		return "disconnected";
	}
}

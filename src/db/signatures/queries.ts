import { count } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { signatures } from "./table";

/** Total signatures stored. D1 is the source of truth for this number. */
export async function countSignatures(binding: D1Database): Promise<number> {
	const [row] = await getDb(binding).select({ total: count() }).from(signatures);
	return row?.total ?? 0;
}

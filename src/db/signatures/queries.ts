import { count } from "drizzle-orm";
import { isUniqueViolation } from "@/core/errors";
import type { SignatureInput } from "@/core/signature-input";
import { getDb } from "@/db/setup";
import { signatures } from "./table";

/** Total signatures stored. D1 is the source of truth for this number. */
export async function countSignatures(binding: D1Database): Promise<number> {
	const [row] = await getDb(binding).select({ total: count() }).from(signatures);
	return row?.total ?? 0;
}

/**
 * Whether the signature was stored, or the e-mail had already signed.
 *
 * A duplicate is an outcome the caller branches on, not a failure — hence a
 * union rather than a thrown error.
 */
export type SignatureWrite = { status: "created" } | { status: "duplicate" };

/**
 * Store one signature, letting the unique index decide what is a duplicate.
 *
 * Looking the e-mail up first and inserting if absent is not a check but a
 * race: two concurrent submissions both find nothing and both insert. The index
 * is the only thing that can decide, so this attempts the write and reads the
 * answer off the failure.
 *
 * The voivodeship arrives as its own argument rather than inside `input`
 * because it is not something the signer submitted: the pipeline derives it
 * from their postal code and the platform's geo-IP. Keeping it separate is
 * what stops a crafted payload from choosing its own region.
 */
export async function insertSignature(
	binding: D1Database,
	input: SignatureInput,
	voivodeshipCode: string,
): Promise<SignatureWrite> {
	try {
		await getDb(binding)
			.insert(signatures)
			.values({ ...input, voivodeshipCode });
		return { status: "created" };
	} catch (error) {
		if (isUniqueViolation(error)) return { status: "duplicate" };
		throw error;
	}
}

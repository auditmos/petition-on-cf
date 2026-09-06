import { count, sql } from "drizzle-orm";
import { isUniqueViolation } from "@/core/errors";
import type { SignatureCounts } from "@/core/signature-counts";
import type { SignatureInput } from "@/core/signature-input";
import { UNKNOWN_VOIVODESHIP } from "@/core/voivodeship";
import { getDb } from "@/db/setup";
import { signatures } from "./table";

/**
 * The region a row is counted under.
 *
 * Attribution has written the string `unknown` since #6, but the column is
 * nullable and every row stored before that carries a null. Coalescing here
 * rather than in each reader is what keeps the bucket a single idea: a
 * signature is a signature whether or not anything could place it on a map.
 */
const bucket = sql<string>`coalesce(${signatures.voivodeshipCode}, ${UNKNOWN_VOIVODESHIP})`;

/**
 * How many have signed, and from where. D1 is the source of truth for both.
 *
 * One `GROUP BY` rather than a count and a second query beside it, so the
 * total can never disagree with the sum of its parts — which is exactly the
 * disagreement a map with a headline number above it would put on screen.
 */
export async function readSignatureCounts(binding: D1Database): Promise<SignatureCounts> {
	const rows = await getDb(binding)
		.select({ code: bucket, signed: count() })
		.from(signatures)
		.groupBy(bucket);

	const counts: SignatureCounts = { total: 0, byVoivodeship: {} };
	for (const row of rows) {
		counts.total += row.signed;
		counts.byVoivodeship[row.code] = row.signed;
	}
	return counts;
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

import { and, count, desc, eq, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { isUniqueViolation } from "@/core/errors";
import type { SignatureCounts } from "@/core/signature-counts";
import type { SignatureInput } from "@/core/signature-input";
import {
	decodeSupporterCursor,
	encodeSupporterCursor,
	type SupporterPage,
} from "@/core/supporters";
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

/**
 * The public list's page size, decided here rather than by the caller.
 *
 * A client that names its own page size is a client that can ask for the whole
 * list in one request, which is the one shape this endpoint exists to avoid.
 */
const SUPPORTERS_PER_PAGE = 24;

/**
 * The published form of a name.
 *
 * A person is "Anna K." — the initial arrives from SQL as a single character,
 * so the surname itself never leaves the database. An entity is its own name,
 * which is what its signer put forward; the empty fallback is unreachable,
 * because the query below refuses to return a row that has no name to publish.
 */
function publishedName(row: {
	firstName: string;
	surnameInitial: string;
	signerType: string;
	companyName: string | null;
}): string {
	if (row.signerType === "company") return row.companyName ?? "";
	return `${row.firstName} ${row.surnameInitial.toUpperCase()}.`;
}

/**
 * One page of the people who agreed to be named, newest first.
 *
 * Consent is the whole point: a signature counts toward the total whatever its
 * signer decided about appearing, and reaches this list only if they said yes.
 * So the filter is in the query rather than in whatever renders it — there is
 * no code path that reads a non-consenting row and then declines to show it.
 *
 * Only the surname's first character is selected. Redacting after reading
 * would work just as well until somebody logged the row or widened the return
 * type; selecting `substr` makes the promise structural.
 */
export async function readSupporters(
	binding: D1Database,
	cursor?: string | null,
): Promise<SupporterPage> {
	const from = decodeSupporterCursor(cursor);
	const at = from ? new Date(from.createdAt * 1000) : null;

	// Strictly after the row the cursor names, in the same two terms the
	// ordering uses — anything else would skip or repeat the rows sharing that
	// second. Built here rather than inline so the narrowing holds: past this
	// point `from` is either a whole cursor or no cursor.
	const after =
		from && at
			? or(
					lt(signatures.createdAt, at),
					and(eq(signatures.createdAt, at), lt(signatures.id, from.id)),
				)
			: undefined;

	// One more than a page. Whether a next page exists is then something the
	// rows answer, rather than a second `count(*)` over the same predicate that
	// could disagree with them under a concurrent insert.
	const rows = await getDb(binding)
		.select({
			id: signatures.id,
			createdAt: signatures.createdAt,
			firstName: signatures.firstName,
			surnameInitial: sql<string>`substr(${signatures.surname}, 1, 1)`,
			city: signatures.city,
			signerType: signatures.signerType,
			companyName: signatures.companyName,
		})
		.from(signatures)
		.where(
			and(
				eq(signatures.consentPublicList, true),
				// A row that would publish as a blank line is not published. The sign
				// endpoint cannot create one, but the database is also written by hand.
				or(ne(signatures.signerType, "company"), isNotNull(signatures.companyName)),
				after,
			),
		)
		.orderBy(desc(signatures.createdAt), desc(signatures.id))
		.limit(SUPPORTERS_PER_PAGE + 1);

	const page = rows.slice(0, SUPPORTERS_PER_PAGE);
	const last = rows.length > SUPPORTERS_PER_PAGE ? page.at(-1) : undefined;

	return {
		supporters: page.map((row) => ({
			id: row.id,
			name: publishedName(row),
			city: row.signerType === "company" ? null : row.city,
		})),
		nextCursor: last
			? encodeSupporterCursor({
					createdAt: Math.floor(last.createdAt.getTime() / 1000),
					id: last.id,
				})
			: null,
	};
}

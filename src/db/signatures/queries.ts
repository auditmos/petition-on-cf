import { and, count, desc, eq, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { isUniqueViolation } from "@/core/errors";
import type { LiveUpdate } from "@/core/live-update";
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
 * How long ago this group's newest row was stored, by the database's clock.
 *
 * A duration rather than the instant itself, and that is the whole point: an
 * instant has to be subtracted from a clock wherever it is read, and where this
 * one is read is a browser. A reader whose machine is an hour out of true would
 * be told a signature from a minute ago arrived an hour back — or, if their
 * clock runs slow, that the next one has already arrived. A duration measured
 * here is the same number on every machine that receives it.
 */
const sinceNewest = sql<number | null>`unixepoch() - max(${signatures.createdAt})`;

/**
 * How many have signed, from where, and how long ago the last one did. D1 is
 * the source of truth for all three.
 *
 * One `GROUP BY` rather than a count and a second query beside it, so the
 * total can never disagree with the sum of its parts — which is exactly the
 * disagreement a map with a headline number above it would put on screen. The
 * tempo rides along for the same reason it costs nothing: it is an aggregate
 * over rows this query is already visiting.
 *
 * The smallest per-group duration is the newest signature overall, and every
 * group is asked — a signature the counter counts is a signature the tempo
 * reports, whatever its signer decided about being named.
 */
export async function readSignatureCounts(binding: D1Database): Promise<SignatureCounts> {
	const rows = await getDb(binding)
		.select({ code: bucket, signed: count(), since: sinceNewest })
		.from(signatures)
		.groupBy(bucket);

	const counts: SignatureCounts = { total: 0, byVoivodeship: {}, secondsSinceLastSignature: null };
	for (const row of rows) {
		counts.total += row.signed;
		counts.byVoivodeship[row.code] = row.signed;

		// Clamped, because the column is also written by hand and a row dated
		// into the future would otherwise be reported as arriving in it.
		const since = row.since === null ? null : Math.max(0, row.since);
		if (
			since !== null &&
			(counts.secondsSinceLastSignature === null || since < counts.secondsSinceLastSignature)
		) {
			counts.secondsSinceLastSignature = since;
		}
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

/**
 * How many published names one live update may carry.
 *
 * Every push reaches every open page, including the heartbeat that fires when
 * nothing has happened, so what travels needs a ceiling that does not grow with
 * the petition. Five names is roughly four hundred bytes beside a payload that
 * is two hundred today — enough that a page which has been open through a burst
 * catches up, small enough that the cost of watching stays flat.
 */
export const LIVE_SUPPORTERS = 5;

/**
 * Everything a watching page needs after a signature lands: the counts, and the
 * newest names that are allowed to be shown.
 *
 * Both the Durable Object and the snapshot endpoint read through here, so the
 * socket and the polling fallback cannot drift into carrying different things
 * — which is the failure that would leave a reader on a blocked network with a
 * moving number beside a frozen list.
 *
 * The names come from `readSupporters` and are sliced afterwards rather than
 * asked for by the dozen. That query owns the consent gate and the redaction,
 * and this is not a second place where either could be got wrong; a page of
 * rows to take five from is what it costs to keep it that way.
 */
export async function readLiveUpdate(binding: D1Database): Promise<LiveUpdate> {
	const [counts, page] = await Promise.all([readSignatureCounts(binding), readSupporters(binding)]);

	return { counts, supporters: page.supporters.slice(0, LIVE_SUPPORTERS) };
}

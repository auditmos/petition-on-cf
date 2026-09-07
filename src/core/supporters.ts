import { z } from "zod";

/**
 * One entry in the public supporters list, as everybody outside the database
 * is allowed to see it.
 *
 * This is the whole of what a signature becomes once it is published: a name
 * that identifies a person only as far as they agreed to be identified, and
 * the place they gave. There is no e-mail here, no full surname and no consent
 * flag, and that is not a filter somebody remembers to apply — it is the type,
 * and the query builds nothing else.
 *
 * A schema rather than an interface for the same reason `SignatureCounts` is
 * one: the browser reads this off the network when it asks for the next page,
 * and what arrives over a fetch is whatever arrived over a fetch.
 */
export const supporterSchema = z.object({
	/** The row's own id. A random UUID, so it says nothing about the signer. */
	id: z.string().min(1),
	/** "Anna K." for a person, the entity's name for anybody else. */
	name: z.string().min(1),
	/**
	 * The town a person gave, and null for a non-personal signer — an entity
	 * signs under its name, and a town beside it would say something the signer
	 * did not.
	 */
	city: z.string().nullable(),
});

/** A page of the list, and how to ask for the one after it. */
const supporterPageSchema = z.object({
	supporters: z.array(supporterSchema),
	/** Null when this page is the last one. */
	nextCursor: z.string().nullable(),
});

export type Supporter = z.infer<typeof supporterSchema>;
export type SupporterPage = z.infer<typeof supporterPageSchema>;

/**
 * A page read off the network, or nothing if what arrived was not a page.
 *
 * Nothing rather than a throw, and nothing rather than an empty page: the
 * reader is looking at names that are already correct, and the honest answer
 * to a malformed response is to leave them there and say the next page could
 * not be loaded.
 */
export function parseSupporterPage(payload: unknown): SupporterPage | null {
	const parsed = supporterPageSchema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}

/**
 * Where a page of the list ended, in the terms the ordering is expressed in.
 *
 * Both halves are needed because `created_at` is Unix *seconds*: a petition
 * collecting more than one signature a second stores rows SQLite considers
 * equal, and "everything older than this second" would skip the rest of that
 * second. The id breaks the tie, so a cursor names one row rather than a
 * moment several rows share.
 */
export interface SupporterCursor {
	/** Unix seconds, as stored. */
	createdAt: number;
	id: string;
}

/**
 * The cursor as it travels: one string, and the client's only job is to hand
 * it back. It is not encrypted and does not need to be — it names a position
 * in a list that is public by construction — but it is not a documented
 * parameter either, which is why the shape is checked on the way back in.
 */
export function encodeSupporterCursor(cursor: SupporterCursor): string {
	return `${cursor.createdAt}.${cursor.id}`;
}

/**
 * Ten digits of Unix seconds outlast this template, a dot, then the id.
 *
 * The id half is checked for shape and length only, never for being a UUID.
 * The application generates UUIDs, but the column is `TEXT` and other things
 * write it — `pnpm db:seed:dev` writes readable ids, and an organizer
 * inserting a row by hand writes whatever they like. A pattern that assumed a
 * UUID refused the cursor this list had just issued over one of those rows,
 * which is pagination that passes every test and breaks on the first real
 * page. What this has to reject is text that was never a cursor; a cursor
 * naming a row that does not exist is answered with the rows behind it, which
 * is the honest answer.
 *
 * The first dot is the seam, so an id may contain one.
 */
const CURSOR = /^(\d{1,10})\.(\S{1,128})$/;

/**
 * A cursor this list issued, or nothing.
 *
 * Nothing rather than a throw, and nothing rather than a first page: the
 * caller decides what an unreadable cursor means. The endpoint refuses it;
 * the query, which only ever sees cursors that already got past the endpoint,
 * starts from the top.
 */
export function decodeSupporterCursor(raw: string | null | undefined): SupporterCursor | null {
	const match = CURSOR.exec(raw ?? "");
	const seconds = match?.[1];
	const id = match?.[2];
	if (!seconds || !id) return null;
	return { createdAt: Number(seconds), id };
}

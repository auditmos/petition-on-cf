import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The petition's only entity. One deployment is one petition, so a signature
 * belongs to the deployment rather than to a petition row — there is no
 * petition table and adding one would be a different product.
 *
 * Storage conventions, fixed here so issues #4, #6 and #9 share one contract:
 *
 * - `id` is a UUID in a `TEXT` column. SQLite has no UUID type, and a
 *   random primary key keeps insertion order out of the public list.
 * - `email` is the dedup key, and the `UNIQUE` index is what enforces it —
 *   application-level checks race, an index does not. Normalisation before
 *   insert is settled in #4.
 * - Booleans are SQLite integers, `NOT NULL DEFAULT 0`. A consent that was
 *   never given reads as false rather than as null, so a query never has to
 *   spell the difference.
 * - `created_at` is Unix seconds, defaulted by the database. A timestamp the
 *   Worker supplies is the Worker's clock; this one is the row's.
 * - `company_name` and `voivodeship_code` are nullable on purpose: a private
 *   person has no company, and geo attribution (#6) can legitimately fail.
 */
export const signatures = sqliteTable("signatures", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	firstName: text("first_name").notNull(),
	surname: text("surname").notNull(),
	email: text("email").notNull().unique(),
	/** Free text, shown as given. Never matched against a dictionary of places. */
	city: text("city").notNull(),
	signerType: text("signer_type", { enum: ["person", "company"] })
		.notNull()
		.default("person"),
	companyName: text("company_name"),
	/** ISO 3166-2:PL subdivision code, from `request.cf` — null when unknown. */
	voivodeshipCode: text("voivodeship_code"),
	/** Mandatory at the boundary; stored so the record shows what was agreed. */
	consentRodo: integer("consent_rodo", { mode: "boolean" }).notNull().default(false),
	consentPublicList: integer("consent_public_list", { mode: "boolean" }).notNull().default(false),
	consentUpdates: integer("consent_updates", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

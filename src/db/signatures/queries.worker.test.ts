import { env } from "cloudflare:test";
import type { SupporterPage } from "@/core/supporters";
import {
	LIVE_SUPPORTERS,
	readLiveUpdate,
	readSignatureCounts,
	readSupporters,
} from "@/db/signatures";
import { resetDatabase } from "@/db/test-support";

/**
 * The migration under test is the one Wrangler applies to a real D1 — read off
 * disk by `readD1Migrations` in vitest.config.ts, not restated here. So a
 * schema change that never made it into a migration fails on the first query
 * rather than on the first deploy.
 */
beforeEach(resetDatabase);

/**
 * The petition's only entity, inserted the way the schema says it stores.
 *
 * `voivodeshipCode` is deliberately optional and deliberately allowed to be
 * null: the column is nullable, and every row written before the trust
 * pipeline (#6) started attributing regions carries a null in it. Those rows
 * still have to be counted somewhere.
 */
async function insertSignature(email: string, voivodeshipCode?: string): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo, voivodeship_code)
		 VALUES (?, ?, ?, ?, ?, 'person', 1, ?)`,
	)
		.bind(crypto.randomUUID(), "Anna", "Kowalska", email, "Warszawa", voivodeshipCode ?? null)
		.run();
}

describe("readSignatureCounts", () => {
	it("counts nothing on a freshly migrated database", async () => {
		expect(await readSignatureCounts(env.DB)).toEqual(
			expect.objectContaining({ total: 0, byVoivodeship: {} }),
		);
	});

	it("counts every stored signature", async () => {
		await insertSignature("anna@example.com", "PL-MZ");
		await insertSignature("jan@example.com", "PL-MZ");
		await insertSignature("ewa@example.com", "PL-DS");

		expect(await readSignatureCounts(env.DB)).toEqual(
			expect.objectContaining({ total: 3, byVoivodeship: { "PL-MZ": 2, "PL-DS": 1 } }),
		);
	});

	// The map (#8) needs these split by region, and it needs the split to add
	// up: a total that disagrees with the sum of its parts is a map with a
	// number beside it that nobody can reconcile.
	it("splits the total into per-voivodeship counts that sum to it", async () => {
		await insertSignature("anna@example.com", "PL-PM");
		await insertSignature("jan@example.com", "PL-PM");
		await insertSignature("ewa@example.com", "PL-SL");
		await insertSignature("olga@example.com", "unknown");

		const counts = await readSignatureCounts(env.DB);
		const summed = Object.values(counts.byVoivodeship).reduce((sum, n) => sum + n, 0);

		expect(summed).toBe(counts.total);
	});

	// Attribution writes the string `unknown` rather than a null, but rows
	// stored before it existed have nulls in that column — and a signature is a
	// signature whether or not anything could place it on a map.
	it("files signatures stored before region attribution under the unknown bucket", async () => {
		await insertSignature("anna@example.com");
		await insertSignature("jan@example.com", "unknown");
		await insertSignature("ewa@example.com", "PL-WP");

		expect(await readSignatureCounts(env.DB)).toEqual(
			expect.objectContaining({ total: 3, byVoivodeship: { unknown: 2, "PL-WP": 1 } }),
		);
	});

	// The dedup key issue #4 will build on. What ships in *this* slice is the
	// constraint that makes dedup enforceable at all — #4 owns the answer a
	// duplicate submission gets back.
	it("refuses a second signature with the same e-mail", async () => {
		await insertSignature("anna@example.com");

		await expect(insertSignature("anna@example.com")).rejects.toThrow(
			/UNIQUE constraint failed: signatures\.email/i,
		);
		expect(await readSignatureCounts(env.DB)).toEqual(expect.objectContaining({ total: 1 }));
	});

	it("carries a unique index on e-mail into the migrated database", async () => {
		const indexes = await env.DB.prepare(
			"SELECT name, \"unique\" FROM pragma_index_list('signatures')",
		).all<{ name: string; unique: number }>();

		const columns = await env.DB.prepare(
			"SELECT name FROM pragma_index_info('signatures_email_unique')",
		).all<{ name: string }>();

		expect(indexes.results).toContainEqual({ name: "signatures_email_unique", unique: 1 });
		expect(columns.results.map((c) => c.name)).toEqual(["email"]);
	});
});

/**
 * A row with the columns the public list reads, and control over the two that
 * decide what it does with the row.
 *
 * Separate from `insertSignature` above because the count tests care about a
 * region and nothing else, while these care about consent, signer type and
 * order — sharing one helper would have made every call site spell out fields
 * its own test has no opinion about.
 */
async function storeSupporter(row: {
	email: string;
	firstName?: string;
	surname?: string;
	city?: string;
	consentPublicList?: boolean;
	/** Unix seconds. Left to the database default unless a test orders rows. */
	createdAt?: number;
}): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo, consent_public_list, created_at)
		 VALUES (?, ?, ?, ?, ?, 'person', 1, ?, coalesce(?, unixepoch()))`,
	)
		.bind(
			crypto.randomUUID(),
			row.firstName ?? "Anna",
			row.surname ?? "Kowalska",
			row.email,
			row.city ?? "Warszawa",
			(row.consentPublicList ?? true) ? 1 : 0,
			row.createdAt ?? null,
		)
		.run();
}

/**
 * The other kind of signer: one that signs under an entity's name.
 *
 * `companyName` is spelled out at every call site rather than defaulted,
 * because whether it is there is the thing these tests are about.
 */
async function storeOrganization(row: {
	email: string;
	companyName: string | null;
	consentPublicList?: boolean;
}): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, company_name, consent_rodo, consent_public_list)
		 VALUES (?, 'Anna', 'Kowalska', ?, 'Warszawa', 'company', ?, 1, ?)`,
	)
		.bind(crypto.randomUUID(), row.email, row.companyName, row.consentPublicList === false ? 0 : 1)
		.run();
}

/**
 * The public list, which is a different question from the count: a signature
 * counts whatever its signer decided about being named, and appears here only
 * if they said yes.
 */
describe("readSupporters", () => {
	it("lists only signers who consented to appear", async () => {
		await storeSupporter({ email: "anna@example.test", city: "Warszawa" });
		await storeSupporter({ email: "piotr@example.test", city: "Kraków", consentPublicList: false });

		const page = await readSupporters(env.DB);

		expect(page.supporters).toHaveLength(1);
		expect(page.supporters[0]?.city).toBe("Warszawa");
	});
});

/**
 * What a signature is allowed to become in public, and it is a short list: a
 * first name, one letter of a surname, and the town the signer typed. The
 * surname is the field this slice exists to keep back — the initial identifies
 * a supporter to people who already know them and to nobody else.
 */
describe("readSupporters, published names", () => {
	it("publishes a person as their first name, an initial and their city", async () => {
		await storeSupporter({
			email: "anna@example.test",
			firstName: "Anna",
			surname: "Kowalska",
			city: "Warszawa",
		});

		const page = await readSupporters(env.DB);

		expect(page.supporters[0]).toEqual(
			expect.objectContaining({ name: "Anna K.", city: "Warszawa" }),
		);
	});

	// Uppercasing is not cosmetic: SQLite's own `upper()` is ASCII-only, so a
	// surname starting with ł, ś or ż would come back lowercase from the
	// database and read as a typo rather than as an initial.
	it("uppercases an initial SQLite would have left alone", async () => {
		await storeSupporter({ email: "lukasz@example.test", firstName: "Łukasz", surname: "łuczak" });

		const page = await readSupporters(env.DB);

		expect(page.supporters[0]?.name).toBe("Łukasz Ł.");
	});

	// An entity signs under its own name, and a town beside it would say
	// something its signer never said — so the city is withheld rather than
	// rendered.
	it("publishes a non-personal signer as its own name, with no city", async () => {
		await storeOrganization({ email: "fundacja@example.test", companyName: "Fundacja Przykład" });

		const page = await readSupporters(env.DB);

		expect(page.supporters[0]).toEqual(
			expect.objectContaining({ name: "Fundacja Przykład", city: null }),
		);
	});

	// Impossible through the sign endpoint, which requires the name — but the
	// database is also written by hand, and a row with nothing to display must
	// not become a blank line on a public page.
	it("omits a non-personal signer that has no name to publish", async () => {
		await storeOrganization({ email: "nameless@example.test", companyName: null });
		await storeOrganization({ email: "fundacja@example.test", companyName: "Fundacja Przykład" });

		const page = await readSupporters(env.DB);

		expect(page.supporters.map((supporter) => supporter.name)).toEqual(["Fundacja Przykład"]);
	});
});

/**
 * Order and pagination, which are one behaviour rather than two: "newest
 * first" is only a promise the caller can rely on if it survives being read a
 * page at a time.
 *
 * The tie-break is what makes that true. `created_at` is Unix *seconds*, so a
 * busy petition stores several signatures under the same value — and two rows
 * SQLite considers equal may come back in either order, which is how a cursor
 * walk loses one row and shows another twice.
 */
describe("readSupporters, order and pages", () => {
	it("puts the newest signature first", async () => {
		await storeSupporter({ email: "middle@example.test", city: "Kraków", createdAt: 200 });
		await storeSupporter({ email: "oldest@example.test", city: "Gdańsk", createdAt: 100 });
		await storeSupporter({ email: "newest@example.test", city: "Poznań", createdAt: 300 });

		const page = await readSupporters(env.DB);

		expect(page.supporters.map((supporter) => supporter.city)).toEqual([
			"Poznań",
			"Kraków",
			"Gdańsk",
		]);
	});

	it("reports no next page when the whole list fits on one", async () => {
		await storeSupporter({ email: "anna@example.test" });

		expect((await readSupporters(env.DB)).nextCursor).toBeNull();
	});

	it("has nothing to show and nowhere to go when nobody has consented", async () => {
		await storeSupporter({ email: "private@example.test", consentPublicList: false });

		expect(await readSupporters(env.DB)).toEqual({ supporters: [], nextCursor: null });
	});

	// The criterion the whole cursor exists for. Every signature here shares one
	// timestamp, which is the case an `ORDER BY created_at` alone gets wrong.
	it("walks the whole list across pages without repeating or losing anybody", async () => {
		const stored = 60;
		for (let n = 0; n < stored; n += 1) {
			await storeSupporter({
				email: `signer-${n}@example.test`,
				city: `City ${n}`,
				createdAt: 500,
			});
		}

		const walked: string[] = [];
		let cursor: string | null = null;
		let pages = 0;

		do {
			const page: SupporterPage = await readSupporters(env.DB, cursor);
			walked.push(...page.supporters.map((supporter) => supporter.id));
			cursor = page.nextCursor;
			pages += 1;
		} while (cursor !== null && pages < 10);

		expect(pages).toBeGreaterThan(1);
		expect(new Set(walked).size).toBe(stored);
		expect(walked).toHaveLength(stored);
	});
});

/**
 * The one read behind every live update, which is two questions answered
 * together: how many have signed, and who most recently agreed to be named.
 *
 * Together rather than separately because the `LiveCounter` Durable Object and
 * the snapshot endpoint both need both, and a page that received a total from
 * one moment and a name from another could show a name the total does not
 * account for.
 *
 * The names come through `readSupporters`, so consent and redaction are that
 * query's answer here exactly as they are on the public list. The tests below
 * assert the consequence rather than the mechanism: a signer who declined is
 * counted and never named.
 */
describe("readLiveUpdate", () => {
	it("answers with the counts and the newest published names at once", async () => {
		await storeSupporter({ email: "anna@example.test", firstName: "Anna", city: "Warszawa" });

		const update = await readLiveUpdate(env.DB);

		expect(update.counts.total).toBe(1);
		expect(update.supporters).toEqual([expect.objectContaining({ name: "Anna K." })]);
	});

	// The behaviour the issue calls intended rather than contradictory: the
	// counter moves for every signature, the list only for the ones that belong
	// on it.
	it("counts a signer who declined publication without ever naming them", async () => {
		await storeSupporter({ email: "anna@example.test", firstName: "Anna", createdAt: 100 });
		await storeSupporter({
			email: "piotr@example.test",
			firstName: "Piotr",
			consentPublicList: false,
			createdAt: 200,
		});

		const update = await readLiveUpdate(env.DB);

		expect(update.counts.total).toBe(2);
		expect(update.supporters.map((supporter) => supporter.name)).toEqual(["Anna K."]);
	});

	// Every push reaches every open page, so what travels has to have a ceiling
	// that does not move with the size of the petition.
	it("carries a bounded number of names however many have signed", async () => {
		for (let n = 0; n < LIVE_SUPPORTERS + 4; n += 1) {
			await storeSupporter({
				email: `signer-${n}@example.test`,
				city: `City ${n}`,
				createdAt: 100 + n,
			});
		}

		const update = await readLiveUpdate(env.DB);

		expect(update.supporters).toHaveLength(LIVE_SUPPORTERS);
		expect(update.supporters[0]?.city).toBe(`City ${LIVE_SUPPORTERS + 3}`);
	});
});

/**
 * How long ago the last signature arrived, which is a different question from
 * how many there are and is answered by the same query.
 *
 * It is a duration rather than an instant, and deliberately so. An instant has
 * to be subtracted from a clock, and the only clock available where the label
 * is read is the reader's — which on a machine an hour out of true would report
 * a signature from a minute ago as an hour old, or as arriving in the future.
 * A duration measured by the database is the same number everywhere.
 *
 * The rows are inserted with `unixepoch()` arithmetic rather than a value from
 * this runtime's clock, so the reading and the writing are the same clock and
 * the assertions can be tight.
 */
describe("readSignatureCounts, the petition's tempo", () => {
	async function storeSignedSecondsAgo(email: string, secondsAgo: number, consent = true) {
		await env.DB.prepare(
			`INSERT INTO signatures (id, first_name, surname, email, city, signer_type, consent_rodo, consent_public_list, created_at)
			 VALUES (?, 'Anna', 'Kowalska', ?, 'Warszawa', 'person', 1, ?, unixepoch() - ?)`,
		)
			.bind(crypto.randomUUID(), email, consent ? 1 : 0, secondsAgo)
			.run();
	}

	it("says nothing about a last signature when nobody has signed", async () => {
		expect(await readSignatureCounts(env.DB)).toEqual({
			total: 0,
			byVoivodeship: {},
			secondsSinceLastSignature: null,
		});
	});

	it("reports how long ago the newest signature arrived", async () => {
		await storeSignedSecondsAgo("old@example.test", 900);
		await storeSignedSecondsAgo("recent@example.test", 300);

		const { secondsSinceLastSignature } = await readSignatureCounts(env.DB);

		expect(secondsSinceLastSignature).toBeGreaterThanOrEqual(300);
		expect(secondsSinceLastSignature).toBeLessThanOrEqual(302);
	});

	// The counter counts every signature, so the tempo it reports is every
	// signature's too. Measuring from the newest *published* one would tell a
	// reader the petition had gone quiet whenever the people signing it happened
	// to decline being named.
	it("measures from the newest signature of any kind, published or not", async () => {
		await storeSignedSecondsAgo("published@example.test", 900);
		await storeSignedSecondsAgo("private@example.test", 60, false);

		const { secondsSinceLastSignature } = await readSignatureCounts(env.DB);

		expect(secondsSinceLastSignature).toBeLessThanOrEqual(62);
	});
});

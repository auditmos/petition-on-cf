import {
	decodeSupporterCursor,
	encodeSupporterCursor,
	parseSupporterPage,
} from "@/core/supporters";

/**
 * The cursor, which is the one thing in the public list that travels out to a
 * client and has to come back.
 *
 * ## Assumptions this file encodes
 *
 * - **Input**: whatever a query string carried, which is to say anything.
 * - **Output**: the position it names, or nothing — never a throw, and never a
 *   silent first page.
 * - **Boundaries**: a cursor over an id the application generated, a cursor
 *   over an id something else wrote, and text that is not a cursor at all.
 */
describe("supporter cursors", () => {
	// The regression this test exists for: the id column is TEXT, and only the
	// *application* fills it with a UUID. `pnpm db:seed:dev` writes readable
	// ids, an organizer inserting a row by hand writes whatever they like, and
	// the endpoint was refusing the cursor it had issued over one of them —
	// pagination worked in every test and broke on the first real page.
	it("reads back a cursor over an id the application did not generate", () => {
		const cursor = { createdAt: 1788699726, id: "seed-PL-PM-2" };

		expect(decodeSupporterCursor(encodeSupporterCursor(cursor))).toEqual(cursor);
	});

	it("reads back a cursor over an id the application did generate", () => {
		const cursor = { createdAt: 1788699726, id: crypto.randomUUID() };

		expect(decodeSupporterCursor(encodeSupporterCursor(cursor))).toEqual(cursor);
	});

	// An id may itself contain the separator, so the *first* dot is the seam
	// and everything after it is the id.
	it("splits on the first dot, so an id may contain one", () => {
		const cursor = { createdAt: 1788699726, id: "row.7" };

		expect(decodeSupporterCursor(encodeSupporterCursor(cursor))).toEqual(cursor);
	});

	it.each([
		"",
		"not-a-cursor",
		"abc.seed-1",
		"1788699726",
		".seed-1",
		"1788699726.",
		null,
		undefined,
	])("refuses %p, which no page of this list ever issued", (raw) => {
		expect(decodeSupporterCursor(raw)).toBeNull();
	});
});

describe("parseSupporterPage", () => {
	it("reads a page off the network", () => {
		const page = { supporters: [{ id: "a", name: "Anna K.", city: "Warszawa" }], nextCursor: null };

		expect(parseSupporterPage(page)).toEqual(page);
	});

	// Nothing rather than an empty page: the names already on screen are true,
	// and replacing them with nothing would be the component announcing that
	// the petition had lost its supporters.
	it("answers with nothing when what arrived was not a page", () => {
		expect(parseSupporterPage({ supporters: [{ name: "Anna K." }], nextCursor: null })).toBeNull();
		expect(parseSupporterPage(undefined)).toBeNull();
	});
});

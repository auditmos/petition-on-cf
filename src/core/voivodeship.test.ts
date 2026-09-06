import {
	resolveVoivodeship,
	UNKNOWN_VOIVODESHIP,
	VOIVODESHIP_CODES,
	type VoivodeshipCode,
} from "./voivodeship";

/**
 * The attribution table and the order it is consulted in.
 *
 * ## Assumptions this file encodes
 *
 * - **Input**: a postal code that has already passed `NN-NNN` validation, or
 *   none; a country and region code straight from `request.cf`, either of
 *   which may be absent, null or a vintage this code did not expect.
 * - **Output**: one of the sixteen ISO 3166-2:PL codes, or the unknown bucket.
 *   Never null, never undefined, never a code outside that set.
 * - **The mapping is approximate near voivodeship borders and that is by
 *   design** — postal districts were drawn around sorting centres, not around
 *   administrative boundaries. What is tested is that it is total and
 *   well-formed, not that every Polish address lands in its true voivodeship,
 *   which no two-digit prefix table can promise.
 */

/** Every two-digit prefix a Polish postal code can start with. */
const ALL_PREFIXES = Array.from({ length: 100 }, (_, n) => String(n).padStart(2, "0"));

describe("the shipped postal-code table", () => {
	// The plan's completeness criterion: no prefix resolves to something that
	// is not a real voivodeship, and none of the sixteen is unreachable.
	it("maps every prefix to one of the sixteen real voivodeship codes", () => {
		const resolved = ALL_PREFIXES.map((prefix) =>
			resolveVoivodeship({ postalCode: `${prefix}-000` }),
		);

		expect(resolved).not.toContain(UNKNOWN_VOIVODESHIP);
		for (const code of resolved) {
			expect(VOIVODESHIP_CODES).toContain(code as VoivodeshipCode);
		}
	});

	it("reaches all sixteen, so no voivodeship can never be attributed", () => {
		const reached = new Set(
			ALL_PREFIXES.map((prefix) => resolveVoivodeship({ postalCode: `${prefix}-000` })),
		);

		expect([...reached].sort()).toEqual([...VOIVODESHIP_CODES].sort());
	});

	/**
	 * Spot checks against the postal districts the ranges were read off, one
	 * per district. A range typed one digit wide passes the totality checks
	 * above and still sends a city to the wrong voivodeship — only a known
	 * address catches that.
	 */
	it.each([
		["00-950", "PL-MZ", "Warszawa"],
		["09-402", "PL-MZ", "Płock"],
		["10-001", "PL-WN", "Olsztyn"],
		["15-001", "PL-PD", "Białystok"],
		["20-001", "PL-LU", "Lublin"],
		["25-001", "PL-SK", "Kielce"],
		["30-001", "PL-MA", "Kraków"],
		["35-001", "PL-PK", "Rzeszów"],
		["40-001", "PL-SL", "Katowice"],
		["45-001", "PL-OP", "Opole"],
		["50-001", "PL-DS", "Wrocław"],
		["60-001", "PL-WP", "Poznań"],
		["65-001", "PL-LB", "Zielona Góra"],
		["70-001", "PL-ZP", "Szczecin"],
		["80-001", "PL-PM", "Gdańsk"],
		["85-001", "PL-KP", "Bydgoszcz"],
		["90-001", "PL-LD", "Łódź"],
	])("puts %s (%s) in the right voivodeship — %s", (postalCode, expected) => {
		expect(resolveVoivodeship({ postalCode })).toBe(expected);
	});
});

describe("resolveVoivodeship", () => {
	it("prefers the postal code over a geo-IP region that disagrees", () => {
		expect(resolveVoivodeship({ postalCode: "50-001", country: "PL", regionCode: "MZ" })).toBe(
			"PL-DS",
		);
	});

	it("uses the geo-IP region when no postal code was given", () => {
		expect(resolveVoivodeship({ country: "PL", regionCode: "MZ" })).toBe("PL-MZ");
	});

	it.each([
		["an empty postal code", { postalCode: "", country: "PL", regionCode: "PM" }, "PL-PM"],
		["a null postal code", { postalCode: null, country: "PL", regionCode: "PM" }, "PL-PM"],
	])("treats %s as no postal code at all", (_label, signals, expected) => {
		expect(resolveVoivodeship(signals)).toBe(expected);
	});

	// The pre-2015 numbering, which some geo databases still emit.
	it("accepts the legacy numeric region codes beside the letter ones", () => {
		expect(resolveVoivodeship({ country: "PL", regionCode: "14" })).toBe("PL-MZ");
		expect(resolveVoivodeship({ country: "PL", regionCode: "02" })).toBe("PL-DS");
	});

	it("accepts a region code in any case", () => {
		expect(resolveVoivodeship({ country: "PL", regionCode: "mz" })).toBe("PL-MZ");
	});

	it.each([
		["nothing is known", {}],
		["the region is unknown to us", { country: "PL", regionCode: "XX" }],
		["the region is absent", { country: "PL", regionCode: null }],
	])("falls through to the unknown bucket when %s", (_label, signals) => {
		expect(resolveVoivodeship(signals)).toBe(UNKNOWN_VOIVODESHIP);
	});

	/**
	 * The country guard, tested where it actually bites: subdivision codes are
	 * only unique *within* a country, so plenty of them collide with Poland's.
	 * Lucerne is `CH-LU` and lubelskie is `PL-LU`; Czech subdivisions are
	 * numbered, and `CZ-20` reads exactly like the pre-2015 code for podlaskie.
	 * Without the `country === "PL"` check, both signers would be filed into a
	 * Polish voivodeship they have never been to.
	 */
	it.each([
		["a signer in Lucerne", { country: "CH", regionCode: "LU" }],
		["a signer in Středočeský kraj", { country: "CZ", regionCode: "20" }],
		["a signer in Bavaria", { country: "DE", regionCode: "BY" }],
	])("does not file %s into a Polish voivodeship", (_label, signals) => {
		expect(resolveVoivodeship(signals)).toBe(UNKNOWN_VOIVODESHIP);
	});

	/**
	 * The fall-through the plan asks for, at the only boundary where it is
	 * reachable. The shipped table covers all hundred prefixes, so no *valid*
	 * postal code misses it — but the resolver is a module in its own right and
	 * must not guess when handed something its table cannot read.
	 */
	it.each([
		"ab-cde",
		"  ",
		"5",
	])("falls back to geo-IP rather than guessing at %s", (postalCode) => {
		expect(resolveVoivodeship({ postalCode, country: "PL", regionCode: "MZ" })).toBe("PL-MZ");
	});

	it("never invents a voivodeship for an unreadable code with no geo-IP", () => {
		expect(resolveVoivodeship({ postalCode: "ab-cde" })).toBe(UNKNOWN_VOIVODESHIP);
	});
});

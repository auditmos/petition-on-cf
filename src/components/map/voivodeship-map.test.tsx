import { fireEvent, render, screen } from "@testing-library/react";
import { VoivodeshipMap } from "@/components/map/voivodeship-map";
import { getContent } from "@/content";
import type { SignatureCounts } from "@/core/signature-counts";
import { VOIVODESHIP_CODES } from "@/core/voivodeship";

/**
 * The map, given counts.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is a whole `SignatureCounts` — the shape D1 answers with, the
 *   snapshot endpoint serves and the Durable Object broadcasts. The map is
 *   handed the object rather than a per-region number so that what it renders
 *   and what the headline counter renders cannot drift apart.
 * - **Output** is one shaded path per voivodeship plus a list that says every
 *   region's name and count in words. Colour carries no information the text
 *   does not repeat.
 * - **Boundaries**: nothing signed at all; a region D1 has never heard of;
 *   signatures nothing could attribute; a `byVoivodeship` record that is
 *   missing fifteen of the sixteen keys, which is what D1 actually returns.
 * - **Not covered here**: how the counts reach the page. That is
 *   `use-live-counts.test.tsx` for the socket and `landing-page.test.tsx` for
 *   the wiring.
 */

const COPY = getContent("pl");

function counts(byVoivodeship: Record<string, number>, total?: number): SignatureCounts {
	const summed = Object.values(byVoivodeship).reduce((sum, count) => sum + count, 0);
	// The tempo the counter reports rides in the same object and means nothing
	// to a map, so it is stated as absent rather than as a number nothing reads.
	return { total: total ?? summed, byVoivodeship, secondsSinceLastSignature: null };
}

function renderMap(payload: SignatureCounts) {
	return render(
		<VoivodeshipMap counts={payload} language="pl" copy={COPY.map} nouns={COPY.counter.nouns} />,
	);
}

describe("VoivodeshipMap", () => {
	it("names every voivodeship and its count, whatever D1 left out", () => {
		renderMap(counts({ "PL-MZ": 12, "PL-PM": 1 }));

		expect(screen.getByText(COPY.map.regions["PL-MZ"])).toBeDefined();
		expect(screen.getByText(`12 ${COPY.counter.nouns.many}`)).toBeDefined();
		expect(screen.getByText(`1 ${COPY.counter.nouns.one}`)).toBeDefined();

		// The fourteen D1 said nothing about are regions with no signatures,
		// not regions that are missing from the map.
		for (const code of VOIVODESHIP_CODES) {
			expect(screen.getByText(COPY.map.regions[code])).toBeDefined();
		}
		expect(screen.getAllByText(`0 ${COPY.counter.nouns.many}`)).toHaveLength(14);
	});

	it("shades a region against the strongest one, and leaves an empty one empty", () => {
		const { container } = renderMap(counts({ "PL-MZ": 100, "PL-SL": 50, "PL-OP": 1, "PL-PM": 0 }));

		expect(shadeOf(container, "PL-MZ")).toBe(4);
		expect(shadeOf(container, "PL-SL")).toBe(2);
		expect(shadeOf(container, "PL-OP")).toBe(1);

		// Nobody has signed from either, and neither should look as though
		// somebody nearly did.
		expect(shadeOf(container, "PL-PM")).toBe(0);
		expect(shadeOf(container, "PL-PD")).toBe(0);
	});

	// The state every fresh deployment opens in, and the one where dividing by
	// the strongest region is dividing by nothing.
	it("draws an empty country when nobody has signed", () => {
		const { container } = renderMap(counts({}));

		expect(container.querySelectorAll("[data-region]")).toHaveLength(16);
		for (const region of container.querySelectorAll("[data-region]")) {
			expect(region.getAttribute("data-shade")).toBe("0");
		}
		expect(screen.getAllByText(`0 ${COPY.counter.nouns.many}`)).toHaveLength(16);
		expect(screen.queryByText(COPY.map.unknownLabel)).toBeNull();
	});

	it("says how many signatures no voivodeship claims, without shading one", () => {
		const { container } = renderMap(counts({ "PL-MZ": 4, unknown: 6 }));

		expect(screen.getByText(COPY.map.unknownLabel)).toBeDefined();
		expect(screen.getByText(`6 ${COPY.counter.nouns.many}`)).toBeDefined();
		expect(shadeOf(container, "PL-MZ")).toBe(4);
		expect(container.querySelectorAll("[data-region]")).toHaveLength(16);
	});

	// A row written before the pipeline attributed anything, a bucket a later
	// slice adds, a code this build has never heard of: all of them are
	// signatures, all of them are in the total, and none of them are on the
	// map. What the map owes the reader is that its parts still add up.
	it("counts a signature the sixteen regions cannot account for", () => {
		renderMap(counts({ "PL-MZ": 4, "XX-ZZ": 1 }, 11));

		expect(screen.getByText(COPY.map.unknownLabel)).toBeDefined();
		expect(screen.getByText(`7 ${COPY.counter.nouns.many}`)).toBeDefined();
	});
});

/**
 * The readout that follows the pointer.
 *
 * It replaces the SVG `<title>` this component shipped with first. That was
 * valid markup and it worked, but it was Chrome's tooltip rather than this
 * page's: a full second of dwell before it appears, no response from the
 * region itself, nothing on touch, and text the browser is known to cache
 * after the count behind it has moved. A visitor never found out the map could
 * be pointed at.
 *
 * Mouse events rather than pointer events because jsdom implements the first
 * and not the second, and a shim would put the thing under test behind a stub
 * of my own writing. Touch devices synthesise mouse events from a tap, so the
 * affordance survives the substitution.
 */
describe("VoivodeshipMap, under the pointer", () => {
	it("says nothing until the pointer is over a region", () => {
		renderMap(counts({ "PL-MZ": 12 }));

		expect(screen.queryByTestId("map-readout")).toBeNull();
	});

	it("names the region the moment the pointer arrives, with no dwell", () => {
		const { container } = renderMap(counts({ "PL-MZ": 12 }));

		fireEvent.mouseMove(regionIn(container, "PL-MZ"));

		const readout = screen.getByTestId("map-readout");
		expect(readout.textContent).toContain(COPY.map.regions["PL-MZ"]);
		expect(readout.textContent).toContain(`12 ${COPY.counter.nouns.many}`);
	});

	it("swaps to the next region as the pointer crosses into it", () => {
		const { container } = renderMap(counts({ "PL-MZ": 12, "PL-PM": 3 }));

		fireEvent.mouseMove(regionIn(container, "PL-MZ"));
		fireEvent.mouseMove(regionIn(container, "PL-PM"));

		const readout = screen.getByTestId("map-readout");
		expect(readout.textContent).toContain(COPY.map.regions["PL-PM"]);
		expect(readout.textContent).not.toContain(COPY.map.regions["PL-MZ"]);
	});

	it("goes quiet when the pointer leaves the map", () => {
		const { container } = renderMap(counts({ "PL-MZ": 12 }));
		fireEvent.mouseMove(regionIn(container, "PL-MZ"));

		fireEvent.mouseLeave(screen.getByRole("img"));

		expect(screen.queryByTestId("map-readout")).toBeNull();
	});

	// The drawing is wider than the country. Moving off Poland but not off the
	// drawing has to put the readout away — leaving the last region asserted
	// would have the map naming somewhere the pointer is no longer near.
	it("goes quiet over the sea, without leaving the drawing", () => {
		const { container } = renderMap(counts({ "PL-MZ": 12 }));
		fireEvent.mouseMove(regionIn(container, "PL-MZ"));

		fireEvent.mouseMove(screen.getByRole("img"));

		expect(screen.queryByTestId("map-readout")).toBeNull();
	});

	// The readout says which region; the region has to say so too, or the
	// reader is told about a place they cannot find on the drawing.
	it("marks the region under the pointer so the drawing can answer as well", () => {
		const { container } = renderMap(counts({ "PL-MZ": 12, "PL-PM": 3 }));

		fireEvent.mouseMove(regionIn(container, "PL-MZ"));

		expect(regionIn(container, "PL-MZ").getAttribute("data-hovered")).toBe("true");
		expect(regionIn(container, "PL-PM").getAttribute("data-hovered")).toBeNull();
	});

	// A petition ticks while somebody is looking at it. The readout reads the
	// same counts the map does, so a signature arriving under a resting cursor
	// changes the number being pointed at.
	it("follows the count up while the pointer rests on a region", () => {
		const { container, rerender } = renderMap(counts({ "PL-MZ": 12 }));
		fireEvent.mouseMove(regionIn(container, "PL-MZ"));

		rerender(
			<VoivodeshipMap
				counts={counts({ "PL-MZ": 13 })}
				language="pl"
				copy={COPY.map}
				nouns={COPY.counter.nouns}
			/>,
		);

		expect(screen.getByTestId("map-readout").textContent).toContain(
			`13 ${COPY.counter.nouns.many}`,
		);
	});

	// Everything above is for a pointer. A reader without one is not sent to
	// hunt for it: the list beside the map already carries all sixteen names
	// and counts, so the readout is an enhancement and says so.
	it("keeps the readout out of the accessibility tree", () => {
		const { container } = renderMap(counts({ "PL-MZ": 12 }));

		fireEvent.mouseMove(regionIn(container, "PL-MZ"));

		expect(screen.getByTestId("map-readout").getAttribute("aria-hidden")).toBe("true");
	});
});

/** The region's rendered path, the thing a pointer actually enters. */
function regionIn(container: HTMLElement, code: string): Element {
	const region = container.querySelector(`[data-region="${code}"]`);
	if (!region) throw new Error(`no region rendered for ${code}`);
	return region;
}

/**
 * The one thing about the outlines that cannot be seen from a passing test:
 * whether each of them is the region its code names.
 *
 * The paths were re-keyed from Polish names to ISO codes by hand, and getting
 * that wrong is silent — the map still draws Poland, still shades sixteen
 * regions, still adds up. It just shades the wrong one, forever. Geography is
 * the only witness available, so the test asks it: north is a smaller `y`,
 * west is a smaller `x`, and the four corners of the country are not a matter
 * of opinion.
 */
describe("the outlines behind the map", () => {
	it("puts every voivodeship where the country keeps it", () => {
		const { container } = renderMap(counts({}));
		const at = (code: string) => centreOf(container, code);

		// Pomerania is on the Baltic; Lesser Poland is on the Tatras.
		expect(at("PL-PM").y).toBeLessThan(at("PL-MA").y);
		// West Pomerania borders Germany; Podlaskie borders Belarus.
		expect(at("PL-ZP").x).toBeLessThan(at("PL-PD").x);
		// Warmia-Masuria is the north-east, Lower Silesia the south-west.
		expect(at("PL-WN").y).toBeLessThan(at("PL-DS").y);
		expect(at("PL-DS").x).toBeLessThan(at("PL-WN").x);
		// Lublin is east of Mazovia, which is east of Greater Poland.
		expect(at("PL-WP").x).toBeLessThan(at("PL-MZ").x);
		expect(at("PL-MZ").x).toBeLessThan(at("PL-LU").x);
		// Subcarpathia is the south-east corner; Lubusz the western edge.
		expect(at("PL-PK").x).toBeGreaterThan(at("PL-SK").x);
		expect(at("PL-PK").y).toBeGreaterThan(at("PL-KP").y);
		expect(at("PL-LB").x).toBeLessThan(at("PL-LD").x);
		// Opole sits between Lower Silesia and Silesia, and below both centres
		// of the two voivodeships it is most often confused with.
		expect(at("PL-OP").x).toBeGreaterThan(at("PL-DS").x);
		expect(at("PL-OP").x).toBeLessThan(at("PL-SL").x);
	});

	it("gives all sixteen an outline to draw", () => {
		const { container } = renderMap(counts({}));

		for (const code of VOIVODESHIP_CODES) {
			const region = container.querySelector(`[data-region="${code}"]`);
			expect(region?.getAttribute("d")?.length ?? 0).toBeGreaterThan(100);
		}
	});
});

/** Where a region sits, averaged over the points its outline is drawn from. */
function centreOf(container: HTMLElement, code: string): { x: number; y: number } {
	const drawn = container.querySelector(`[data-region="${code}"]`)?.getAttribute("d");
	if (!drawn) throw new Error(`no outline rendered for ${code}`);

	const numbers = (drawn.match(/-?\d*\.?\d+/g) ?? []).map(Number);
	const points = numbers.length / 2;
	return {
		x: numbers.filter((_, index) => index % 2 === 0).reduce((sum, n) => sum + n, 0) / points,
		y: numbers.filter((_, index) => index % 2 === 1).reduce((sum, n) => sum + n, 0) / points,
	};
}

/** How strongly a region came out, read off what was actually rendered. */
function shadeOf(container: HTMLElement, code: string): number {
	const region = container.querySelector(`[data-region="${code}"]`);
	if (!region) throw new Error(`no region rendered for ${code}`);
	return Number(region.getAttribute("data-shade"));
}

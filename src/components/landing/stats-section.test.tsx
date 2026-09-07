import { render, screen } from "@testing-library/react";
import { StatsSection } from "@/components/landing/stats-section";
import { type Content, getContent, LANGUAGES } from "@/content";

/**
 * The evidence a visitor is asked to trust.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is one language's `stats` copy: a heading and an array of facts.
 * - **Output**: every fact renders its figure, its label and — the point of
 *   the section — the line naming where the figure came from. A statistic on a
 *   petition page without its source is a claim, and the schema makes the
 *   source mandatory so no content file can ship one.
 * - **The array is the interface.** A campaign adding a fifth fact edits a
 *   content file and nothing else; the extended fixture below is what proves
 *   that rather than a promise in a comment.
 * - **A source may carry a link, and need not.** Some evidence is a URL and
 *   some is a page in a printed report, so `sourceUrl` is optional and the
 *   source line reads the same either way.
 * - **Not covered here**: where the section sits on the page, which
 *   `landing-page.test.tsx` asserts.
 */

/** One more fact than the content file ships, to prove the array drives it. */
const EXTRA: Content["stats"]["facts"][number] = {
	figure: "42%",
	label: "dodatkowa liczba",
	note: "Dopisana w teście, nie w komponencie.",
	source: "Źródło dopisanej liczby, 2026",
	sourceUrl: "https://example.org/raport",
};

describe.each(LANGUAGES)("StatsSection in %s", (language) => {
	const copy = getContent(language).stats;

	it("renders every fact the content file lists", () => {
		render(<StatsSection copy={copy} />);

		for (const fact of copy.facts) {
			expect(screen.getByText(fact.label)).toBeDefined();
			expect(screen.getByText(fact.figure)).toBeDefined();
			expect(screen.getByText(fact.note)).toBeDefined();
		}
	});

	// User story 2: a figure a reader cannot trace is a figure they cannot
	// check. Every one of them carries the line that says where it came from.
	it("names the source of every figure", () => {
		render(<StatsSection copy={copy} />);

		for (const fact of copy.facts) {
			expect(screen.getByText(fact.source, { exact: false })).toBeDefined();
		}
	});
});

describe("StatsSection, driven by the content array", () => {
	const copy = getContent("pl").stats;

	it("renders a fact that was added to the array alone", () => {
		render(<StatsSection copy={{ ...copy, facts: [...copy.facts, EXTRA] }} />);

		expect(screen.getByText(EXTRA.figure)).toBeDefined();
		expect(screen.getByText(EXTRA.label)).toBeDefined();
		expect(screen.getByText(EXTRA.source, { exact: false })).toBeDefined();
	});

	it("links a source that gave a URL", () => {
		render(<StatsSection copy={{ ...copy, facts: [EXTRA] }} />);

		const link = screen.getByRole("link", { name: EXTRA.source });

		expect(link.getAttribute("href")).toBe(EXTRA.sourceUrl);
	});

	it("still names a source that gave no URL", () => {
		const { sourceUrl: _none, ...offline } = EXTRA;

		render(<StatsSection copy={{ ...copy, facts: [offline] }} />);

		expect(screen.getByText(offline.source, { exact: false })).toBeDefined();
		expect(screen.queryByRole("link", { name: offline.source })).toBeNull();
	});
});

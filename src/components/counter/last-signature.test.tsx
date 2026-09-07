import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { LastSignature } from "@/components/counter/last-signature";
import { getContent, type Language } from "@/content";

/**
 * How long ago the last signature arrived, as the counter says it.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is a duration in seconds, measured by D1 at the moment the page
 *   or the push was built, and null on a petition nobody has signed. Never an
 *   instant: an instant would have to be subtracted from the reader's clock,
 *   and a reader's clock is not something a public page can rely on.
 * - **Output** is one sentence — the configured label, then the duration in
 *   the words the language uses for it. The words come from
 *   `Intl.RelativeTimeFormat`, which is also what supplies Polish's three
 *   plural forms, so there is no new plural table beside `counter.nouns`.
 * - **The first render is the server's render.** The component reads no clock
 *   until it has mounted, so the browser's first paint is identical to the
 *   markup it hydrates and there is nothing for React to reconcile.
 * - **One component is one measurement.** The stopwatch is never restarted;
 *   the caller keys this component on what it is describing, so a push builds
 *   a new instance. `counter-section.test.tsx` is where that is asserted.
 * - **Boundaries**: nothing signed yet, a signature this second, one that
 *   crosses from seconds into minutes while nobody is pushing anything.
 * - **Not covered here**: where the number comes from, which is
 *   `queries.worker.test.ts`, and how a push replaces it, which is
 *   `use-live-counts.test.tsx`.
 */

const label = (language: Language) => getContent(language).counter.lastSignature;

const said = () => screen.getByTestId("last-signature").textContent;

afterEach(() => {
	vi.useRealTimers();
});

describe("LastSignature", () => {
	it("says how long ago the last signature arrived, in Polish", () => {
		render(<LastSignature secondsAgo={300} language="pl" label={label("pl")} />);

		expect(said()).toBe("Ostatni podpis 5 minut temu");
	});

	it("says the same thing in English", () => {
		render(<LastSignature secondsAgo={300} language="en" label={label("en")} />);

		expect(said()).toBe("Last signature 5 minutes ago");
	});

	// Polish takes a different form of the noun at 5, at 22 and at 1, and English
	// takes a different one at 1. Neither is spelled out anywhere in this
	// template — `Intl` knows both languages' rules and the content files do not
	// have to.
	it.each([
		{ language: "pl" as const, secondsAgo: 60, expected: "Ostatni podpis 1 minutę temu" },
		{ language: "pl" as const, secondsAgo: 1_320, expected: "Ostatni podpis 22 minuty temu" },
		{ language: "pl" as const, secondsAgo: 10_800, expected: "Ostatni podpis 3 godziny temu" },
		{ language: "en" as const, secondsAgo: 60, expected: "Last signature 1 minute ago" },
		{ language: "en" as const, secondsAgo: 10_800, expected: "Last signature 3 hours ago" },
	])("declines $secondsAgo seconds correctly in $language", ({
		language,
		secondsAgo,
		expected,
	}) => {
		render(<LastSignature secondsAgo={secondsAgo} language={language} label={label(language)} />);

		expect(said()).toBe(expected);
	});

	// A petition nobody has signed has no tempo to report, and "0 seconds ago"
	// on a page with a zero beside it would read as a signature nobody made.
	it("says nothing at all before anybody has signed", () => {
		render(<LastSignature secondsAgo={null} language="pl" label={label("pl")} />);

		expect(screen.queryByTestId("last-signature")).toBeNull();
	});

	/**
	 * The line has to keep moving on a page nothing is happening to. A reader
	 * who leaves a quiet petition open for a minute should see the label say so,
	 * rather than freeze at the figure the last push happened to carry.
	 *
	 * The clock is faked before the component renders, so the interval it sets
	 * up is the one being advanced.
	 */
	it("counts on by itself when no push arrives", async () => {
		vi.useFakeTimers();
		render(<LastSignature secondsAgo={0} language="pl" label={label("pl")} />);
		expect(said()).toBe("Ostatni podpis teraz");

		await act(async () => {
			await vi.advanceTimersByTimeAsync(60_000);
		});

		expect(said()).toBe("Ostatni podpis 1 minutę temu");
	});

	/**
	 * The hydration contract, asserted rather than trusted.
	 *
	 * The server renders this into the first byte the browser receives, and the
	 * browser then renders it again to hydrate. If the two disagree by so much
	 * as a word — because each subtracted the duration from its own clock, or
	 * because the round trip crossed a minute boundary — React throws the
	 * server's markup away and warns. They agree here because neither render
	 * reads a clock at all: the duration is a prop, and the counting on only
	 * starts once there is a browser to count in.
	 */
	it("renders on the client exactly what the server rendered", () => {
		const element = <LastSignature secondsAgo={119} language="pl" label={label("pl")} />;

		const server = renderToString(element);
		render(element);

		expect(server).toContain("1 minutę temu");
		expect(said()).toBe("Ostatni podpis 1 minutę temu");
	});
});

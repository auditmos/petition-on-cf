import { act, render, screen } from "@testing-library/react";
import { CounterSection } from "@/components/landing/counter-section";
import { getContent } from "@/content";
import type { SignatureCounts } from "@/core/signature-counts";

/**
 * The counter block, and the one thing about it that only exists here: the
 * tempo line has to start counting again every time a push describes a
 * different signature.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is the whole `SignatureCounts` — the total and the duration since
 *   the last signature arrive together, so the two figures cannot be a moment
 *   apart.
 * - **Output**: the figure, and the tempo line beneath it.
 * - **The bug this file exists for** was found by hand against `pnpm dev` and
 *   is asserted below: two signatures inside the same minute are both measured
 *   as arriving "now", so a component that recognised a new measurement by its
 *   duration alone would let the second one inherit the first one's stopwatch.
 * - **Not covered here**: how the duration is worded, which is
 *   `last-signature.test.tsx`, and what the server renders, which is
 *   `counter-section.worker.test.tsx`.
 */

const COPY = getContent("pl");

function signed(total: number, secondsSinceLastSignature: number | null): SignatureCounts {
	return { total, byVoivodeship: {}, secondsSinceLastSignature };
}

const tempo = () => screen.queryByTestId("last-signature")?.textContent;

function renderCounter(counts: SignatureCounts) {
	return render(<CounterSection counts={counts} language="pl" copy={COPY.counter} />);
}

afterEach(() => {
	vi.useRealTimers();
});

describe("CounterSection", () => {
	it("shows the count and how long ago the last signature arrived", () => {
		renderCounter(signed(198, 300));

		expect(screen.getByTestId("signature-count-figure").textContent).toBe("198");
		expect(tempo()).toBe("Ostatni podpis 5 minut temu");
	});

	it("says nothing about a last signature before anybody has signed", () => {
		renderCounter(signed(0, null));

		expect(tempo()).toBeUndefined();
	});

	/**
	 * A petition being signed steadily, which is the case that was wrong.
	 *
	 * The first push says a signature arrived now. Half a minute later a second
	 * one arrives and says the same thing — the duration is zero again, because
	 * that is what it was measured as. If the tempo line only restarted when the
	 * number it was given changed, it would go on counting from the first
	 * signature and drift further behind the counter beside it with every
	 * signature after that.
	 */
	it("counts again from the newest signature when it arrives in the same breath", async () => {
		vi.useFakeTimers();
		const { rerender } = renderCounter(signed(198, 0));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});
		expect(tempo()).toBe("Ostatni podpis 30 sekund temu");

		rerender(<CounterSection counts={signed(199, 0)} language="pl" copy={COPY.counter} />);

		expect(tempo()).toBe("Ostatni podpis teraz");
	});

	// The heartbeat, which reports the same signature half a minute older. It
	// restarts the stopwatch too, and has to end up where it would have got to
	// on its own rather than a minute past it.
	it("takes the duration a push carries rather than adding to its own", async () => {
		vi.useFakeTimers();
		const { rerender } = renderCounter(signed(198, 0));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});

		rerender(<CounterSection counts={signed(198, 30)} language="pl" copy={COPY.counter} />);

		expect(tempo()).toBe("Ostatni podpis 30 sekund temu");
	});
});

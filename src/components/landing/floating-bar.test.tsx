import { act, render, screen } from "@testing-library/react";
import { FloatingBar } from "@/components/landing/floating-bar";
import { getContent } from "@/content";

/**
 * The bar that follows the reader down the page.
 *
 * ## Assumptions this file encodes
 *
 * - **Input**: the live count, the language it is formatted in, this
 *   language's copy, and the id of the element whose leaving the screen is
 *   what reveals the bar.
 * - **Output**: nothing at all while that element is on screen — not a hidden
 *   element, nothing in the tree — and a labelled region with the count and a
 *   link to the form once it is not.
 * - **Boundaries**: an element that is not on the page, and a reader who
 *   scrolls back up.
 * - **`IntersectionObserver` is stubbed** because jsdom has no layout and
 *   therefore no intersections. It is a browser API at the edge of the
 *   component, which is the one kind of thing worth standing in for.
 */

const COPY = getContent("pl");
const HERO_ID = "hero-under-test";

/** The browser's observer, with the callback handed back to the test. */
class FakeObserver {
	static instances: FakeObserver[] = [];

	readonly observed: Element[] = [];
	disconnected = false;

	constructor(private readonly callback: IntersectionObserverCallback) {
		FakeObserver.instances.push(this);
	}

	static get last(): FakeObserver {
		const observer = FakeObserver.instances.at(-1);
		if (!observer) throw new Error("nothing observed anything");
		return observer;
	}

	observe(element: Element): void {
		this.observed.push(element);
	}

	unobserve(): void {}

	disconnect(): void {
		this.disconnected = true;
	}

	/** What the browser reports as the watched element enters or leaves. */
	onScreen(isIntersecting: boolean): void {
		act(() => this.callback([{ isIntersecting } as IntersectionObserverEntry], this as never));
	}
}

beforeEach(() => {
	FakeObserver.instances = [];
	vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function renderBar(count = 1234) {
	return render(
		<>
			<div id={HERO_ID} />
			<FloatingBar count={count} language="pl" copy={COPY} watching={HERO_ID} />
		</>,
	);
}

describe("FloatingBar", () => {
	it("shows nothing before the reader has scrolled anywhere", () => {
		renderBar();

		expect(screen.queryByRole("link", { name: COPY.floatingBar.cta })).toBeNull();
	});

	it("stays away while the hero is still on screen", () => {
		renderBar();

		FakeObserver.last.onScreen(true);

		expect(screen.queryByRole("link", { name: COPY.floatingBar.cta })).toBeNull();
	});

	it("appears with the count and a way to sign once the hero is past", () => {
		renderBar(1234);

		FakeObserver.last.onScreen(false);

		expect(screen.getByRole("link", { name: COPY.floatingBar.cta })).toBeTruthy();
		expect(screen.getByTestId("floating-bar-figure").textContent).toBe(
			new Intl.NumberFormat("pl").format(1234),
		);
	});

	// The counter's noun is picked by Polish plural rules, and the bar has to
	// pick it the same way: "1 234 podpisy" and "1 235 podpisów" are both
	// regular, and getting it wrong is the sort of thing a reader notices.
	it("agrees with the counter about what to call a signature", () => {
		renderBar(5);

		FakeObserver.last.onScreen(false);

		expect(screen.getByTestId("floating-bar-noun").textContent).toBe(COPY.counter.nouns.many);
	});

	it("goes away again when the reader scrolls back to the top", () => {
		renderBar();
		FakeObserver.last.onScreen(false);
		expect(screen.getByRole("link", { name: COPY.floatingBar.cta })).toBeTruthy();

		FakeObserver.last.onScreen(true);

		expect(screen.queryByRole("link", { name: COPY.floatingBar.cta })).toBeNull();
	});

	it("watches the element it was told to watch", () => {
		renderBar();

		expect(FakeObserver.last.observed).toEqual([document.getElementById(HERO_ID)]);
	});

	it("stops observing when the page goes away", () => {
		const { unmount } = renderBar();
		const observer = FakeObserver.last;

		unmount();

		expect(observer.disconnected).toBe(true);
	});

	// A page that never rendered the watched element would otherwise leave the
	// bar hidden forever, which is a broken CTA nobody would think to look for.
	it("stays out of the way when there is nothing to watch", () => {
		render(<FloatingBar count={1} language="pl" copy={COPY} watching="nothing-here" />);

		expect(screen.queryByRole("link", { name: COPY.floatingBar.cta })).toBeNull();
		expect(FakeObserver.instances).toHaveLength(0);
	});
});

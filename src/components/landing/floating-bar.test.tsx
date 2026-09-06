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

/**
 * The bar is fixed to the bottom of the viewport, so it sits on top of
 * whatever is behind it. Mid-page that is harmless — a reader scrolls another
 * inch and the content comes out from under it. At the *end* of the page there
 * is no further inch, so the last strip of the footer would be covered with no
 * way to reach it.
 *
 * The fix is the bar reserving its own footprint rather than the page knowing
 * the bar's height: it renders a spacer in flow beside the fixed element, so
 * the two cannot drift apart when one of them is restyled.
 */
describe("FloatingBar, room at the end of the page", () => {
	const spacer = () => screen.queryByTestId("floating-bar-spacer");
	const bar = () => screen.getByRole("complementary", { name: COPY.floatingBar.label });

	/** The Tailwind height utility an element carries, whichever one it is. */
	function heightClass(element: Element): string | undefined {
		return [...element.classList].find((name) => /^h-/.test(name));
	}

	it("reserves room once it is on screen", () => {
		renderBar();

		FakeObserver.last.onScreen(false);

		expect(spacer()).not.toBeNull();
	});

	// The whole point is that the reserved space equals the occupied space. A
	// spacer shorter than the bar leaves a strip covered; a taller one leaves a
	// gap under the footer that looks like a rendering bug.
	it("reserves exactly the height it occupies", () => {
		renderBar();

		FakeObserver.last.onScreen(false);

		const reserved = heightClass(spacer() as Element);
		expect(reserved).toBeDefined();
		expect(reserved).toBe(heightClass(bar()));
	});

	it("reserves nothing while it is not there", () => {
		renderBar();

		FakeObserver.last.onScreen(true);

		expect(spacer()).toBeNull();
	});
});

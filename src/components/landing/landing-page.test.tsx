import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { COUNTER_SECTION_ID } from "@/components/landing/counter-section";
import { FAQ_SECTION_ID } from "@/components/landing/faq-section";
import { HERO_SECTION_ID } from "@/components/landing/hero-section";
import { LandingPage } from "@/components/landing/landing-page";
import { MAP_SECTION_ID } from "@/components/landing/map-section";
import { MECHANISM_SECTION_ID } from "@/components/landing/mechanism-section";
import { SHARE_SECTION_ID } from "@/components/landing/share-section";
import { SIGN_SECTION_ID } from "@/components/landing/sign-section";
import { STATS_SECTION_ID } from "@/components/landing/stats-section";
import { SUPPORTERS_SECTION_ID } from "@/components/landing/supporters-section";
import { getContent } from "@/content";
import type { LiveUpdate } from "@/core/live-update";
import type { SignatureCounts } from "@/core/signature-counts";
import type { Supporter, SupporterPage } from "@/core/supporters";

/**
 * The page, assembled — specifically the two things that only exist once it is
 * assembled: one socket feeding both places the count appears, and a bar that
 * knows when the hero is behind the reader.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is the counts and the first page of the list, both read from D1
 *   on the server. Everything after the first paint arrives over the socket.
 * - **Output**: the counter section, the floating bar, the map and the list all
 *   agree, because one connection feeds all four the same object.
 * - **The socket and `IntersectionObserver` are stubbed** — the network and a
 *   layout jsdom does not have. Their own behaviour is covered in
 *   `use-live-counts.test.tsx` and `floating-bar.test.tsx`.
 * - **Not covered here**: what the count looks like server-side, which
 *   `counter-section.worker.test.tsx` renders against a real D1.
 */

const COPY = getContent("pl");

/** The socket the page opens, driven by the test. */
class FakeSocket {
	static opened: FakeSocket[] = [];

	readonly #listeners = new Map<string, Set<(event: unknown) => void>>();

	constructor(readonly url: string) {
		FakeSocket.opened.push(this);
	}

	static get last(): FakeSocket {
		const socket = FakeSocket.opened.at(-1);
		if (!socket) throw new Error("the page opened no socket");
		return socket;
	}

	addEventListener(type: string, listener: (event: unknown) => void): void {
		const listeners = this.#listeners.get(type) ?? new Set();
		listeners.add(listener);
		this.#listeners.set(type, listeners);
	}

	removeEventListener(): void {}
	close(): void {}

	push(payload: unknown): void {
		for (const listener of this.#listeners.get("message") ?? []) {
			listener({ data: JSON.stringify(payload) });
		}
	}
}

/** The browser watching the hero, driven by the test. */
class FakeObserver {
	static instances: FakeObserver[] = [];

	constructor(private readonly callback: IntersectionObserverCallback) {
		FakeObserver.instances.push(this);
	}

	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}

	/** Report the watched element's position to every observer on the page. */
	static reportAll(isIntersecting: boolean): void {
		act(() => {
			for (const observer of FakeObserver.instances) {
				observer.callback([{ isIntersecting } as IntersectionObserverEntry], observer as never);
			}
		});
	}
}

beforeEach(() => {
	FakeSocket.opened = [];
	FakeObserver.instances = [];
	vi.stubGlobal("WebSocket", FakeSocket);
	vi.stubGlobal("IntersectionObserver", FakeObserver);
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json({
				data: { counts: signed(0), supporters: [] },
			}),
		),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/**
 * The page under the two contexts it genuinely needs: a query client for the
 * form's mutation, and a router for the language switcher's links. Neither is
 * a stand-in — they are the real thing, pointed at memory instead of at a
 * browser's history.
 */
async function renderPage(
	counts: SignatureCounts,
	supporters: SupporterPage = { supporters: [], nextCursor: null },
) {
	const rootRoute = createRootRoute({
		component: () => (
			<QueryClientProvider client={new QueryClient()}>
				<LandingPage counts={counts} supporters={supporters} language="pl" />
			</QueryClientProvider>
		),
	});

	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});

	const rendered = render(<RouterProvider router={router} />);
	await screen.findByTestId("signature-count-figure");
	return rendered;
}

const figure = () => screen.getByTestId("signature-count-figure").textContent;

/** What the loader read from D1, for a page nobody has signed by region. */
function signed(total: number): SignatureCounts {
	return { total, byVoivodeship: {}, secondsSinceLastSignature: null };
}

/** One push, as the `LiveCounter` Durable Object shapes it. */
function pushed(counts: SignatureCounts, supporters: Supporter[] = []): LiveUpdate {
	return { counts, supporters };
}

describe("LandingPage, live count", () => {
	it("paints the count the server read before any socket has said anything", async () => {
		await renderPage(signed(3));

		expect(figure()).toBe("3");
	});

	// User story 11: signing ticks the number without a reload. The push below
	// is what the object sends after the sign endpoint tells it about a row.
	it("moves the visible count when the counter pushes a new one", async () => {
		await renderPage(signed(3));

		act(() => FakeSocket.last.push(pushed({ ...signed(4), byVoivodeship: { "PL-MZ": 4 } })));

		await waitFor(() => expect(figure()).toBe("4"));
	});

	// One socket, two places the number shows. Opening a second connection for
	// the bar would double the deployment's socket count for one number.
	it("shows the bar the same number as the counter, from one connection", async () => {
		await renderPage(signed(3));
		expect(FakeSocket.opened).toHaveLength(1);

		act(() => FakeSocket.last.push(pushed(signed(4))));
		FakeObserver.reportAll(false);

		await waitFor(() => expect(screen.getByTestId("floating-bar-figure").textContent).toBe("4"));
		expect(FakeSocket.opened).toHaveLength(1);
	});

	// User story 14: the map is fed by the same push as the number, so a
	// signature from a region reaches the map without the page reloading.
	it("re-shades a voivodeship the moment a signature arrives from it", async () => {
		const { container } = await renderPage({ ...signed(3), byVoivodeship: { "PL-MZ": 3 } });
		const shadeOf = (code: string) =>
			container.querySelector(`[data-region="${code}"]`)?.getAttribute("data-shade");

		expect(shadeOf("PL-PM")).toBe("0");

		act(() =>
			FakeSocket.last.push(pushed({ ...signed(4), byVoivodeship: { "PL-MZ": 3, "PL-PM": 1 } })),
		);

		await waitFor(() => expect(shadeOf("PL-PM")).not.toBe("0"));
		expect(figure()).toBe("4");
	});
});

describe("LandingPage, floating bar", () => {
	/**
	 * The bar itself, not its call to action: the hero's primary button says the
	 * same words, as it should — both send the reader to the same form — so what
	 * distinguishes them on the page is the labelled region one of them sits in.
	 */
	const bar = () => screen.queryByRole("complementary", { name: COPY.floatingBar.label });

	it("keeps the bar away while the reader is still on the hero", async () => {
		await renderPage(signed(3));

		FakeObserver.reportAll(true);

		expect(bar()).toBeNull();
	});

	it("brings the bar in once the hero is behind the reader", async () => {
		await renderPage(signed(3));

		FakeObserver.reportAll(false);

		const revealed = bar();
		if (!revealed) throw new Error("the bar stayed away");
		const cta = within(revealed).getByRole("link", { name: COPY.floatingBar.cta });
		expect(cta.getAttribute("href")).toBe(`#${SIGN_SECTION_ID}`);
	});
});

/**
 * The page's anatomy, in the order a reader meets it.
 *
 * The order is an argument, not a layout preference: the case comes before the
 * ask, the ask before the form, and everything that follows — who else signed,
 * how to pass it on, what people worry about — comes after a reader has had
 * the chance to sign. It is asserted over section ids rather than over
 * headings because a campaign rewrites its headings and must not have to
 * rewrite this test to do it.
 */
describe("LandingPage, anatomy", () => {
	it("lays the sections out in the order the PRD argues for", async () => {
		await renderPage(signed(3));

		const sections = [...screen.getByRole("main").querySelectorAll("section")];

		expect(sections.map((section) => section.id)).toEqual([
			HERO_SECTION_ID,
			STATS_SECTION_ID,
			MECHANISM_SECTION_ID,
			COUNTER_SECTION_ID,
			SIGN_SECTION_ID,
			MAP_SECTION_ID,
			SUPPORTERS_SECTION_ID,
			SHARE_SECTION_ID,
			FAQ_SECTION_ID,
		]);
	});

	// The navigation scrolls to an id. An entry naming a section that no longer
	// exists is a menu item that silently does nothing, and the way that
	// happens is a section being renamed or removed somewhere else.
	it("offers navigation only to sections the page actually has", async () => {
		await renderPage(signed(3));

		for (const item of COPY.nav.items) {
			expect(document.getElementById(item.sectionId)).not.toBeNull();
		}
	});
});

/**
 * The hero's call to action, which is the page's primary one.
 *
 * User story 4: a visitor who has read the first screen wants to act without
 * hunting for the form. Landing them beside it is not enough — a reader who
 * arrived by keyboard would then have to tab back through everything between
 * the hero and the fields — so the click both scrolls and hands over focus.
 */
describe("LandingPage, hero call to action", () => {
	function clickHeroCta() {
		const hero = document.getElementById(HERO_SECTION_ID);
		if (!hero) throw new Error("the page rendered no hero");
		fireEvent.click(within(hero).getByRole("link", { name: COPY.hero.primaryCta }));
	}

	it("scrolls the form into view", async () => {
		await renderPage(signed(3));
		const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

		clickHeroCta();

		expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById(SIGN_SECTION_ID));
	});

	it("puts the cursor in the form", async () => {
		await renderPage(signed(3));

		clickHeroCta();

		const form = document.getElementById(SIGN_SECTION_ID);
		expect(form?.contains(document.activeElement)).toBe(true);
		expect(document.activeElement?.tagName).toBe("INPUT");
	});

	// The scroll and the focus are what JavaScript adds. The anchor underneath
	// is what still works without it, and what a reader gets when they copy the
	// link rather than click it.
	it("stays an ordinary link to the form", async () => {
		await renderPage(signed(3));
		const hero = document.getElementById(HERO_SECTION_ID);
		if (!hero) throw new Error("the page rendered no hero");

		const cta = within(hero).getByRole("link", { name: COPY.hero.primaryCta });

		expect(cta.getAttribute("href")).toBe(`#${SIGN_SECTION_ID}`);
	});
});

/**
 * The public list, in place on the page.
 *
 * What it renders and how it asks for more is `supporters-section.test.tsx`'s
 * subject. What this covers is the seam: the page hands the section what the
 * loader read from D1, so the first names are in the server's own HTML rather
 * than fetched after hydration the way the rest of the list is.
 */
describe("LandingPage, supporters", () => {
	// User story 15 meeting user story 11: one signature, and the two halves of
	// the page that report it do so in the same update. The counter counts it
	// because it is a signature; the list names it because its signer agreed to
	// be named. Nothing arranges that here — the object sends both in one frame.
	it("adds a name and moves the count in one push", async () => {
		await renderPage(signed(3));

		act(() =>
			FakeSocket.last.push(pushed(signed(4), [{ id: "id-ewa", name: "Ewa W.", city: "Gdańsk" }])),
		);

		await waitFor(() => expect(screen.getByText("Ewa W., Gdańsk")).not.toBeNull());
		expect(figure()).toBe("4");
	});

	// The other half of the seam, and the one the issue says reads as intended
	// rather than as a contradiction: a signature whose signer declined moves
	// the number and leaves the list alone.
	it("moves the count for a signature that brought no name with it", async () => {
		await renderPage(signed(3), {
			supporters: [{ id: "id-anna", name: "Anna K.", city: "Warszawa" }],
			nextCursor: null,
		});

		act(() => FakeSocket.last.push(pushed(signed(4))));

		await waitFor(() => expect(figure()).toBe("4"));
		const list = document.getElementById(SUPPORTERS_SECTION_ID);
		if (!list) throw new Error("the page rendered no supporters section");
		expect(
			within(list)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["Anna K., Warszawa"]);
	});

	it("shows the supporters the server read, without asking for them again", async () => {
		await renderPage(signed(1), {
			supporters: [{ id: "id-anna", name: "Anna K.", city: "Warszawa" }],
			nextCursor: null,
		});

		expect(screen.getByText("Anna K., Warszawa").textContent).toBe("Anna K., Warszawa");
	});
});

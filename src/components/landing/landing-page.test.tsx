import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import { LandingPage } from "@/components/landing/landing-page";
import { getContent } from "@/content";

/**
 * The page, assembled — specifically the two things that only exist once it is
 * assembled: one socket feeding both places the count appears, and a bar that
 * knows when the hero is behind the reader.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is the count the loader read from D1 on the server. Everything
 *   after the first paint arrives over the socket.
 * - **Output**: the counter section and the floating bar always show the same
 *   number, because they are given the same one.
 * - **The socket and `IntersectionObserver` are stubbed** — the network and a
 *   layout jsdom does not have. Their own behaviour is covered in
 *   `use-live-count.test.tsx` and `floating-bar.test.tsx`.
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
		vi.fn(async () => Response.json({ data: { total: 0, byVoivodeship: {} } })),
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
async function renderPage(count: number) {
	const rootRoute = createRootRoute({
		component: () => (
			<QueryClientProvider client={new QueryClient()}>
				<LandingPage count={count} language="pl" />
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

describe("LandingPage, live count", () => {
	it("paints the count the server read before any socket has said anything", async () => {
		await renderPage(3);

		expect(figure()).toBe("3");
	});

	// User story 11: signing ticks the number without a reload. The push below
	// is what the object sends after the sign endpoint tells it about a row.
	it("moves the visible count when the counter pushes a new one", async () => {
		await renderPage(3);

		act(() => FakeSocket.last.push({ total: 4, byVoivodeship: { "PL-MZ": 4 } }));

		await waitFor(() => expect(figure()).toBe("4"));
	});

	// One socket, two places the number shows. Opening a second connection for
	// the bar would double the deployment's socket count for one number.
	it("shows the bar the same number as the counter, from one connection", async () => {
		await renderPage(3);
		expect(FakeSocket.opened).toHaveLength(1);

		act(() => FakeSocket.last.push({ total: 4, byVoivodeship: {} }));
		FakeObserver.reportAll(false);

		await waitFor(() => expect(screen.getByTestId("floating-bar-figure").textContent).toBe("4"));
		expect(FakeSocket.opened).toHaveLength(1);
	});
});

describe("LandingPage, floating bar", () => {
	it("keeps the bar away while the reader is still on the hero", async () => {
		await renderPage(3);

		FakeObserver.reportAll(true);

		expect(screen.queryByRole("link", { name: COPY.floatingBar.cta })).toBeNull();
	});

	it("brings the bar in once the hero is behind the reader", async () => {
		await renderPage(3);

		FakeObserver.reportAll(false);

		const cta = screen.getByRole("link", { name: COPY.floatingBar.cta });
		expect(cta.getAttribute("href")).toBe("#podpisz");
	});
});

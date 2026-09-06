import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveCounts } from "@/components/counter/use-live-counts";
import type { SignatureCounts } from "@/core/signature-counts";

/**
 * The page's half of the live counter.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is the counts the server already rendered. The hook starts there
 *   and never shows less than the page was painted with.
 * - **Output** is the whole payload: the headline number and the split behind
 *   it, handed on together because the counter and the map both read it and a
 *   page that updated one without the other would contradict itself.
 * - **Boundaries**: a `WebSocket` constructor that throws outright, a socket
 *   that closes without ever delivering, a push that is not the shape it
 *   should be, and a component that unmounts mid-connection.
 * - **The socket and `fetch` are stubbed** because they are the network. What
 *   is under test is what the hook does with what arrives, and a real socket
 *   would only add a server to the list of things that can make this fail.
 * - **Not covered here**: reconnecting after a drop, which the issue puts out
 *   of scope — the fallback below is what a dropped socket degrades to.
 */

/** A socket the test drives, standing in for the browser's. */
class FakeSocket {
	static opened: FakeSocket[] = [];

	/** Set when the constructor should refuse, the way a blocked origin does. */
	static refuse = false;

	readonly #listeners = new Map<string, Set<(event: unknown) => void>>();
	closed = false;

	constructor(readonly url: string) {
		if (FakeSocket.refuse) throw new Error("socket refused");
		FakeSocket.opened.push(this);
	}

	static get last(): FakeSocket {
		const socket = FakeSocket.opened.at(-1);
		if (!socket) throw new Error("nothing opened a socket");
		return socket;
	}

	static reset(): void {
		FakeSocket.opened = [];
		FakeSocket.refuse = false;
	}

	addEventListener(type: string, listener: (event: unknown) => void): void {
		const listeners = this.#listeners.get(type) ?? new Set();
		listeners.add(listener);
		this.#listeners.set(type, listeners);
	}

	removeEventListener(type: string, listener: (event: unknown) => void): void {
		this.#listeners.get(type)?.delete(listener);
	}

	close(): void {
		this.closed = true;
	}

	/** What the Durable Object pushing counts looks like from in here. */
	push(payload: unknown): void {
		this.#emit("message", { data: JSON.stringify(payload) });
	}

	pushRaw(data: string): void {
		this.#emit("message", { data });
	}

	drop(): void {
		this.#emit("close", {});
	}

	#emit(type: string, event: unknown): void {
		for (const listener of this.#listeners.get(type) ?? []) listener(event);
	}
}

/** The counts a page was painted with, before any region signed. */
function signed(total: number): SignatureCounts {
	return { total, byVoivodeship: {} };
}

/** The snapshot endpoint, answering whatever a test wants it to. */
function stubSnapshot(total: number): ReturnType<typeof vi.fn> {
	const stub = vi.fn(async () => Response.json({ data: { total, byVoivodeship: {} } }));
	vi.stubGlobal("fetch", stub);
	return stub;
}

beforeEach(() => {
	FakeSocket.reset();
	vi.stubGlobal("WebSocket", FakeSocket);
	stubSnapshot(0);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("useLiveCounts", () => {
	it("starts at the count the page was rendered with", () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		expect(result.current.total).toBe(7);
	});

	it("opens a socket against this deployment's live endpoint", () => {
		renderHook(() => useLiveCounts(signed(0)));

		expect(new URL(FakeSocket.last.url).pathname).toBe("/api/live");
	});

	it("moves to the number the socket pushes", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => FakeSocket.last.push({ total: 12, byVoivodeship: { "PL-MZ": 12 } }));

		await waitFor(() => expect(result.current.total).toBe(12));
	});

	// The map's half of the same push. It arrives on the same frame as the
	// total, which is the only reason the two can never disagree.
	it("hands on the split the push carried, not just its total", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => FakeSocket.last.push({ total: 12, byVoivodeship: { "PL-MZ": 9, "PL-PM": 3 } }));

		await waitFor(() => expect(result.current.byVoivodeship).toEqual({ "PL-MZ": 9, "PL-PM": 3 }));
	});

	// A payload that is not the shape it should be is a bug somewhere, and the
	// honest response is to keep showing the number that was verified rather
	// than to render `undefined` where a count belongs.
	it("keeps the number it has when a push cannot be read", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => {
			FakeSocket.last.pushRaw("not json at all");
			FakeSocket.last.push({ total: "many" });
		});

		await waitFor(() => expect(result.current.total).toBe(7));
	});

	it("lets go of the socket when the page goes away", () => {
		const { unmount } = renderHook(() => useLiveCounts(signed(0)));
		const socket = FakeSocket.last;

		unmount();

		expect(socket.closed).toBe(true);
	});
});

/**
 * The degradation path. A corporate proxy, a strict extension or a captive
 * network can all stop a WebSocket without stopping the site, and a petition
 * whose counter freezes on those networks looks broken rather than blocked.
 */
describe("useLiveCounts, when no socket can be established", () => {
	it("polls the snapshot endpoint when the socket is refused outright", async () => {
		FakeSocket.refuse = true;
		const snapshot = stubSnapshot(41);

		const { result } = renderHook(() => useLiveCounts(signed(7)));

		await waitFor(() => expect(result.current.total).toBe(41));
		expect(snapshot).toHaveBeenCalledWith("/api/signatures/snapshot");
	});

	it("polls after a socket closes without ever delivering", async () => {
		stubSnapshot(23);
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => FakeSocket.last.drop());

		await waitFor(() => expect(result.current.total).toBe(23));
	});

	// Polling once is a retry. Polling on is the fallback — the number has to
	// keep moving for as long as the reader keeps the page open.
	//
	// The clock is faked before the hook renders, so the interval it sets up is
	// the one being advanced. Faking afterwards would leave a real interval
	// nothing in the test can reach, and the assertion would pass by never
	// having fired.
	it("keeps polling for as long as the page is open", async () => {
		vi.useFakeTimers();
		FakeSocket.refuse = true;
		const snapshot = stubSnapshot(1);

		renderHook(() => useLiveCounts(signed(0)));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		const afterFallingBack = snapshot.mock.calls.length;
		expect(afterFallingBack).toBeGreaterThan(0);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(60_000);
		});

		expect(snapshot.mock.calls.length).toBeGreaterThan(afterFallingBack);
	});

	it("stops polling once the page goes away", async () => {
		vi.useFakeTimers();
		FakeSocket.refuse = true;
		const snapshot = stubSnapshot(1);
		const { unmount } = renderHook(() => useLiveCounts(signed(0)));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		unmount();
		const afterUnmount = snapshot.mock.calls.length;

		await act(async () => {
			await vi.advanceTimersByTimeAsync(60_000);
		});

		expect(snapshot.mock.calls.length).toBe(afterUnmount);
	});
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveCounts } from "@/components/counter/use-live-counts";
import type { LiveUpdate } from "@/core/live-update";
import type { Supporter } from "@/core/supporters";

/**
 * The page's half of the live counter.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is the counts the server already rendered. The hook starts there
 *   and never shows less than the page was painted with.
 * - **Output** is the whole payload: the headline number and the split behind
 *   it, handed on together because the counter and the map both read it and a
 *   page that updated one without the other would contradict itself — plus
 *   every published name the connection has delivered, accumulated and
 *   deduplicated by id, because a push carries what is new rather than what
 *   exists and the same name may arrive twice.
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
function signed(total: number) {
	return { total, byVoivodeship: {}, secondsSinceLastSignature: null };
}

/** A supporter as the server publishes one. */
function named(id: string, name: string): Supporter {
	return { id, name, city: "Warszawa" };
}

/** What the object broadcasts and the snapshot endpoint answers with. */
function update(total: number, supporters: Supporter[] = []): LiveUpdate {
	return { counts: signed(total), supporters };
}

/** The snapshot endpoint, answering whatever a test wants it to. */
function stubSnapshot(total: number, supporters: Supporter[] = []): ReturnType<typeof vi.fn> {
	const stub = vi.fn(async () => Response.json({ data: update(total, supporters) }));
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

		expect(result.current.counts.total).toBe(7);
	});

	it("opens a socket against this deployment's live endpoint", () => {
		renderHook(() => useLiveCounts(signed(0)));

		expect(new URL(FakeSocket.last.url).pathname).toBe("/api/live");
	});

	it("moves to the number the socket pushes", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => FakeSocket.last.push(update(12)));

		await waitFor(() => expect(result.current.counts.total).toBe(12));
	});

	// The map's half of the same push. It arrives on the same frame as the
	// total, which is the only reason the two can never disagree.
	it("hands on the split the push carried, not just its total", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() =>
			FakeSocket.last.push({
				counts: {
					total: 12,
					byVoivodeship: { "PL-MZ": 9, "PL-PM": 3 },
					secondsSinceLastSignature: 4,
				},
				supporters: [],
			}),
		);

		await waitFor(() =>
			expect(result.current.counts.byVoivodeship).toEqual({ "PL-MZ": 9, "PL-PM": 3 }),
		);
	});

	// A payload that is not the shape it should be is a bug somewhere, and the
	// honest response is to keep showing the number that was verified rather
	// than to render `undefined` where a count belongs.
	it("keeps the number it has when a push cannot be read", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => {
			FakeSocket.last.pushRaw("not json at all");
			FakeSocket.last.push({ counts: { total: "many" }, supporters: [] });
		});

		await waitFor(() => expect(result.current.counts.total).toBe(7));
	});

	// The list's half of the same push. A push carries what the sender believes
	// is new, so the hook has to remember: a reader who has been on the page for
	// an hour has to be holding every name that arrived in it, not the last one.
	it("collects the names a push carries", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => FakeSocket.last.push(update(8, [named("id-anna", "Anna K.")])));

		await waitFor(() => expect(result.current.arrivals.map((s) => s.name)).toEqual(["Anna K."]));
	});

	it("keeps the names an earlier push delivered, newest first", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => FakeSocket.last.push(update(8, [named("id-anna", "Anna K.")])));
		act(() => FakeSocket.last.push(update(9, [named("id-piotr", "Piotr N.")])));

		await waitFor(() =>
			expect(result.current.arrivals.map((s) => s.name)).toEqual(["Piotr N.", "Anna K."]),
		);
	});

	// The object suppresses names it has already sent, but it forgets what it
	// sent when it is evicted, and the polling fallback has no memory at all. So
	// a repeat is expected traffic rather than a bug, and the id is what settles
	// it — the same row can only ever be one entry.
	it("never lists the same name twice, however often it arrives", async () => {
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => FakeSocket.last.push(update(8, [named("id-anna", "Anna K.")])));
		act(() => FakeSocket.last.push(update(8, [named("id-anna", "Anna K.")])));

		await waitFor(() => expect(result.current.counts.total).toBe(8));
		expect(result.current.arrivals).toHaveLength(1);
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

		await waitFor(() => expect(result.current.counts.total).toBe(41));
		expect(snapshot).toHaveBeenCalledWith("/api/signatures/snapshot");
	});

	// The reason the fallback carries names at all. A reader behind a proxy that
	// strips upgrades is exactly the reader who cannot reload to see who else
	// signed, so a fallback that carried only the numbers would leave them with
	// the frozen list this issue exists to remove.
	it("collects the names the snapshot endpoint answers with", async () => {
		FakeSocket.refuse = true;
		stubSnapshot(41, [named("id-anna", "Anna K.")]);

		const { result } = renderHook(() => useLiveCounts(signed(7)));

		await waitFor(() => expect(result.current.arrivals.map((s) => s.name)).toEqual(["Anna K."]));
	});

	it("polls after a socket closes without ever delivering", async () => {
		stubSnapshot(23);
		const { result } = renderHook(() => useLiveCounts(signed(7)));

		act(() => FakeSocket.last.drop());

		await waitFor(() => expect(result.current.counts.total).toBe(23));
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

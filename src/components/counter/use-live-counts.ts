import { useEffect, useState } from "react";
import { type LiveUpdate, parseLiveUpdate } from "@/core/live-update";
import type { SignatureCounts } from "@/core/signature-counts";
import type { Supporter } from "@/core/supporters";

/** Where the counts are pushed from, and where they can be fetched instead. */
const LIVE_PATH = "/api/live";
const SNAPSHOT_PATH = "/api/signatures/snapshot";

/**
 * How often the fallback asks, in milliseconds.
 *
 * Slower than the socket by an order of magnitude, and deliberately so: this
 * path costs a request and a D1 read per reader per tick, where the socket
 * costs one read for everybody. It is the difference between a counter that
 * moves and one that is live, which is the right thing to give up when the
 * live one is not available.
 */
const POLL_MS = 15_000;

/**
 * What the page is watching: the numbers as they stand, and everybody who has
 * been published since it opened.
 */
export interface LivePetition {
	counts: SignatureCounts;
	/**
	 * The published names this connection has delivered, newest first.
	 *
	 * Arrivals rather than the list: what the page was rendered with is not in
	 * here, and neither is anything a reader fetched by asking for more. The
	 * section owns the list and merges these into it, because it is the only
	 * thing that knows what is already on screen.
	 */
	arrivals: Supporter[];
}

/**
 * The petition, kept current for as long as the page is open.
 *
 * Two paths, and the page cannot tell which it is on. The socket is the real
 * one: the `LiveCounter` Durable Object pushes to every reader at once, so a
 * signature shows up everywhere within about a second. When no socket can be
 * established — a proxy that strips upgrades, an extension, a captive network
 * — it falls back to asking the snapshot endpoint on a timer. Nothing is said
 * about it on screen, because a reader cannot act on the difference and a
 * warning would only make a working page look broken. Both paths carry the same
 * object, which is why the fallback degrades the tempo rather than the content.
 *
 * The whole `SignatureCounts` is handed on rather than the total, because the
 * page has three readers of it: the headline counter, the floating bar and the
 * map. Handing them one object from one connection is what keeps the map's
 * parts and the counter's whole from disagreeing — they cannot be updated
 * separately if they were never separate.
 *
 * Names accumulate rather than replace. A push carries what its sender believes
 * is new, and neither sender is certain: the object forgets what it sent when
 * it is evicted, and the polling endpoint never knew. So the id decides, and a
 * name that arrives twice is held once.
 */
export function useLiveCounts(initial: SignatureCounts): LivePetition {
	const [counts, setCounts] = useState(initial);
	const [arrivals, setArrivals] = useState<Supporter[]>([]);

	useEffect(() => {
		let live = true;

		/** Ignore anything that arrives after the component has gone. */
		const apply = (next: LiveUpdate | null) => {
			if (!live || !next) return;

			setCounts(next.counts);
			if (next.supporters.length === 0) return;

			setArrivals((collected) => {
				const held = new Set(collected.map((supporter) => supporter.id));
				const fresh = next.supporters.filter((supporter) => !held.has(supporter.id));
				// The same array back when a push repeated itself, so a page that
				// has been open all day re-renders its list only when the list has
				// something new in it.
				return fresh.length === 0 ? collected : [...fresh, ...collected];
			});
		};

		let poll: ReturnType<typeof setInterval> | undefined;

		const startPolling = () => {
			if (!live || poll !== undefined) return;

			const ask = async () => {
				try {
					const response = await fetch(SNAPSHOT_PATH);
					const body = (await response.json()) as { data?: unknown };
					apply(parseLiveUpdate(body.data));
				} catch {
					// A failed poll is the next poll's problem. The number on
					// screen is the last one that was true, which beats anything
					// this could put there instead.
				}
			};

			void ask();
			poll = setInterval(() => void ask(), POLL_MS);
		};

		let socket: WebSocket | undefined;

		try {
			socket = new WebSocket(liveUrl());
			socket.addEventListener("message", (event: MessageEvent) => {
				apply(readUpdate(event.data));
			});
			// Both mean the same thing here, because reconnecting is out of this
			// slice's scope: whatever went wrong, the socket is not the path any
			// more, so the page changes to the one that works.
			socket.addEventListener("error", startPolling);
			socket.addEventListener("close", startPolling);
		} catch {
			// Some environments refuse the constructor outright rather than
			// failing the handshake, so the fallback has to be reachable from
			// here too.
			startPolling();
		}

		return () => {
			live = false;
			if (poll !== undefined) clearInterval(poll);
			socket?.close();
		};
	}, []);

	return { counts, arrivals };
}

/** The socket's address, on this origin and on this origin's protocol. */
function liveUrl(): string {
	const url = new URL(LIVE_PATH, window.location.href);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url.toString();
}

/** An update out of a socket frame, or nothing if the frame was not one. */
function readUpdate(data: unknown): LiveUpdate | null {
	if (typeof data !== "string") return null;
	try {
		return parseLiveUpdate(JSON.parse(data));
	} catch {
		return null;
	}
}

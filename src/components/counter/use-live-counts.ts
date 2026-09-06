import { useEffect, useState } from "react";
import { parseSignatureCounts, type SignatureCounts } from "@/core/signature-counts";

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
 * The petition's counts, kept current for as long as the page is open.
 *
 * Two paths, and the page cannot tell which it is on. The socket is the real
 * one: the `LiveCounter` Durable Object pushes to every reader at once, so a
 * signature shows up everywhere within about a second. When no socket can be
 * established — a proxy that strips upgrades, an extension, a captive network
 * — it falls back to asking the snapshot endpoint on a timer. Nothing is said
 * about it on screen, because a reader cannot act on the difference and a
 * warning would only make a working page look broken.
 *
 * The whole `SignatureCounts` is returned rather than the total, because the
 * page now has two readers of it: the headline counter, which wants the
 * number, and the map, which wants the split. Handing them one object from one
 * connection is what keeps the map's parts and the counter's whole from
 * disagreeing — they cannot be updated separately if they were never separate.
 */
export function useLiveCounts(initial: SignatureCounts): SignatureCounts {
	const [counts, setCounts] = useState(initial);

	useEffect(() => {
		let live = true;

		/** Ignore anything that arrives after the component has gone. */
		const apply = (next: SignatureCounts | null) => {
			if (live && next) setCounts(next);
		};

		let poll: ReturnType<typeof setInterval> | undefined;

		const startPolling = () => {
			if (!live || poll !== undefined) return;

			const ask = async () => {
				try {
					const response = await fetch(SNAPSHOT_PATH);
					const body = (await response.json()) as { data?: unknown };
					apply(parseSignatureCounts(body.data));
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
				apply(readCounts(event.data));
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

	return counts;
}

/** The socket's address, on this origin and on this origin's protocol. */
function liveUrl(): string {
	const url = new URL(LIVE_PATH, window.location.href);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url.toString();
}

/** Counts out of a socket frame, or nothing if the frame was not counts. */
function readCounts(data: unknown): SignatureCounts | null {
	if (typeof data !== "string") return null;
	try {
		return parseSignatureCounts(JSON.parse(data));
	} catch {
		return null;
	}
}

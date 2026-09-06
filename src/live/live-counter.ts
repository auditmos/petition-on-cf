import { DurableObject } from "cloudflare:workers";
import type { SignatureCounts } from "@/core/signature-counts";
import { readSignatureCounts } from "@/db/signatures";

/**
 * The floor on how often the object pushes, in milliseconds.
 *
 * A petition that is being shared can take signatures faster than a person can
 * read them, and a browser gains nothing from sixty repaints a second. One
 * push per second is the rate a moving number is legible at.
 */
const COALESCE_MS = 1_000;

/**
 * How long the object will go without checking D1 while anybody is watching.
 *
 * The notification is fire-and-forget, so it can be dropped — and one dropped
 * notification would otherwise leave every connected reader on a number that
 * is quietly, permanently wrong. This is the backstop, not the mechanism:
 * slow enough that it costs a connected petition two queries a minute, quick
 * enough that nobody stares at a stale figure for long.
 */
const RECONCILE_MS = 30_000;

/**
 * The petition's live counter: one object per deployment, a cache in front of
 * D1 and a broadcaster to whoever is watching.
 *
 * ## What it is not
 *
 * It is not a source of truth and it never writes D1. Everything it holds came
 * out of a `GROUP BY` on the signatures table, so losing all of it — to an
 * eviction, a deploy, a cold start — costs one query and nothing else. That is
 * the whole reason the counts can live in memory rather than in the object's
 * own storage: storage would be a second copy of the answer, and a second copy
 * is a thing that can disagree.
 */
export class LiveCounter extends DurableObject<Env> {
	/**
	 * The cached counts, held as the promise rather than as the value.
	 *
	 * Two clients connecting in the same instant both find the field set and
	 * both await the same read, instead of both starting one. Storing the
	 * resolved value would make that a race with D1 at the end of it.
	 */
	#counts: Promise<SignatureCounts> | null = null;

	/**
	 * When the last push went out, and therefore when the next one may.
	 *
	 * Zero on a fresh instance, which is what makes the first notification
	 * after a cold start push immediately rather than sit out a window it
	 * already spent not existing.
	 */
	#pushedAt = 0;

	/**
	 * The only way in from outside: a WebSocket upgrade, answered with the
	 * current counts so a page has a number before anything changes.
	 */
	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
			// 426 rather than 404: the resource is here, the protocol is wrong.
			// Anything else invites a caller to poll this instead of the
			// snapshot endpoint, which is the one built to be polled.
			return new Response(null, { status: 426 });
		}

		const { 0: client, 1: server } = new WebSocketPair();

		// The hibernation API, not `server.accept()`. It is what lets the
		// runtime evict this object while the socket stays open — which for a
		// petition page left in a background tab is the normal case, not the
		// exception.
		this.ctx.acceptWebSocket(server);
		server.send(JSON.stringify(await this.#current()));

		// Somebody is watching now, so the backstop starts running.
		await this.#scheduleAt(Date.now() + RECONCILE_MS);

		return new Response(null, { status: 101, webSocket: client });
	}

	/**
	 * The sign path saying a signature was stored — not saying the total is one
	 * higher.
	 *
	 * That distinction is the whole design. A cold object rebuilding from D1
	 * has already seen the row this notification is about, so adding one to the
	 * rebuild would count it twice; and a notification lost in flight would
	 * leave a running object permanently one short. Re-reading makes both
	 * impossible: the answer is always whatever D1 says, and the notification
	 * only decides *when* to ask.
	 */
	async signatureRecorded(): Promise<void> {
		await this.#scheduleAt(this.#pushedAt + COALESCE_MS);
	}

	/**
	 * The object's clock, and the only thing that pushes.
	 *
	 * An alarm rather than a timer, because a timer belongs to the request that
	 * created it and this object is designed to be evicted between requests.
	 * An alarm survives that, and survives hibernation.
	 */
	async alarm(): Promise<void> {
		await this.#push();

		// Rescheduled from inside the alarm rather than cancelled from a close
		// handler: an object with nobody attached simply lets the chain end. That
		// is one wasted wake-up after the last reader leaves, and no bookkeeping
		// about which socket was the last one.
		if (this.ctx.getWebSockets().length > 0) {
			await this.#scheduleAt(Date.now() + RECONCILE_MS);
		}
	}

	/** Re-read D1, cache the answer, and hand it to everyone listening. */
	async #push(): Promise<void> {
		const counts = await readSignatureCounts(this.env.DB);
		this.#counts = Promise.resolve(counts);
		this.#pushedAt = Date.now();

		const payload = JSON.stringify(counts);
		// `getWebSockets()` is the hibernation API's own register, so this
		// reaches sockets attached by instances of this object that no longer
		// exist — which after any eviction is most of them.
		for (const socket of this.ctx.getWebSockets()) socket.send(payload);
	}

	/**
	 * Bring the alarm forward to `when`, never push it back.
	 *
	 * Fifty notifications inside one window all name the same instant, so they
	 * collapse into the one alarm that is already set. The `Date.now()` floor
	 * is what makes the first notification after a quiet spell fire at once
	 * instead of waiting out a window it already sat through.
	 */
	async #scheduleAt(when: number): Promise<void> {
		const at = Math.max(when, Date.now());
		const scheduled = await this.ctx.storage.getAlarm();
		if (scheduled === null || scheduled > at) await this.ctx.storage.setAlarm(at);
	}

	/** The counts, rebuilt from D1 the first time anybody asks. */
	#current(): Promise<SignatureCounts> {
		this.#counts ??= readSignatureCounts(this.env.DB);
		return this.#counts;
	}
}

/**
 * The name of the one object this deployment has.
 *
 * One deployment is one petition, so there is one counter and every visitor
 * lands on it. A name rather than `newUniqueId()` because the id has to be
 * derivable from nothing — the sign path and the socket endpoint each look it
 * up cold, on separate requests, with no way to share a handle.
 */
export const LIVE_COUNTER_NAME = "petition";

/** The deployment's counter, addressed the same way from everywhere. */
export function liveCounter(env: Env): DurableObjectStub<LiveCounter> {
	return env.LIVE_COUNTER.get(env.LIVE_COUNTER.idFromName(LIVE_COUNTER_NAME));
}

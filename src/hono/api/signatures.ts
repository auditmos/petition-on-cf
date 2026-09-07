import { type ZodError, z } from "zod";
import { getContent } from "@/content";
import { AppError, rootCauseMessage } from "@/core/errors";
import { createSignatureInputSchema } from "@/core/signature-input";
import { decodeSupporterCursor } from "@/core/supporters";
import { verifyTurnstile } from "@/core/turnstile";
import { resolveVoivodeship } from "@/core/voivodeship";
import { insertSignature, readLiveUpdate, readSupporters } from "@/db/signatures";
import { createHono } from "@/hono/factory";
import { liveCounter } from "@/live";

const signaturesEndpoint = createHono();

/**
 * The endpoint validates in the site's default language.
 *
 * The form validates against this same schema before anything is sent, so a
 * reader normally never sees these sentences — what reaches a client is
 * `details[].field`, which is language-independent and is what a form keys off.
 * Negotiating a language for a message nobody reads would buy a header parser
 * and nothing else.
 */
const COPY = getContent("pl").sign;
/** The read side has its own copy, and one line of it the browser never sees. */
const LIST_COPY = getContent("pl").supporters;
const signatureInputSchema = createSignatureInputSchema(COPY.errors);

/**
 * A rejection the form can act on: which field, and what to say about it.
 *
 * Zod's own issue list carries codes and paths the browser has no use for, so
 * only the first path segment survives — the field names in the payload are
 * flat, and a nested path would mean the schema grew a shape this endpoint has
 * not been told about.
 */
function fieldErrors(error: ZodError): { field: string; message: string }[] {
	return error.issues.map((issue) => ({
		field: String(issue.path[0] ?? ""),
		message: issue.message,
	}));
}

/**
 * The widget's answer, which travels beside the signature rather than in it.
 *
 * It is deliberately not part of `createSignatureInputSchema`: that schema's
 * output is what gets inserted, so a token in it would have to be stripped
 * before every write. This is the proof the submission is human, and it is
 * spent here.
 */
const turnstileSchema = z.object({ turnstileToken: z.string().trim().min(1) });

/**
 * The rate-limit key for a request that carried no client address.
 *
 * Cloudflare sets `CF-Connecting-IP` on everything that reaches a Worker
 * through its edge, so in production this is the bucket for requests that did
 * not — and they share it, which is the conservative reading of "we cannot
 * tell who this is".
 */
const UNATTRIBUTED = "unattributed";

signaturesEndpoint.post("/", async (c) => {
	const body: unknown = await c.req.json();

	// Pipeline order, and it is the order for a reason: a signer who mistyped
	// their e-mail should be told that, not accused of being a robot.
	const parsed = signatureInputSchema.safeParse(body);

	if (!parsed.success) {
		return c.json({ error: COPY.invalidSubmission, details: fieldErrors(parsed.error) }, 400);
	}

	const challenge = turnstileSchema.safeParse(body);

	if (!challenge.success) {
		throw new AppError(COPY.botCheckFailed, "FORBIDDEN", 403);
	}

	const clientIp = c.req.header("cf-connecting-ip");

	const human = await verifyTurnstile({
		secret: c.env.TURNSTILE_SECRET_KEY,
		token: challenge.data.turnstileToken,
		ip: clientIp,
	});

	if (!human) {
		throw new AppError(COPY.botCheckFailed, "FORBIDDEN", 403);
	}

	// After Turnstile, so a machine spends a challenge before it spends a slot
	// — and one shared bucket for requests that arrived without an address,
	// which on Cloudflare means they did not come through the edge at all.
	const { success: withinLimit } = await c.env.SIGN_RATE_LIMIT.limit({
		key: clientIp ?? UNATTRIBUTED,
	});

	if (!withinLimit) {
		throw new AppError(COPY.rateLimited, "RATE_LIMITED", 429);
	}

	// Derived from the platform and the payload, never taken from the payload.
	//
	// Hono types `cf` as `CfProperties<unknown>` because it runs on runtimes
	// that have no such thing. On Workers it is always the platform's own
	// shape, and naming that is what makes the two fields below readable
	// rather than `unknown`.
	const geo = c.req.raw.cf as IncomingRequestCfProperties | undefined;
	const write = await insertSignature(
		c.env.DB,
		parsed.data,
		resolveVoivodeship({
			postalCode: parsed.data.postalCode,
			country: geo?.country,
			regionCode: geo?.regionCode,
		}),
	);

	// Signing twice is something people do by accident, so it answers with its
	// own status and its own wording rather than looking like a rejected form.
	if (write.status === "duplicate") {
		throw new AppError(COPY.duplicate, "CONFLICT", 409, "email");
	}

	// The signature is in D1 by now, which is the only place it has to be. The
	// counter is a cache in front of that, so telling it is the last thing that
	// happens and the one thing allowed to fail: an unreachable Durable Object
	// costs a watching page a few seconds of staleness, and must never cost a
	// signer the signature they just gave.
	c.executionCtx.waitUntil(
		liveCounter(c.env)
			.signatureRecorded()
			.catch((error: unknown) => {
				// biome-ignore lint/suspicious/noConsole: structured log for a swallowed failure surfaces in Workers tail
				console.error(
					JSON.stringify({
						message: "live counter not notified",
						error: rootCauseMessage(error),
					}),
				);
			}),
	);

	return c.json({ data: write }, 201);
});

/**
 * The public state of the petition, and the page's fallback when no socket can
 * be opened.
 *
 * It reads D1 rather than the `LiveCounter` Durable Object deliberately: this
 * is what the page polls when the live path is unavailable, so routing it
 * through the DO would put the fallback in the same failure domain as the
 * thing it is a fallback for. The cost is two queries per poll, which is what
 * a fallback is allowed to cost.
 *
 * It answers with exactly what the socket pushes, names included. A fallback
 * that carried only the numbers would leave the readers who most need it — the
 * ones behind a proxy that strips upgrades — watching a counter move beside a
 * list that never does. Unlike the object, this has no memory of what any
 * caller has already seen, so it always sends the newest few and the page
 * discards the ones it is already showing.
 */
signaturesEndpoint.get("/snapshot", async (c) => {
	return c.json({ data: await readLiveUpdate(c.env.DB) });
});

/**
 * The people who agreed to be named, a page at a time.
 *
 * This is the walk backwards through the list, not the live edge of it: the
 * first page is server-rendered, new names arrive over the connection that
 * already carries the counts, and this answers the reader who asks to see
 * further back. The cursor names a row rather than an offset, so names
 * arriving above the walk while it is in progress cannot shift it.
 *
 * The one parameter is a cursor this endpoint issued. A cursor it did not
 * issue is a request nobody's browser made, so it is refused rather than
 * quietly answered with the first page — which would look to a caller like
 * their pagination had silently restarted.
 */
signaturesEndpoint.get("/supporters", async (c) => {
	const cursor = c.req.query("cursor");

	if (cursor !== undefined && decodeSupporterCursor(cursor) === null) {
		throw new AppError(LIST_COPY.invalidCursor, "VALIDATION", 400, "cursor");
	}

	return c.json({ data: await readSupporters(c.env.DB, cursor) });
});

export default signaturesEndpoint;

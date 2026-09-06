import { type ZodError, z } from "zod";
import { getContent } from "@/content";
import { AppError } from "@/core/errors";
import { createSignatureInputSchema } from "@/core/signature-input";
import { verifyTurnstile } from "@/core/turnstile";
import { resolveVoivodeship } from "@/core/voivodeship";
import { countSignatures, insertSignature } from "@/db/signatures";
import { createHono } from "@/hono/factory";

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

	return c.json({ data: write }, 201);
});

/**
 * The public count, as an object rather than a bare number.
 *
 * The live-counter slice (#7) makes this the fallback the page polls when the
 * WebSocket cannot be established, and adds per-voivodeship counts beside
 * `total` — a response that was a number would have to change shape to get
 * there, and every consumer with it.
 */
signaturesEndpoint.get("/snapshot", async (c) => {
	return c.json({ data: { total: await countSignatures(c.env.DB) } });
});

export default signaturesEndpoint;

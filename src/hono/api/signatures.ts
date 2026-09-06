import type { ZodError } from "zod";
import { getContent } from "@/content";
import { AppError } from "@/core/errors";
import { createSignatureInputSchema } from "@/core/signature-input";
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

signaturesEndpoint.post("/", async (c) => {
	const parsed = signatureInputSchema.safeParse(await c.req.json());

	if (!parsed.success) {
		return c.json({ error: COPY.invalidSubmission, details: fieldErrors(parsed.error) }, 400);
	}

	const write = await insertSignature(c.env.DB, parsed.data);

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

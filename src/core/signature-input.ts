import { z } from "zod";

/**
 * What a visitor has to supply to sign, and what the server will believe.
 *
 * This lives in `core/` rather than beside the database or the endpoint because
 * both the form and the handler validate against it, and a schema that imported
 * Drizzle would drag the driver into the browser bundle. It knows nothing about
 * storage.
 *
 * E-mail is normalised here — trimmed and lowercased — so the value that
 * reaches the unique index is the same for `Anna@Example.COM ` as for
 * `anna@example.com`. Doing it in the schema rather than at the call site means
 * there is one normalisation, and it is the one the form and the server share.
 *
 * ## Why the schema is built rather than declared
 *
 * The rules are the same in every language; the sentence explaining a broken
 * one is not. So the messages arrive as an argument, from the content files,
 * and this module holds no copy — which is the whole point of the content
 * module and is checked by `src/components/no-hardcoded-copy.test.ts`.
 */

/** One sentence per way the form can be wrong, in the reader's language. */
export interface SignatureMessages {
	firstName: string;
	surname: string;
	email: string;
	city: string;
	postalCode: string;
	consentRodo: string;
	tooLong: string;
	emailTooLong: string;
}

/** Polish postal codes are `NN-NNN` and nothing else. */
const POSTAL_CODE = /^\d{2}-\d{3}$/;

export function createSignatureInputSchema(messages: SignatureMessages) {
	const requiredText = (missing: string) =>
		z.string().trim().min(1, missing).max(100, messages.tooLong);

	return z.object({
		firstName: requiredText(messages.firstName),
		surname: requiredText(messages.surname),
		// Normalise first, validate second: a trailing space is a typo to absorb,
		// not a reason to reject an otherwise good address.
		email: z
			.string()
			.trim()
			.toLowerCase()
			.pipe(z.email(messages.email).max(254, messages.emailTooLong)),
		city: requiredText(messages.city),
		/**
		 * Always optional, and the preferred region signal when it is there.
		 *
		 * An untouched input posts `""`, which is the same statement as leaving
		 * the field out — both become `null` in storage. Only a code that was
		 * actually typed and is not a Polish postal code is a reason to reject.
		 */
		postalCode: z
			.string()
			.trim()
			.refine((value) => value === "" || POSTAL_CODE.test(value), messages.postalCode)
			.nullish()
			.transform((value) => value || null),
		/**
		 * Mandatory: an unticked box is a rejection, not a false.
		 *
		 * Spelled as a boolean the schema then refuses rather than as the literal
		 * `true`, because the form starts life with the box unticked and validates
		 * against this same schema — a literal would make "unticked" a type error
		 * in the component rather than the message the signer needs to read.
		 */
		consentRodo: z.boolean().refine((given) => given, messages.consentRodo),
	});
}

/** What the server stores, after normalisation. */
export type SignatureInput = z.output<ReturnType<typeof createSignatureInputSchema>>;

/**
 * What a signer types, before it. This is the shape the form holds — a blank
 * postal code and an unticked consent are valid states to be *in*, just not to
 * submit — so it is what the form's initial values are typed against.
 */
export type SignatureDraft = z.input<ReturnType<typeof createSignatureInputSchema>>;

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Content } from "@/content";
import {
	createSignatureInputSchema,
	type SignatureDraft,
	type SignatureInput,
} from "@/core/signature-input";

/**
 * The petition's one write surface.
 *
 * The schema in `@/core/signature-input` validates here and again in the
 * endpoint: here so a typo is answered without a round trip, there because a
 * form is a suggestion and the boundary is what decides. One schema means the
 * two can never drift into disagreeing about what a valid signature is.
 *
 * What the component hides is everything else — field state, the request, and
 * the three things that can come back — so a caller renders `<SignatureForm />`
 * with this language's copy and gets all of it.
 */

/** What the endpoint said, reduced to what the form has to render. */
type Outcome = "signed" | "duplicate";

type SignCopy = Content["sign"];

/** Which label goes with which field, in the order the form asks for them. */
const FIELDS = [
	{ name: "firstName", autoComplete: "given-name" },
	{ name: "surname", autoComplete: "family-name" },
	{ name: "email", autoComplete: "email" },
	{ name: "city", autoComplete: "address-level2" },
	{ name: "postalCode", autoComplete: "postal-code" },
] as const;

const EMPTY: SignatureDraft = {
	firstName: "",
	surname: "",
	email: "",
	city: "",
	postalCode: "",
	consentRodo: false,
};

export function SignatureForm({ copy }: { copy: SignCopy }) {
	const mutation = useMutation({ mutationFn: postSignature });
	// One schema per set of messages, not one per keystroke.
	const schema = useMemo(() => createSignatureInputSchema(copy.errors), [copy.errors]);

	const form = useForm({
		defaultValues: EMPTY,
		// The endpoint's schema, doing the form's validation. Field-level rules
		// written here instead would be a second definition of a valid signature.
		validators: { onSubmit: schema },
		onSubmit: ({ value }) => {
			// Fire and forget: the outcome is rendered in place, so there is
			// nothing to await it for — and awaiting would turn a failed request
			// into a rejected `handleSubmit` nobody catches.
			mutation.reset();
			// Parsing rather than passing `value` through is what applies the
			// schema's normalisation — the trimmed lowercase e-mail that has to
			// reach the unique index, and the blank postal code that has to
			// reach the database as null.
			mutation.mutate(schema.parse(value));
		},
	});

	if (mutation.data === "signed") {
		return (
			<output className="block rounded-xl border border-divider bg-ground p-8">
				<p className="text-lg font-semibold text-ink">{copy.success.heading}</p>
				<p className="mt-3 text-sm leading-relaxed text-quiet">{copy.success.note}</p>
			</output>
		);
	}

	return (
		<form
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
			className="space-y-6"
		>
			{FIELDS.map((field) => (
				<form.Field key={field.name} name={field.name}>
					{(controller) => {
						const error = firstMessage(controller.state.meta.errors);
						return (
							<div>
								<label htmlFor={field.name} className="block text-sm font-medium text-ink">
									{copy.fields[field.name]}
								</label>
								<Input
									id={field.name}
									name={controller.name}
									type={field.name === "email" ? "email" : "text"}
									autoComplete={field.autoComplete}
									value={controller.state.value ?? ""}
									aria-invalid={error ? true : undefined}
									aria-describedby={error ? `${field.name}-error` : undefined}
									onBlur={controller.handleBlur}
									onChange={(event) => controller.handleChange(event.target.value)}
									className="mt-2"
								/>
								{error ? (
									<p id={`${field.name}-error`} role="alert" className="mt-2 text-sm text-negative">
										{error}
									</p>
								) : null}
							</div>
						);
					}}
				</form.Field>
			))}

			<form.Field name="consentRodo">
				{(controller) => {
					const error = firstMessage(controller.state.meta.errors);
					return (
						<div>
							<label htmlFor="consentRodo" className="flex items-start gap-3 text-sm text-quiet">
								<input
									id="consentRodo"
									name={controller.name}
									type="checkbox"
									checked={controller.state.value}
									aria-invalid={error ? true : undefined}
									aria-describedby={error ? "consentRodo-error" : undefined}
									onBlur={controller.handleBlur}
									onChange={(event) => controller.handleChange(event.target.checked)}
									className="mt-1 h-4 w-4 shrink-0"
								/>
								<span>{copy.consentRodo}</span>
							</label>
							{error ? (
								<p id="consentRodo-error" role="alert" className="mt-2 text-sm text-negative">
									{error}
								</p>
							) : null}
						</div>
					);
				}}
			</form.Field>

			{mutation.data === "duplicate" ? (
				<output className="block rounded-lg border border-divider bg-ground p-4 text-sm text-quiet">
					{copy.duplicate}
				</output>
			) : null}

			{mutation.isError ? (
				<output className="block rounded-lg border border-divider bg-ground p-4 text-sm text-quiet">
					{copy.failure}
				</output>
			) : null}

			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<Button type="submit" size="lg" disabled={isSubmitting || mutation.isPending}>
						{copy.submit}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

/**
 * The one message a field has room for.
 *
 * A failed check often reports several — "too short" and "not an e-mail" at
 * once — and the first is the one the signer has to fix before the rest can
 * even be evaluated.
 */
function firstMessage(errors: readonly unknown[]): string | undefined {
	for (const error of errors) {
		if (typeof error === "string") return error;
		if (error && typeof error === "object" && "message" in error) {
			return String((error as { message: unknown }).message);
		}
	}
	return undefined;
}

/**
 * The request, and the only place that reads meaning into a status code.
 *
 * Signing twice is not an error — it is an answer the form renders — so 409
 * resolves rather than throws. Anything else throws, which is what puts the
 * mutation into its error state.
 */
async function postSignature(input: SignatureInput): Promise<Outcome> {
	const response = await fetch("/api/signatures", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});

	if (response.status === 201) return "signed";
	if (response.status === 409) return "duplicate";
	throw new Error(`Sign request failed with ${response.status}`);
}

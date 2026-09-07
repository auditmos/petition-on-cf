import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LegalSentence } from "@/components/legal/legal-text";
import { TextField } from "@/components/signature-form/text-field";
import { TurnstileWidget } from "@/components/signature-form/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Content, Language } from "@/content";
import { getLegalText, type LegalTextName } from "@/content/legal";
import { COLLECT_SIGNER_ROLE } from "@/content/site-config";
import {
	createSignatureInputSchema,
	SIGNER_TYPES,
	type SignatureDraft,
	type SignatureInput,
	type SignerType,
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

/**
 * What the endpoint said, reduced to what the form has to render.
 *
 * The two trust-pipeline refusals are separate outcomes rather than one
 * "rejected", because they ask the signer for different things: one is "reload
 * and let the check finish", the other is "wait a minute". Collapsing them
 * would mean showing at least one of them the wrong instruction.
 */
type Outcome = "signed" | "duplicate" | "bot-check" | "rate-limited";

type SignCopy = Content["sign"];

/** Which label goes with which field, in the order the form asks for them. */
const FIELDS = [
	{ name: "firstName", autoComplete: "given-name" },
	{ name: "surname", autoComplete: "family-name" },
	{ name: "email", autoComplete: "email" },
	{ name: "city", autoComplete: "address-level2" },
	{ name: "postalCode", autoComplete: "postal-code" },
] as const;

/**
 * The organisation's own fields, prepended when the signer represents one.
 *
 * The role is only asked where the deployment says so (`COLLECT_SIGNER_ROLE`);
 * the name is always asked, and is the one thing an organisation cannot sign
 * without. Both labels decline the configured noun, which is why they are
 * tokens in the content files rather than words.
 */
const ORGANIZATION_FIELDS = [
	{ name: "companyName", autoComplete: "organization" },
	{ name: "signerRole", autoComplete: "organization-title" },
] as const;

/**
 * The three consent boxes, in the order they are asked.
 *
 * Each names the fixture whose wording it carries, because that wording is a
 * legal text rather than copy: it is the same approved Polish sentence in both
 * languages, and no component is allowed to paraphrase it. Only the RODO
 * acknowledgment is mandatory — the schema is what refuses it, and what
 * supplies the sentence explaining why.
 *
 * The public-list consent is written twice, once for each kind of signer. That
 * is a second approved text rather than a variant of the first, so it is
 * selected by signer type rather than assembled from one.
 */
const CONSENTS = [
	{ name: "consentRodo", text: () => "consentRodoAcknowledgment" as const },
	{
		name: "consentPublicList",
		text: (signerType: SignerType) =>
			signerType === "company" ? "consentPublicListOrganization" : "consentPublicListPerson",
	},
	{ name: "consentUpdates", text: () => "consentUpdates" as const },
] as const satisfies readonly {
	name: keyof SignatureDraft;
	text: (signerType: SignerType) => LegalTextName;
}[];

const EMPTY: SignatureDraft = {
	firstName: "",
	surname: "",
	email: "",
	city: "",
	postalCode: "",
	consentRodo: false,
	consentPublicList: false,
	consentUpdates: false,
	signerType: "person",
	companyName: "",
	signerRole: "",
};

export function SignatureForm({
	copy,
	legal,
	language,
	/**
	 * Whether to ask a non-personal signer for their role, defaulting to what
	 * this deployment configured. It is a parameter rather than a direct read
	 * so both settings can be exercised without standing in for a module this
	 * code owns; no caller passes it.
	 */
	collectSignerRole = COLLECT_SIGNER_ROLE,
}: {
	copy: SignCopy;
	legal: Content["legal"];
	language: Language;
	collectSignerRole?: boolean;
}) {
	const mutation = useMutation({ mutationFn: postSignature });
	// One schema per set of messages, not one per keystroke.
	const schema = useMemo(() => createSignatureInputSchema(copy.errors), [copy.errors]);

	/**
	 * The bot check's answer, which is not a field the signer fills.
	 *
	 * It lives beside the form state rather than in it because the form's
	 * schema is the one the endpoint inserts with — a token in there would
	 * have to be stripped before every write, and the two definitions of a
	 * valid signature would have drifted apart by the second one.
	 */
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const [awaitingCheck, setAwaitingCheck] = useState(false);

	const form = useForm({
		defaultValues: EMPTY,
		// The endpoint's schema, doing the form's validation. Field-level rules
		// written here instead would be a second definition of a valid signature.
		validators: { onSubmit: schema },
		onSubmit: ({ value }) => {
			// Nothing to submit until the widget has vouched for the signer.
			// Saying so beats posting a request the endpoint will refuse: the
			// answer is the same, and this one arrives without a round trip.
			if (!turnstileToken) {
				setAwaitingCheck(true);
				return;
			}

			setAwaitingCheck(false);
			// Fire and forget: the outcome is rendered in place, so there is
			// nothing to await it for — and awaiting would turn a failed request
			// into a rejected `handleSubmit` nobody catches.
			mutation.reset();
			// Parsing rather than passing `value` through is what applies the
			// schema's normalisation — the trimmed lowercase e-mail that has to
			// reach the unique index, and the blank postal code that has to
			// reach the database as null.
			mutation.mutate({ ...schema.parse(value), turnstileToken });
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
			<form.Field name="signerType">
				{(controller) => (
					<fieldset>
						<legend className="block text-sm font-medium text-ink">{copy.signerType.label}</legend>
						<div className="mt-2 flex flex-wrap gap-4">
							{SIGNER_TYPES.map((type) => (
								<label
									key={type}
									htmlFor={`signerType-${type}`}
									className="flex items-center gap-2 text-sm text-quiet"
								>
									<input
										id={`signerType-${type}`}
										name={controller.name}
										type="radio"
										value={type}
										checked={controller.state.value === type}
										// Switching back is a retraction, not a hidden draft: the
										// organisation's details stop being sent the moment the
										// signer says they are signing personally.
										onChange={() => {
											controller.handleChange(type);
											if (type === "person") {
												form.setFieldValue("companyName", "");
												form.setFieldValue("signerRole", "");
											}
										}}
										className="h-4 w-4"
									/>
									{type === "person" ? copy.signerType.person : copy.signerType.organization}
								</label>
							))}
						</div>
					</fieldset>
				)}
			</form.Field>

			<form.Subscribe selector={(state) => state.values.signerType}>
				{(signerType) =>
					signerType !== "company" ? null : (
						<div className="space-y-6">
							{ORGANIZATION_FIELDS.filter(
								(field) => field.name !== "signerRole" || collectSignerRole,
							).map((field) => (
								<form.Field key={field.name} name={field.name}>
									{(controller) => (
										<TextField
											name={field.name}
											label={copy.fields[field.name]}
											autoComplete={field.autoComplete}
											value={controller.state.value ?? ""}
											error={firstMessage(controller.state.meta.errors)}
											onBlur={controller.handleBlur}
											onChange={controller.handleChange}
										/>
									)}
								</form.Field>
							))}
						</div>
					)
				}
			</form.Subscribe>

			{FIELDS.map((field) => (
				<form.Field key={field.name} name={field.name}>
					{(controller) => (
						<TextField
							name={field.name}
							label={copy.fields[field.name]}
							autoComplete={field.autoComplete}
							type={field.name === "email" ? "email" : "text"}
							value={controller.state.value ?? ""}
							error={firstMessage(controller.state.meta.errors)}
							onBlur={controller.handleBlur}
							onChange={controller.handleChange}
						/>
					)}
				</form.Field>
			))}

			<div className="space-y-4">
				{/* The documents are Polish in every language, so the consents are
				    too. An English reader is told that rather than left to wonder. */}
				{language === "pl" ? null : (
					<p className="rounded-lg border border-divider bg-ground p-3 text-sm leading-relaxed text-quiet">
						{legal.polishOnlyNotice}
					</p>
				)}

				{/* Subscribed rather than read off `form.state`: the public-list
				    consent has a second approved wording for organisations, and a
				    field only re-renders for its own value. */}
				<form.Subscribe selector={(state) => state.values.signerType ?? "person"}>
					{(signerType) =>
						CONSENTS.map((consent) => (
							<form.Field key={consent.name} name={consent.name}>
								{(controller) => {
									const error = firstMessage(controller.state.meta.errors);
									const wording = getLegalText(consent.text(signerType));
									return (
										<div>
											<div className="flex items-start gap-3">
												<input
													id={consent.name}
													name={controller.name}
													type="checkbox"
													checked={controller.state.value === true}
													// The wording carries links, so it cannot be a `<label>`:
													// clicking one inside a label would follow the link and
													// toggle the box at the same time. Naming the box from
													// the text keeps both behaviours intact.
													aria-labelledby={`${consent.name}-text`}
													aria-invalid={error ? true : undefined}
													aria-describedby={error ? `${consent.name}-error` : undefined}
													onBlur={controller.handleBlur}
													onChange={(event) => controller.handleChange(event.target.checked)}
													className="mt-1 h-4 w-4 shrink-0"
												/>
												<span
													id={`${consent.name}-text`}
													lang="pl"
													className="text-sm leading-relaxed text-quiet"
												>
													<LegalSentence markdown={wording} language={language} />
												</span>
											</div>
											{error ? (
												<p
													id={`${consent.name}-error`}
													role="alert"
													className="mt-2 text-sm text-negative"
												>
													{error}
												</p>
											) : null}
										</div>
									);
								}}
							</form.Field>
						))
					}
				</form.Subscribe>
			</div>

			<div>
				<TurnstileWidget
					language={language}
					onToken={(token) => {
						setTurnstileToken(token);
						if (token) setAwaitingCheck(false);
					}}
				/>
				{awaitingCheck ? (
					<p id="turnstile-error" role="alert" className="mt-2 text-sm text-negative">
						{copy.errors.turnstile}
					</p>
				) : null}
			</div>

			{mutation.data === "duplicate" ? (
				<output className="block rounded-lg border border-divider bg-ground p-4 text-sm text-quiet">
					{copy.duplicate}
				</output>
			) : null}

			{mutation.data === "bot-check" ? (
				<output className="block rounded-lg border border-divider bg-ground p-4 text-sm text-quiet">
					{copy.botCheckFailed}
				</output>
			) : null}

			{mutation.data === "rate-limited" ? (
				<output className="block rounded-lg border border-divider bg-ground p-4 text-sm text-quiet">
					{copy.rateLimited}
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

			{/* Below the button, and expanding in place rather than over the page:
			    a signer reading it has not left the form, and a dialog would take
			    the focus of somebody who only wanted to check who the
			    administrator is. */}
			<Collapsible>
				<CollapsibleTrigger className="text-sm text-quiet underline underline-offset-2 transition-colors hover:text-brand-dark">
					{copy.klauzulaToggle}
				</CollapsibleTrigger>
				<CollapsibleContent>
					<p
						lang="pl"
						className="mt-3 rounded-lg border border-divider bg-ground p-4 text-sm leading-relaxed text-quiet"
					>
						<LegalSentence markdown={getLegalText("inlineKlauzula")} language={language} />
					</p>
				</CollapsibleContent>
			</Collapsible>
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
async function postSignature(
	payload: SignatureInput & { turnstileToken: string },
): Promise<Outcome> {
	const response = await fetch("/api/signatures", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (response.status === 201) return "signed";
	if (response.status === 409) return "duplicate";
	if (response.status === 403) return "bot-check";
	if (response.status === 429) return "rate-limited";
	throw new Error(`Sign request failed with ${response.status}`);
}

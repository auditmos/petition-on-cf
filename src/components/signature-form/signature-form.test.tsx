import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getContent, LANGUAGES } from "@/content";
import {
	approved,
	named,
	renderedWith,
	renderSignatureForm,
	sentBody,
	stubFetch,
	stubTurnstile,
} from "./test-support";

/**
 * The form is tested the way a signer uses it: fill the labelled fields, press
 * the button, read what comes back. The only things standing in for reality are
 * `fetch` and Cloudflare's widget script, both system boundaries — the endpoint
 * behind the first has its own tests in
 * `src/hono/api/signatures.worker.test.ts`.
 *
 * Every case runs in both languages, and the labels a case types into come from
 * the content file rather than from a string written here. That is what makes
 * this a test of the form rather than a second copy of the Polish translation:
 * a label that stopped coming from the content module is not found at all.
 *
 * Consents, signer type and the information clause live in
 * `signature-form-legal.test.tsx`.
 */
beforeEach(() => {
	stubTurnstile();
});

afterEach(() => {
	vi.unstubAllGlobals();
});
describe.each(LANGUAGES)("SignatureForm in %s", (language) => {
	const copy = getContent(language).sign;

	const renderForm = () => renderSignatureForm(language);

	function type(label: string, value: string): void {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	}

	/** Everything a valid signature needs, entered through the visible controls. */
	function fillIn(overrides: { email?: string; postalCode?: string } = {}): void {
		type(copy.fields.firstName, "Anna");
		type(copy.fields.surname, "Kowalska");
		type(copy.fields.email, overrides.email ?? "anna@example.com");
		type(copy.fields.city, "Warszawa");
		if (overrides.postalCode !== undefined) type(copy.fields.postalCode, overrides.postalCode);
		fireEvent.click(mandatoryConsent());
	}

	/** The one box that has to be ticked, found by the wording it carries. */
	function mandatoryConsent(): HTMLElement {
		return screen.getByRole("checkbox", { name: named(approved("consentRodoAcknowledgment")) });
	}

	function submit(): void {
		fireEvent.click(screen.getByRole("button", { name: copy.submit }));
	}

	it("sends what the signer typed and confirms the signature", async () => {
		const fetchStub = stubFetch({ status: 201, body: { data: { status: "created" } } });
		renderForm();

		fillIn({ postalCode: "00-950" });
		submit();

		await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
		expect(sentBody(fetchStub)).toEqual({
			firstName: "Anna",
			surname: "Kowalska",
			email: "anna@example.com",
			city: "Warszawa",
			postalCode: "00-950",
			consentRodo: true,
			consentPublicList: false,
			consentUpdates: false,
			signerType: "person",
			companyName: null,
			signerRole: null,
			turnstileToken: "a-token-the-widget-produced",
		});

		expect((await screen.findByRole("status")).textContent).toContain(copy.success.heading);
	});

	it("tells a returning signer they already signed rather than showing a failure", async () => {
		stubFetch({ status: 409, body: { error: "already signed", code: "CONFLICT" } });
		renderForm();

		fillIn();
		submit();

		expect((await screen.findByRole("status")).textContent).toContain(copy.duplicate);
		// Still on the form: nothing was stored, so there is nothing to thank for.
		expect(screen.getByRole("button", { name: copy.submit })).toBeTruthy();
	});

	it("reports a server failure without claiming the signature was stored", async () => {
		stubFetch({ status: 500, body: { error: "boom" } });
		renderForm();

		fillIn();
		submit();

		expect((await screen.findByRole("status")).textContent).toContain(copy.failure);
	});

	it("names every field the signer left empty, in this language", async () => {
		const fetchStub = stubFetch();
		renderForm();

		submit();

		const messages = (await screen.findAllByRole("alert")).map((node) => node.textContent);
		expect(messages).toEqual(
			expect.arrayContaining([
				copy.errors.firstName,
				copy.errors.surname,
				copy.errors.email,
				copy.errors.city,
				copy.errors.consentRodo,
			]),
		);
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it("refuses to submit until the mandatory consent is ticked", async () => {
		const fetchStub = stubFetch();
		renderForm();

		fillIn();
		fireEvent.click(mandatoryConsent());
		submit();

		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toBe(copy.errors.consentRodo),
		);
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it("rejects a postal code that is not one, and keeps the rest of the form", async () => {
		const fetchStub = stubFetch();
		renderForm();

		fillIn({ postalCode: "12345" });
		submit();

		await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(copy.errors.postalCode));
		expect(fetchStub).not.toHaveBeenCalled();
		expect((screen.getByLabelText(copy.fields.surname) as HTMLInputElement).value).toBe("Kowalska");
	});

	it("sends no postal code when the signer leaves it blank", async () => {
		const fetchStub = stubFetch();
		renderForm();

		fillIn();
		submit();

		await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
		expect(sentBody(fetchStub)).toEqual(expect.objectContaining({ postalCode: null }));
	});

	/**
	 * The bot check, from the form's side. What it owes the signer is a
	 * distinguishable sentence for each way it can go wrong — "we could not
	 * confirm you are a person" and "you have submitted too often" are
	 * different problems with different fixes, and neither is "try again".
	 */
	it("holds the submission back until the widget has produced a token", async () => {
		const fetchStub = stubFetch();
		stubTurnstile(null);
		renderForm();

		fillIn();
		submit();

		await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(copy.errors.turnstile));
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it("says the bot check failed when the server refuses the token", async () => {
		stubFetch({ status: 403, body: { error: "no", code: "FORBIDDEN" } });
		renderForm();

		fillIn();
		submit();

		expect((await screen.findByRole("status")).textContent).toContain(copy.botCheckFailed);
	});

	// The widget draws its own UI, so if it is not told the page language it
	// picks the browser's — which is how an English page ends up with a Polish
	// bot check. Cloudflare takes the language as a render option; the page
	// already knows it, so the only way to get this wrong is not to pass it.
	it("renders the bot check in the language of the page", () => {
		const api = stubTurnstile();

		renderForm();

		expect(renderedWith(api).language).toBe(language);
	});

	it("says to wait when the server rate-limits the address", async () => {
		stubFetch({ status: 429, body: { error: "slow down", code: "RATE_LIMITED" } });
		renderForm();

		fillIn();
		submit();

		expect((await screen.findByRole("status")).textContent).toContain(copy.rateLimited);
	});
});

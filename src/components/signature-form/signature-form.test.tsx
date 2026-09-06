import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getContent, LANGUAGES } from "@/content";
import { SignatureForm } from "./signature-form";

/**
 * The form is tested the way a signer uses it: fill the labelled fields, press
 * the button, read what comes back. The only thing standing in for reality is
 * `fetch`, which is a system boundary — the endpoint behind it has its own
 * tests in `src/hono/api/signatures.worker.test.ts`.
 *
 * Every case runs in both languages, and the labels a case types into come from
 * the content file rather than from a string written here. That is what makes
 * this a test of the form rather than a second copy of the Polish translation:
 * a label that stopped coming from the content module is not found at all.
 */
type Reply = { status: number; body: unknown };

function stubFetch(...replies: Reply[]) {
	const queue = [...replies];
	const stub = vi.fn(async () => {
		const reply = queue.shift() ?? { status: 201, body: { data: { status: "created" } } };
		return new Response(JSON.stringify(reply.body), {
			status: reply.status,
			headers: { "content-type": "application/json" },
		});
	});
	vi.stubGlobal("fetch", stub);
	return stub;
}

function sentBody(stub: ReturnType<typeof stubFetch>): unknown {
	const [, init] = stub.mock.calls[0] as unknown as [string, RequestInit];
	return JSON.parse(String(init.body));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe.each(LANGUAGES)("SignatureForm in %s", (language) => {
	const copy = getContent(language).sign;

	/**
	 * A fresh client per test, with retries off so a failure is observed once
	 * rather than after a backoff the test would have to wait out.
	 */
	function renderForm(): void {
		const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
		render(
			<QueryClientProvider client={queryClient}>
				<SignatureForm copy={copy} />
			</QueryClientProvider>,
		);
	}

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
		fireEvent.click(screen.getByLabelText(copy.consentRodo));
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
		fireEvent.click(screen.getByLabelText(copy.consentRodo));
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
});

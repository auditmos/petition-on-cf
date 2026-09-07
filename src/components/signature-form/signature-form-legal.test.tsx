import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getContent, type Language } from "@/content";
import { SITE_CONFIG } from "@/content/site-config";
import {
	approved,
	named,
	renderSignatureForm,
	sentBody,
	stubFetch,
	stubTurnstile,
} from "./test-support";

/**
 * The legal half of the form: who is signing, what they are agreeing to, and
 * the clause explaining it.
 *
 * The wording is asserted against the fixtures in `src/content/legal/`, never
 * against a sentence written here — it is an approved legal text, and a test
 * that restated it would pass while the form showed something else. The plain
 * sign path lives in `signature-form.test.tsx`.
 */
beforeEach(() => {
	stubTurnstile();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("SignatureForm consents", () => {
	const renderForm = (language: Language = "pl") => renderSignatureForm(language);

	it("shows the three approved consents, a private person signing", () => {
		renderForm();

		expect(screen.getAllByRole("checkbox")).toHaveLength(3);
		for (const consent of [
			"consentRodoAcknowledgment",
			"consentPublicListPerson",
			"consentUpdates",
		] as const) {
			expect(screen.getByRole("checkbox", { name: named(approved(consent)) })).toBeDefined();
		}
	});

	it("shows the same Polish wording to an English reader, and says why", () => {
		renderForm("en");

		expect(
			screen.getByRole("checkbox", { name: named(approved("consentRodoAcknowledgment")) }),
		).toBeDefined();
		expect(screen.getByText(getContent("en").legal.polishOnlyNotice)).toBeDefined();
	});
});

describe("SignatureForm signer type", () => {
	const copy = getContent("pl").sign;

	function fillPersonalFields(): void {
		for (const [label, value] of [
			[copy.fields.firstName, "Anna"],
			[copy.fields.surname, "Kowalska"],
			[copy.fields.email, "anna@example.com"],
			[copy.fields.city, "Warszawa"],
		] as const) {
			fireEvent.change(screen.getByLabelText(label), { target: { value } });
		}
		fireEvent.click(
			screen.getByRole("checkbox", { name: named(approved("consentRodoAcknowledgment")) }),
		);
	}

	function chooseOrganization(): void {
		fireEvent.click(screen.getByRole("radio", { name: copy.signerType.organization }));
	}

	it("signs as a private person unless the signer says otherwise", () => {
		renderSignatureForm("pl");

		expect(screen.getByRole("radio", { name: copy.signerType.person })).toHaveProperty(
			"checked",
			true,
		);
		expect(screen.queryByLabelText(copy.fields.companyName)).toBeNull();
	});

	it("asks for the name once the signer says they represent an organisation", () => {
		renderSignatureForm("pl");
		chooseOrganization();

		expect(screen.getByLabelText(copy.fields.companyName)).toBeDefined();
	});

	it("refuses an organisation that gave no name, and says which field", async () => {
		const fetchStub = stubFetch();
		renderSignatureForm("pl");
		chooseOrganization();
		fillPersonalFields();
		fireEvent.click(screen.getByRole("button", { name: copy.submit }));

		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toBe(copy.errors.companyName),
		);
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it("rewrites the public-list consent for an organisation", () => {
		renderSignatureForm("pl");

		expect(screen.getByText(approved("consentPublicListPerson"))).toBeDefined();

		chooseOrganization();

		expect(screen.getByText(approved("consentPublicListOrganization"))).toBeDefined();
		expect(screen.queryByText(approved("consentPublicListPerson"))).toBeNull();
	});

	it("sends the type, the name and the role the signer gave", async () => {
		const fetchStub = stubFetch();
		renderSignatureForm("pl");
		chooseOrganization();
		fillPersonalFields();
		fireEvent.change(screen.getByLabelText(copy.fields.companyName), {
			target: { value: "Fundacja Przykład" },
		});
		fireEvent.change(screen.getByLabelText(copy.fields.signerRole), {
			target: { value: "prezeska" },
		});
		fireEvent.click(screen.getByRole("button", { name: copy.submit }));

		await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
		expect(sentBody(fetchStub)).toMatchObject({
			signerType: "company",
			companyName: "Fundacja Przykład",
			signerRole: "prezeska",
		});
	});

	it("never requires the role: an organisation signs without one", async () => {
		const fetchStub = stubFetch();
		renderSignatureForm("pl");
		chooseOrganization();
		fillPersonalFields();
		fireEvent.change(screen.getByLabelText(copy.fields.companyName), {
			target: { value: "Fundacja Przykład" },
		});
		fireEvent.click(screen.getByRole("button", { name: copy.submit }));

		await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
		expect(sentBody(fetchStub)).toMatchObject({ signerRole: null });
	});

	it("forgets the organisation's details when the signer goes back to signing personally", async () => {
		const fetchStub = stubFetch();
		renderSignatureForm("pl");
		chooseOrganization();
		fireEvent.change(screen.getByLabelText(copy.fields.companyName), {
			target: { value: "Fundacja Przykład" },
		});
		fireEvent.click(screen.getByRole("radio", { name: copy.signerType.person }));
		fillPersonalFields();
		fireEvent.click(screen.getByRole("button", { name: copy.submit }));

		await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
		expect(sentBody(fetchStub)).toMatchObject({
			signerType: "person",
			companyName: null,
			signerRole: null,
		});
	});
});

describe("SignatureForm information clause", () => {
	const copy = getContent("pl").sign;

	/** Everything the signer can read on the page, links and all. */
	const onScreen = () => document.body.textContent ?? "";

	it("keeps the clause out of the way until the signer asks for it", () => {
		renderSignatureForm("pl");

		expect(onScreen()).not.toContain(approved("inlineKlauzula"));
	});

	it("opens the clause in place, with the administrator named and nothing to fill in", () => {
		renderSignatureForm("pl");

		fireEvent.click(screen.getByRole("button", { name: copy.klauzulaToggle }));

		expect(onScreen()).toContain(approved("inlineKlauzula"));
		expect(onScreen()).toContain(SITE_CONFIG.organizerName);
		expect(onScreen()).toContain(SITE_CONFIG.contactEmail);
		expect(onScreen()).not.toContain("{{");
	});
});

/**
 * Asking a non-personal signer for their role is the deployment's choice, and
 * the default follows the noun it picked — worth asking when an association
 * endorses, noise when a company signs under its own name. The setting is
 * passed in rather than read from the config here, which is what lets both
 * settings be exercised without standing in for a module this code owns.
 */
describe("SignatureForm role field, where the deployment does not collect it", () => {
	const copy = getContent("pl").sign;

	function renderWithoutRole(): void {
		renderSignatureForm("pl", { collectSignerRole: false });
		fireEvent.click(screen.getByRole("radio", { name: copy.signerType.organization }));
	}

	it("asks for the name but not for the role", () => {
		renderWithoutRole();

		expect(screen.getByLabelText(copy.fields.companyName)).toBeDefined();
		expect(screen.queryByLabelText(copy.fields.signerRole)).toBeNull();
	});

	it("still lets the organisation sign, storing no role at all", async () => {
		const fetchStub = stubFetch();
		renderWithoutRole();

		for (const [label, value] of [
			[copy.fields.firstName, "Anna"],
			[copy.fields.surname, "Kowalska"],
			[copy.fields.email, "anna@example.com"],
			[copy.fields.city, "Warszawa"],
			[copy.fields.companyName, "Fundacja Przykład"],
		] as const) {
			fireEvent.change(screen.getByLabelText(label), { target: { value } });
		}
		fireEvent.click(
			screen.getByRole("checkbox", { name: named(approved("consentRodoAcknowledgment")) }),
		);
		fireEvent.click(screen.getByRole("button", { name: copy.submit }));

		await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
		expect(sentBody(fetchStub)).toMatchObject({ signerType: "company", signerRole: null });
	});
});

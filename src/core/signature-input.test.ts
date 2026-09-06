import { getContent } from "@/content";
import { createSignatureInputSchema } from "./signature-input";

const signatureInputSchema = createSignatureInputSchema(getContent("pl").sign.errors);

/**
 * The validation matrix, at the schema rather than over HTTP — this is where
 * the rules live, and both the form and the endpoint read them from here.
 *
 * Messages are asserted verbatim, not merely as "some string". They are shown
 * to a signer beside the field they broke, so a default English message from
 * the validation library is a defect on a Polish page, and one that only a
 * test naming the expected wording can catch.
 */
const VALID = {
	firstName: "Anna",
	surname: "Kowalska",
	email: "anna@example.com",
	city: "Warszawa",
	postalCode: "",
	consentRodo: true as boolean,
};

function messageFor(field: string, payload: Record<string, unknown>): string | undefined {
	const result = signatureInputSchema.safeParse(payload);
	if (result.success) return undefined;
	return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("signatureInputSchema", () => {
	it("accepts a signature with everything filled in", () => {
		const result = signatureInputSchema.parse({ ...VALID, postalCode: "00-950" });

		expect(result).toEqual({
			firstName: "Anna",
			surname: "Kowalska",
			email: "anna@example.com",
			city: "Warszawa",
			postalCode: "00-950",
			consentRodo: true,
		});
	});

	it("normalises the e-mail so the dedup key does not depend on how it was typed", () => {
		const result = signatureInputSchema.parse({ ...VALID, email: "  Anna@Example.COM  " });

		expect(result.email).toBe("anna@example.com");
	});

	it("trims the names and the city rather than storing the spaces", () => {
		const result = signatureInputSchema.parse({ ...VALID, firstName: " Anna ", city: " Łódź " });

		expect(result).toMatchObject({ firstName: "Anna", city: "Łódź" });
	});

	it.each([
		["", null],
		["   ", null],
		["00-950", "00-950"],
		[" 00-950 ", "00-950"],
	])("turns the postal code %j into %j", (given, stored) => {
		expect(signatureInputSchema.parse({ ...VALID, postalCode: given }).postalCode).toBe(stored);
	});

	it("stores null when the postal code is left out entirely", () => {
		const { postalCode: _omitted, ...withoutPostalCode } = VALID;

		expect(signatureInputSchema.parse(withoutPostalCode).postalCode).toBeNull();
	});
});

describe("signatureInputSchema messages", () => {
	it.each([
		["firstName", { ...VALID, firstName: "  " }, "Podaj imię."],
		["surname", { ...VALID, surname: "" }, "Podaj nazwisko."],
		["email", { ...VALID, email: "anna(at)example.com" }, "Podaj poprawny adres e-mail."],
		["city", { ...VALID, city: "" }, "Podaj miejscowość."],
		["postalCode", { ...VALID, postalCode: "12345" }, "Kod pocztowy ma format 00-000."],
		["consentRodo", { ...VALID, consentRodo: false }, "Bez tej zgody nie możemy zapisać podpisu."],
	])("explains a broken %s in Polish", (field, payload, message) => {
		expect(messageFor(field, payload)).toBe(message);
	});

	it("has a message of its own for every field it can reject", () => {
		const everythingWrong = {
			firstName: "",
			surname: "",
			email: "nope",
			city: "",
			postalCode: "junk",
			consentRodo: false,
		};
		const result = signatureInputSchema.safeParse(everythingWrong);

		expect(result.success).toBe(false);
		if (result.success) return;

		// Polish sentences, so each ends in a full stop and none is the library's
		// own English default — those start with "Invalid" or "Too small".
		for (const issue of result.error.issues) {
			expect(issue.message).toMatch(/\.$/);
			expect(issue.message).not.toMatch(/^(Invalid|Too small|Too big|Expected)/);
		}
	});
});

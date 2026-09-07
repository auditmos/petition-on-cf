import { resetDatabase } from "@/db/test-support";
import { sign, storedRows, stubSiteverify, VALID } from "./signature-test-support";

/**
 * What the endpoint records about who signed and what they agreed to.
 *
 * The plain sign path, the trust pipeline and the counter live in
 * `signatures.worker.test.ts`; this is the half the legal layer added.
 * Everything is the real thing except Turnstile, which is a system boundary.
 */
beforeEach(resetDatabase);
beforeEach(() => stubSiteverify(true));

afterEach(() => {
	vi.unstubAllGlobals();
});
/**
 * Who signed, and on whose behalf.
 *
 * A signature is either a private person's or an entity's. The word a
 * deployment shows for the second is presentation and lives in the content
 * files; what reaches D1 is the type, the entity's name and — when the
 * deployment asks for it at all — the signer's role in it. The role is never a
 * condition of signing.
 */
describe("POST /api/signatures, signer type", () => {
	it("defaults to a private person, with no entity attached", async () => {
		await sign(VALID);

		expect(await storedRows()).toEqual([
			expect.objectContaining({ signer_type: "person", company_name: null, signer_role: null }),
		]);
	});

	it("stores the type, the entity's name and the role the signer gave", async () => {
		await sign({
			...VALID,
			signerType: "company",
			companyName: "Fundacja Przykład",
			signerRole: "prezeska",
		});

		expect(await storedRows()).toEqual([
			expect.objectContaining({
				signer_type: "company",
				company_name: "Fundacja Przykład",
				signer_role: "prezeska",
			}),
		]);
	});

	it("accepts an entity that gave no role, because the role is never required", async () => {
		const response = await sign({
			...VALID,
			signerType: "company",
			companyName: "Fundacja Przykład",
			signerRole: "",
		});

		expect(response.status).toBe(201);
		expect(await storedRows()).toEqual([expect.objectContaining({ signer_role: null })]);
	});

	it("refuses an entity that gave no name, and says which field", async () => {
		const response = await sign({ ...VALID, signerType: "company" });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual(
			expect.objectContaining({
				details: expect.arrayContaining([
					expect.objectContaining({ field: "companyName", message: expect.any(String) }),
				]),
			}),
		);
		expect(await storedRows()).toEqual([]);
	});

	it("refuses a type it has never heard of rather than storing it", async () => {
		const response = await sign({ ...VALID, signerType: "fundacja" });

		expect(response.status).toBe(400);
		expect(await storedRows()).toEqual([]);
	});
});

/**
 * The two optional consents are stored exactly as given: the public list (#10)
 * reads one of them, and the organizer's export reads the other. Neither is a
 * condition of signing, and neither has a "did not say" state — the columns are
 * `NOT NULL DEFAULT 0`.
 */
describe("POST /api/signatures, optional consents", () => {
	it("stores both as false when the signer ticked neither", async () => {
		await sign(VALID);

		expect(await storedRows()).toEqual([
			expect.objectContaining({ consent_public_list: 0, consent_updates: 0 }),
		]);
	});

	it("stores each one the signer ticked", async () => {
		await sign({ ...VALID, consentPublicList: true, consentUpdates: true });

		expect(await storedRows()).toEqual([
			expect.objectContaining({ consent_public_list: 1, consent_updates: 1 }),
		]);
	});

	it("keeps them apart rather than storing one answer twice", async () => {
		await sign({ ...VALID, consentPublicList: true });

		expect(await storedRows()).toEqual([
			expect.objectContaining({ consent_public_list: 1, consent_updates: 0 }),
		]);
	});
});

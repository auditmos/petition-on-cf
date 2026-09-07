import { render, screen } from "@testing-library/react";
import { MechanismSection } from "@/components/landing/mechanism-section";
import { type Content, getContent, LANGUAGES } from "@/content";

/**
 * What the petition actually asks for.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is one language's `mechanism` copy: an introduction and an
 *   ordered list of demands.
 * - **Output**: every demand renders, in the order the content file lists
 *   them, as an ordered list rather than as prose. A reader deciding whether
 *   to sign is deciding about these specific asks, so they have to be countable
 *   and separable — "the second thing they want" has to be a thing on a page.
 * - **The array is the interface**: a campaign with five demands edits a
 *   content file, and the extended fixture below proves it.
 * - **Not covered here**: where the section sits, which `landing-page.test.tsx`
 *   asserts.
 */

const EXTRA: Content["mechanism"]["demands"][number] = {
	title: "Dodatkowy postulat",
	description: "Dopisany w teście, żeby udowodnić, że listę robi treść, a nie komponent.",
};

describe.each(LANGUAGES)("MechanismSection in %s", (language) => {
	const copy = getContent(language).mechanism;

	it("introduces what the petition demands", () => {
		render(<MechanismSection copy={copy} />);

		expect(screen.getByRole("heading", { name: copy.heading })).toBeDefined();
		expect(screen.getByText(copy.lede)).toBeDefined();
		expect(screen.getByText(copy.note)).toBeDefined();
	});

	/**
	 * Who is being asked. A reader deciding whether to sign is deciding whether
	 * this is the right body to press, and the demands below only make sense
	 * once they know who is expected to act on them. The name is the site
	 * config's — `init-project` asks for it — so the label and the name are two
	 * content keys rather than one sentence.
	 */
	it("names the addressee above the demands", () => {
		render(<MechanismSection copy={copy} />);

		expect(screen.getByText(copy.addresseeLabel)).toBeDefined();
		expect(screen.getByText(copy.addressee)).toBeDefined();
	});

	it("lists every demand the content file states", () => {
		render(<MechanismSection copy={copy} />);

		for (const demand of copy.demands) {
			expect(screen.getByText(demand.title)).toBeDefined();
			expect(screen.getByText(demand.description)).toBeDefined();
		}
	});

	// Countable and in order: a reader referring to "the second demand" has to
	// be referring to the same one the campaign meant.
	it("numbers the demands in the order the content file lists them", () => {
		render(<MechanismSection copy={copy} />);

		const listed = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");

		expect(listed).toHaveLength(copy.demands.length);
		for (const [index, demand] of copy.demands.entries()) {
			expect(listed[index]).toContain(demand.title);
		}
	});
});

describe("MechanismSection, driven by the content array", () => {
	it("renders a demand that was added to the array alone", () => {
		const copy = getContent("pl").mechanism;

		render(<MechanismSection copy={{ ...copy, demands: [...copy.demands, EXTRA] }} />);

		expect(screen.getByText(EXTRA.title)).toBeDefined();
		expect(screen.getAllByRole("listitem")).toHaveLength(copy.demands.length + 1);
	});
});

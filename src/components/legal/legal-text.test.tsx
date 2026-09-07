import { render, screen } from "@testing-library/react";
import { LegalText } from "./legal-text";

/**
 * The Markdown dialect the legal fixtures are written in.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is a fixture's Markdown, already interpolated. This component
 *   never sees a token and never resolves one.
 * - **Output** is React elements. No HTML string is produced anywhere, so
 *   there is nothing for a document to inject through.
 * - **The dialect is what the fixtures use**, not CommonMark: anything outside
 *   it renders as the literal characters it is.
 */
describe("LegalText", () => {
	it("turns a Markdown link into a link the reader can follow", () => {
		render(
			<LegalText
				markdown="Szczegóły w [Polityce prywatności](/polityka-prywatnosci)."
				language="pl"
			/>,
		);

		const link = screen.getByRole("link", { name: "Polityce prywatności" });

		expect(link.getAttribute("href")).toBe("/polityka-prywatnosci");
		expect(screen.getByText(/Szczegóły w/).textContent).toBe("Szczegóły w Polityce prywatności.");
	});
});

describe("LegalText links, in the reader's language", () => {
	it("sends an English reader to the English copy of a page on this site", () => {
		render(<LegalText markdown="[Polityka prywatności](/polityka-prywatnosci)" language="en" />);

		expect(screen.getByRole("link").getAttribute("href")).toBe("/en/polityka-prywatnosci");
	});

	it("leaves a link that does not point at a page of this site alone", () => {
		render(<LegalText markdown="[napisz](mailto:kontakt@example.org)" language="en" />);

		expect(screen.getByRole("link").getAttribute("href")).toBe("mailto:kontakt@example.org");
	});
});

describe("LegalText lists", () => {
	it("renders a run of dashed lines as a list, one item per line", () => {
		render(
			<LegalText
				markdown={"Zapisujemy wówczas:\n\n- imię i nazwisko,\n- adres e-mail,\n- miejscowość."}
				language="pl"
			/>,
		);

		const items = screen.getAllByRole("listitem");

		expect(items.map((item) => item.textContent)).toEqual([
			"imię i nazwisko,",
			"adres e-mail,",
			"miejscowość.",
		]);
		expect(screen.getAllByRole("list")).toHaveLength(1);
	});

	it("keeps a link inside an item a link", () => {
		render(<LegalText markdown="- zobacz [klauzulę](/klauzula)" language="pl" />);

		expect(screen.getByRole("listitem").querySelector("a")?.getAttribute("href")).toBe("/klauzula");
	});
});

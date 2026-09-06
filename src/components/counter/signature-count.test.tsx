import { render, screen } from "@testing-library/react";
import { SignatureCount } from "./signature-count";

describe("SignatureCount", () => {
	// Polish has three plural forms and picks between them by the last two
	// digits, so "5 podpisów" and "22 podpisy" are both regular. Getting this
	// wrong is not a typo a reader forgives on a page asking for their name.
	it.each([
		[0, "podpisów"],
		[1, "podpis"],
		[2, "podpisy"],
		[3, "podpisy"],
		[5, "podpisów"],
		[11, "podpisów"],
		[22, "podpisy"],
		[25, "podpisów"],
	])("labels %i as %s", (count, noun) => {
		render(<SignatureCount count={count} />);

		expect(screen.getByTestId("signature-count-noun").textContent).toBe(noun);
	});

	// Polish groups from five digits up — CLDR gives it `minimumGroupingDigits`
	// of 2 — and separates with a no-break space. Both are written as escapes
	// so neither survives here as an invisible character somebody "corrects".
	it.each([
		[1234, "1234"],
		[12345, "12\u00a0345"],
	])("formats %i as %s", (count, figure) => {
		render(<SignatureCount count={count} />);

		expect(screen.getByTestId("signature-count-figure").textContent).toBe(figure);
	});

	// The count is the page's one live number. Announcing it only on page load
	// is the same bug as a counter that never updates — issue #7 makes it move,
	// and it has to be readable when it does.
	it("announces itself politely so an update is read out", () => {
		render(<SignatureCount count={7} />);

		expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
	});
});

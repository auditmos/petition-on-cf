import { render, screen } from "@testing-library/react";
import { getContent } from "@/content";
import { SignatureCount } from "./signature-count";

const PL = getContent("pl").counter.nouns;
const EN = getContent("en").counter.nouns;

describe("SignatureCount", () => {
	// Polish has three plural forms and picks between them by the last two
	// digits, so "5 podpisów" and "22 podpisy" are both regular. Getting this
	// wrong is not a typo a reader forgives on a page asking for their name.
	it.each([
		[0, PL.many],
		[1, PL.one],
		[2, PL.few],
		[3, PL.few],
		[5, PL.many],
		[11, PL.many],
		[22, PL.few],
		[25, PL.many],
	])("labels %i as %s in Polish", (count, noun) => {
		render(<SignatureCount count={count} language="pl" nouns={PL} />);

		expect(screen.getByTestId("signature-count-noun").textContent).toBe(noun);
	});

	// English picks between two, and the component must not assume Polish's
	// three — the shape is the same, the rule behind it is not.
	it.each([
		[0, EN.other],
		[1, EN.one],
		[2, EN.other],
		[22, EN.other],
	])("labels %i as %s in English", (count, noun) => {
		render(<SignatureCount count={count} language="en" nouns={EN} />);

		expect(screen.getByTestId("signature-count-noun").textContent).toBe(noun);
	});

	// Polish groups from five digits up — CLDR gives it `minimumGroupingDigits`
	// of 2 — and separates with a no-break space. English groups from four with
	// a comma. Both are written as escapes so neither survives here as an
	// invisible character somebody "corrects".
	it.each([
		["pl" as const, 1234, "1234"],
		["pl" as const, 12345, "12 345"],
		["en" as const, 1234, "1,234"],
		["en" as const, 12345, "12,345"],
	])("formats %s %i as %s", (language, count, figure) => {
		render(
			<SignatureCount count={count} language={language} nouns={language === "pl" ? PL : EN} />,
		);

		expect(screen.getByTestId("signature-count-figure").textContent).toBe(figure);
	});

	// The count is the page's one live number. Announcing it only on page load
	// is the same bug as a counter that never updates — issue #7 makes it move,
	// and it has to be readable when it does.
	it("announces itself politely so an update is read out", () => {
		render(<SignatureCount count={7} language="pl" nouns={PL} />);

		expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
	});
});

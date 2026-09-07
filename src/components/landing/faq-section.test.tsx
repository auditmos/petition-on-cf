import { fireEvent, render, screen } from "@testing-library/react";
import { FaqSection } from "@/components/landing/faq-section";
import { type Content, getContent, LANGUAGES } from "@/content";

/**
 * The doubts a visitor has before signing.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is one language's `faq` copy: an array of question-and-answer
 *   pairs.
 * - **Output**: every question is a control that reveals its own answer, and
 *   the answers start hidden — a wall of open text is what the accordion
 *   exists to avoid.
 * - **Each entry is independent.** Opening the third does not close the first:
 *   a reader comparing two answers should not have to keep re-opening one of
 *   them.
 * - **Keyboard operation is asserted through the semantics that provide it** —
 *   a real `button` carrying `aria-expanded`. jsdom does not synthesise a
 *   click from a key press the way a browser does, so pressing Enter here
 *   would prove nothing about a browser; the browser pass covers that, and
 *   what this file pins is the contract a browser needs in order to get it
 *   right.
 * - **Not covered here**: where the section sits, which `landing-page.test.tsx`
 *   asserts.
 */

const EXTRA: Content["faq"]["items"][number] = {
	question: "Pytanie dopisane w teście?",
	answer: "Odpowiedź, której nie ma w żadnym pliku treści.",
};

const asked = (question: string) => screen.getByRole("button", { name: question });

describe.each(LANGUAGES)("FaqSection in %s", (language) => {
	const copy = getContent(language).faq;

	it("asks every question the content file lists", () => {
		render(<FaqSection copy={copy} />);

		for (const item of copy.items) {
			expect(asked(item.question)).toBeDefined();
		}
	});

	it("keeps every answer folded away until it is asked for", () => {
		render(<FaqSection copy={copy} />);

		for (const item of copy.items) {
			expect(asked(item.question).getAttribute("aria-expanded")).toBe("false");
			expect(screen.queryByText(item.answer)).toBeNull();
		}
	});

	it("reveals an answer when its question is chosen", () => {
		const [first] = copy.items;
		if (!first) throw new Error("the content file lists no questions");
		render(<FaqSection copy={copy} />);

		fireEvent.click(asked(first.question));

		expect(screen.getByText(first.answer)).toBeDefined();
		expect(asked(first.question).getAttribute("aria-expanded")).toBe("true");
	});

	it("folds an answer away again when its question is chosen twice", () => {
		const [first] = copy.items;
		if (!first) throw new Error("the content file lists no questions");
		render(<FaqSection copy={copy} />);

		fireEvent.click(asked(first.question));
		fireEvent.click(asked(first.question));

		expect(screen.queryByText(first.answer)).toBeNull();
		expect(asked(first.question).getAttribute("aria-expanded")).toBe("false");
	});
});

describe("FaqSection, one answer at a time is the reader's choice", () => {
	const copy = getContent("pl").faq;

	it("leaves an open answer open when another is opened", () => {
		const [first, second] = copy.items;
		if (!first || !second) throw new Error("the content file lists fewer than two questions");
		render(<FaqSection copy={copy} />);

		fireEvent.click(asked(first.question));
		fireEvent.click(asked(second.question));

		expect(screen.getByText(first.answer)).toBeDefined();
		expect(screen.getByText(second.answer)).toBeDefined();
	});
});

describe("FaqSection, keyboard and assistive technology", () => {
	const copy = getContent("pl").faq;

	// What makes an accordion operable by keyboard is that the thing being
	// pressed is a button: the browser then supplies focus, Enter and Space.
	// A div with a click handler renders identically and none of that follows.
	it("makes every question a real button in the tab order", () => {
		render(<FaqSection copy={copy} />);

		for (const item of copy.items) {
			const control = asked(item.question);
			expect(control.tagName).toBe("BUTTON");
			expect(control.getAttribute("tabindex")).not.toBe("-1");
			control.focus();
			expect(document.activeElement).toBe(control);
		}
	});
});

describe("FaqSection, driven by the content array", () => {
	it("renders a question that was added to the array alone", () => {
		const copy = getContent("pl").faq;

		render(<FaqSection copy={{ ...copy, items: [...copy.items, EXTRA] }} />);

		fireEvent.click(asked(EXTRA.question));

		expect(screen.getByText(EXTRA.answer)).toBeDefined();
	});
});

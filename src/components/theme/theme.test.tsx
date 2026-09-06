import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, ThemeToggle } from "@/components/theme";
import { getContent } from "@/content";

/**
 * The theme module's boundary is these two exports: a provider that owns the
 * choice and a control that changes it. What a user does with them is open the
 * menu and pick a theme — so that is what this drives, rather than reaching for
 * the context or the storage key directly.
 *
 * The labels come from the content module, in Polish, because that is what a
 * reader of the default language sees. Naming them here as literals would be a
 * second copy of the translation and would pass even if the control stopped
 * reading the content files at all.
 */
const COPY = getContent("pl").theme;

function renderToggle() {
	return render(
		<ThemeProvider defaultTheme="light">
			<ThemeToggle copy={COPY} />
		</ThemeProvider>,
	);
}

/** Opens the menu the way a keyboard user does. */
function openMenu() {
	fireEvent.keyDown(screen.getByRole("button", { name: COPY.label }), { key: "Enter" });
}

describe("theme controls", () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.classList.remove("light", "dark");
	});

	it("offers a choice for every theme", () => {
		renderToggle();
		openMenu();

		expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
			expect.stringContaining(COPY.options.light.label),
			expect.stringContaining(COPY.options.dark.label),
			expect.stringContaining(COPY.options.system.label),
		]);
	});

	it("darkens the document when the user picks dark", () => {
		renderToggle();
		openMenu();

		fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(COPY.options.dark.label) }));

		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
	});

	// Losing the choice on reload is the bug this component exists to avoid.
	it("remembers the choice for the next visit", () => {
		const { unmount } = renderToggle();
		openMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(COPY.options.dark.label) }));
		unmount();

		renderToggle();

		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});
});

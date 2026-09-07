import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { NavigationBar } from "@/components/navigation";
import { getContent, LANGUAGES, type Language } from "@/content";
import { toLanguagePath } from "@/content/routing";
import { SITE_CONFIG } from "@/content/site-config";

/**
 * The bar at the top, on every page of the site.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is the language, the page being shown (without its language
 *   prefix) and this language's copy. The bar reads nothing else.
 * - **Output**: each entry takes the reader to a section of the landing page,
 *   from wherever they are. On the landing page that is a scroll; on a legal
 *   document it is a navigation, and it has to be one — the sections are not
 *   there to scroll to.
 * - **Every entry is a link**, so it carries an address a reader can copy,
 *   middle-click, or follow with scripting off. The smooth scroll is what
 *   JavaScript adds on top when the target happens to be on this page.
 * - **Not covered here**: the language switcher and the theme toggle, which
 *   have their own tests.
 */
async function renderNav(language: Language, path: string, withSections = false) {
	const content = getContent(language);
	const rootRoute = createRootRoute({
		component: () => (
			<>
				<NavigationBar
					language={language}
					path={path}
					copy={content.nav}
					languageSwitch={content.languageSwitch}
					theme={content.theme}
				/>
				{withSections
					? content.nav.items.map((item) => <section key={item.sectionId} id={item.sectionId} />)
					: null}
			</>
		),
	});

	// The test's route tree is one root route, so the history stays at `/`
	// whatever page is being simulated — which page it is, is the `path` prop.
	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});

	render(<RouterProvider router={router} />);
	// The router paints after a tick, so everything below would otherwise query
	// an empty document.
	await screen.findByText(content.nav.tagline);
	return content;
}

/**
 * The bug this file was opened for: on a legal document none of the landing
 * page's sections exist, so an entry that could only scroll did nothing at
 * all. A reader who opened the RODO clause from a consent checkbox and then
 * wants the form back is precisely the reader most likely to click one.
 */
describe.each(LANGUAGES)("NavigationBar on a legal page, in %s", (language) => {
	it("sends the reader to the landing page's section", async () => {
		const content = await renderNav(language, SITE_CONFIG.privacyPolicyUrl);

		for (const item of content.nav.items) {
			const entry = screen.getAllByRole("link", { name: item.label })[0];
			expect(entry?.getAttribute("href")).toBe(
				`${toLanguagePath("/", language)}#${item.sectionId}`,
			);
		}
	});
});

describe("NavigationBar on the landing page", () => {
	it("scrolls to a section that is on this page rather than navigating", async () => {
		const content = await renderNav("pl", "/", true);
		const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
		const [first] = content.nav.items;
		if (!first) throw new Error("the navigation offers nothing");

		const entry = screen.getAllByRole("link", { name: first.label })[0] as HTMLElement;
		fireEvent.click(entry);

		expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById(first.sectionId));
	});

	// The href is what makes it a link worth having: copyable, openable in a
	// new tab, and still correct when the click handler never runs.
	it("still carries the address the section answers to", async () => {
		const content = await renderNav("pl", "/", true);
		const [first] = content.nav.items;
		if (!first) throw new Error("the navigation offers nothing");

		const entry = screen.getAllByRole("link", { name: first.label })[0];

		expect(entry?.getAttribute("href")).toBe(`/#${first.sectionId}`);
	});
});

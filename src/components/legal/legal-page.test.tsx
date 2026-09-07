import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { getContent, type Language } from "@/content";
import { LEGAL_DOCUMENT_NAMES, type LegalDocumentName } from "@/content/legal";
import { SITE_CONFIG } from "@/content/site-config";
import { LegalPage } from "./legal-page";

/**
 * A legal document, as a reader of this site meets it.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is a document name and a language. Nothing else: the page reads
 *   its own copy, the same way `LandingPage` does, so the two route files per
 *   document cannot disagree about anything.
 * - **Output** is the fixture's wording with the deployment's identity filled
 *   in. A `{{token}}` reaching the screen is a failure, not a placeholder.
 * - **The documents are Polish**, in both languages, by decision — see the PRD.
 *   What the English side adds is a notice saying so.
 */
function renderLegal(document: LegalDocumentName, language: Language) {
	const rootRoute = createRootRoute({
		component: () => <LegalPage document={document} language={language} />,
	});

	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});

	return render(<RouterProvider router={router} />);
}

describe("LegalPage", () => {
	it("renders the RODO clause under its own heading, with the identity filled in", async () => {
		renderLegal("rodoClause", "pl");

		const heading = await screen.findByRole("heading", { level: 1 });

		expect(heading.textContent).toContain(SITE_CONFIG.petitionName);
		expect(screen.getByRole("main").textContent).not.toContain("{{");
	});
});

describe("LegalPage in English", () => {
	it("says the document is binding in its Polish version", async () => {
		renderLegal("rodoClause", "en");
		await screen.findByRole("heading", { level: 1 });

		expect(screen.getByRole("main").textContent).toContain(getContent("en").legal.polishOnlyNotice);
	});

	it("says nothing of the sort to a Polish reader, who is reading the original", async () => {
		renderLegal("rodoClause", "pl");
		await screen.findByRole("heading", { level: 1 });

		expect(screen.getByRole("main").textContent).not.toContain(
			getContent("pl").legal.polishOnlyNotice,
		);
	});
});

describe.each(LEGAL_DOCUMENT_NAMES)("every legal document — %s", (name) => {
	it("renders in Polish with the deployment's identity filled in", async () => {
		renderLegal(name, "pl");
		await screen.findByRole("heading", { level: 1 });

		expect(screen.getByRole("main").textContent).not.toContain("{{");
	});

	it("renders in English too, under the notice that Polish is what binds", async () => {
		renderLegal(name, "en");
		await screen.findByRole("heading", { level: 1 });

		const main = screen.getByRole("main").textContent ?? "";

		expect(main).toContain(getContent("en").legal.polishOnlyNotice);
		expect(main).not.toContain("{{");
	});
});

describe("LegalPage chrome", () => {
	it("carries the site's navigation, so the petition is one click away", async () => {
		renderLegal("privacyPolicy", "pl");
		await screen.findByRole("heading", { level: 1 });

		const brand = screen.getByRole("link", { name: new RegExp(getContent("pl").nav.brand) });

		expect(brand.getAttribute("href")).toBe("/");
	});

	it("switches language to the same document rather than to the home page", async () => {
		renderLegal("privacyPolicy", "pl");
		await screen.findByRole("heading", { level: 1 });

		// Opened the way a keyboard user does — Radix menus do not respond to a
		// synthetic click under jsdom, which has no pointer.
		const trigger = screen.getAllByRole("button", {
			name: getContent("pl").languageSwitch.label,
		})[0] as HTMLElement;
		fireEvent.keyDown(trigger, { key: "Enter" });

		const english = await screen.findByRole("menuitem", {
			name: getContent("pl").languageSwitch.options.en,
		});

		expect(english.getAttribute("href")).toBe(`/en${SITE_CONFIG.privacyPolicyUrl}`);
	});

	it("carries the footer, so the other legal document is reachable too", async () => {
		renderLegal("privacyPolicy", "pl");
		await screen.findByRole("heading", { level: 1 });

		const clause = screen.getByRole("link", {
			name: getContent("pl").legal.documents.rodoClause.title,
		});

		expect(clause.getAttribute("href")).toBe(SITE_CONFIG.rodoClauseUrl);
	});
});

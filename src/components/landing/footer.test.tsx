import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/landing/footer";
import { getContent, LANGUAGES, type Language } from "@/content";
import { toLanguagePath } from "@/content/routing";
import { SITE_CONFIG } from "@/content/site-config";

/**
 * The footer is where a reader who did not click a consent checkbox still
 * finds the legal documents.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is this language's copy and the language itself. The footer has
 *   no other state.
 * - **Output**: the two legal documents are links into this site, in the
 *   language the reader is already in. The project documents beside them stay
 *   external links and are not this file's subject.
 * - **The paths come from the site config**, never from a literal written
 *   here — a document that moved has to move the footer with it.
 */
async function renderFooter(language: Language) {
	const content = getContent(language);
	const rootRoute = createRootRoute({
		component: () => <Footer copy={content.footer} legal={content.legal} language={language} />,
	});

	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});

	render(<RouterProvider router={router} />);
	await screen.findByText(content.footer.disclaimer);
	return content;
}

describe.each(LANGUAGES)("Footer in %s", (language) => {
	it("links to the privacy policy in this language", async () => {
		const content = await renderFooter(language);

		const link = screen.getByRole("link", {
			name: content.legal.documents.privacyPolicy.title,
		});

		expect(link.getAttribute("href")).toBe(toLanguagePath(SITE_CONFIG.privacyPolicyUrl, language));
	});

	it("links to the RODO clause in this language", async () => {
		const content = await renderFooter(language);

		const link = screen.getByRole("link", { name: content.legal.documents.rodoClause.title });

		expect(link.getAttribute("href")).toBe(toLanguagePath(SITE_CONFIG.rodoClauseUrl, language));
	});
});

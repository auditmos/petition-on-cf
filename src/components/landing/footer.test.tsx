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
import { SITE_CONFIG, type SocialLink } from "@/content/site-config";

/**
 * The footer is where a reader who did not click a consent checkbox still
 * finds the legal documents.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is this language's copy and the language itself. The footer has
 *   no other state.
 * - **Output**: the two legal documents are links into this site, in the
 *   language the reader is already in — never external, and never the wrong
 *   language for the reader who clicked them.
 * - **The paths come from the site config**, never from a literal written
 *   here — a document that moved has to move the footer with it.
 * - **Identity is the config's too.** Who is collecting the signatures and how
 *   to reach them is a legal requirement of the consent texts above it, so the
 *   footer states it rather than assuming the reader opened a clause.
 * - **Social profiles are passed in**, already filtered: the footer renders
 *   what it is given and never decides whether a URL is worth showing.
 */
/** A deployment that filled in two of its three profile fields. */
const SOCIALS: SocialLink[] = [
	{ network: "facebook", url: "https://www.facebook.com/organizator" },
	{ network: "linkedin", url: "https://www.linkedin.com/company/organizator" },
];

async function renderFooter(language: Language, socials: SocialLink[] = []) {
	const content = getContent(language);
	const rootRoute = createRootRoute({
		component: () => (
			<Footer copy={content.footer} legal={content.legal} language={language} socials={socials} />
		),
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

	it("says who is collecting the signatures and how to reach them", async () => {
		await renderFooter(language);

		expect(screen.getByText(SITE_CONFIG.organizerName)).toBeDefined();
		expect(screen.getByText(SITE_CONFIG.organizerStreet, { exact: false })).toBeDefined();
		expect(screen.getByText(SITE_CONFIG.organizerCity, { exact: false })).toBeDefined();
		expect(screen.getByRole("link", { name: SITE_CONFIG.contactEmail }).getAttribute("href")).toBe(
			`mailto:${SITE_CONFIG.contactEmail}`,
		);
	});
});

describe("Footer, the organizer's own channels", () => {
	it("links every profile the deployment configured", async () => {
		const content = await renderFooter("pl", SOCIALS);

		for (const social of SOCIALS) {
			const link = screen.getByRole("link", {
				name: content.footer.socialNetworks[social.network],
			});
			expect(link.getAttribute("href")).toBe(social.url);
			expect(link.getAttribute("rel")).toContain("noopener");
		}
	});

	it("leaves out a profile the deployment did not configure", async () => {
		const content = await renderFooter("pl", SOCIALS);

		expect(screen.queryByRole("link", { name: content.footer.socialNetworks.x })).toBeNull();
	});

	it("says nothing at all when no profile is configured", async () => {
		const content = await renderFooter("pl");

		expect(screen.queryByText(content.footer.socialHeading)).toBeNull();
	});
});

/**
 * The colophon: one link back to the software, not four.
 *
 * A deployment's footer belongs to the campaign, and the template's own
 * backlog is not something a visitor to a petition should be pointed at. What
 * survives is the honest statement of what the site was built with.
 */
describe("Footer, colophon", () => {
	it("credits the template it was built from", async () => {
		const content = await renderFooter("pl");

		const link = screen.getByRole("link", { name: content.footer.colophon });

		expect(link.getAttribute("href")).toBe(SITE_CONFIG.repositoryUrl);
	});
});

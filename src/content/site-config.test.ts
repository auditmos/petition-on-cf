import { SITE_CONFIG, socialLinks } from "./site-config";

/**
 * The deployment's identity, and the one piece of logic that reads it.
 *
 * ## Assumptions this file encodes
 *
 * - **Every social profile is optional.** A campaign with no LinkedIn page is
 *   the normal case, and a link to an empty address is a dead link in the
 *   footer of a page asking strangers for trust.
 * - **Order is the config's, not the caller's**, so the footer's icon row does
 *   not reshuffle itself when a deployment fills a field in.
 * - **What ships is empty**, because a placeholder profile URL would either
 *   404 or point at somebody else's page.
 */
describe("socialLinks", () => {
	it("lists only the profiles a deployment filled in", () => {
		const links = socialLinks({
			facebookUrl: "https://www.facebook.com/organizator",
			xUrl: "",
			linkedinUrl: "https://www.linkedin.com/company/organizator",
		});

		expect(links).toEqual([
			{ network: "facebook", url: "https://www.facebook.com/organizator" },
			{ network: "linkedin", url: "https://www.linkedin.com/company/organizator" },
		]);
	});

	it("says a deployment with no profiles has none", () => {
		expect(socialLinks({ facebookUrl: "", xUrl: "", linkedinUrl: "" })).toEqual([]);
	});

	// The template is honest about being un-personalised: an invented profile
	// URL is the one placeholder that could send a reader to a real stranger.
	it("ships with no profile configured", () => {
		expect(socialLinks(SITE_CONFIG)).toEqual([]);
	});
});

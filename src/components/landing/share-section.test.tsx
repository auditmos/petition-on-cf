import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareSection } from "@/components/landing/share-section";
import { getContent, LANGUAGES, type Language } from "@/content";
import { canonicalUrl } from "@/content/head";

/**
 * Handing the petition on.
 *
 * ## Assumptions this file encodes
 *
 * - **Input** is one language's `share` copy plus the page being shared — the
 *   path without a language prefix, and the language.
 * - **Output**: one outbound link per network, each carrying the canonical URL
 *   of the page *in the reader's own language*. A Polish reader who shares
 *   from `/` must not send their friends to `/en`.
 * - **The canonical URL is the site config's**, the same absolute URL the
 *   `<head>` declares — not `window.location`, which on a preview deployment
 *   or behind a proxy is a URL nobody else can open.
 * - **Endpoints are asserted by host and parameter**, not by string equality
 *   with the template that built them: a test that restates the format string
 *   passes for any format string. What matters is that Facebook is asked to
 *   share this URL and that the reader's own text travels where a network
 *   accepts one.
 * - **Not covered here**: whether the networks render the preview well, which
 *   is the Open Graph tags' job and `head.test.ts`'s subject.
 */

const shared = (language: Language) => canonicalUrl("/", language);

/** The `url`-bearing parameter of each network, by the name it uses. */
function parameter(href: string, name: string): string {
	return new URL(href).searchParams.get(name) ?? "";
}

function renderShare(language: Language) {
	const content = getContent(language);
	render(<ShareSection copy={content.share} language={language} path="/" />);
	return content.share;
}

describe.each(LANGUAGES)("ShareSection in %s", (language) => {
	it("asks Facebook to share this page", () => {
		const copy = renderShare(language);

		const href = screen.getByRole("link", { name: copy.networks.facebook }).getAttribute("href");

		expect(new URL(href ?? "").host).toBe("www.facebook.com");
		expect(parameter(href ?? "", "u")).toBe(shared(language));
	});

	it("asks X to post this page with the campaign's own words", () => {
		const copy = renderShare(language);

		const href = screen.getByRole("link", { name: copy.networks.x }).getAttribute("href");

		expect(new URL(href ?? "").host).toBe("x.com");
		expect(parameter(href ?? "", "url")).toBe(shared(language));
		expect(parameter(href ?? "", "text")).toBe(copy.message);
	});

	it("asks LinkedIn to share this page", () => {
		const copy = renderShare(language);

		const href = screen.getByRole("link", { name: copy.networks.linkedin }).getAttribute("href");

		expect(new URL(href ?? "").host).toBe("www.linkedin.com");
		expect(parameter(href ?? "", "url")).toBe(shared(language));
	});

	// WhatsApp carries no URL field of its own: the link has to travel inside
	// the message, which is why this one asserts both are in the same text.
	it("hands WhatsApp a message with the link in it", () => {
		const copy = renderShare(language);

		const href = screen.getByRole("link", { name: copy.networks.whatsapp }).getAttribute("href");
		const text = parameter(href ?? "", "text");

		expect(new URL(href ?? "").host).toBe("api.whatsapp.com");
		expect(text).toContain(copy.message);
		expect(text).toContain(shared(language));
	});

	it("opens every network away from the petition", () => {
		renderShare(language);

		for (const link of screen.getAllByRole("link")) {
			expect(link.getAttribute("target")).toBe("_blank");
			expect(link.getAttribute("rel")).toContain("noopener");
		}
	});
});

describe("ShareSection, copy link", () => {
	it("writes the canonical URL of the language being read", async () => {
		const copy = renderShare("en");

		fireEvent.click(screen.getByRole("button", { name: copy.copyLink }));

		await waitFor(async () => {
			expect(await navigator.clipboard.readText()).toBe(shared("en"));
		});
	});

	it("confirms the copy to the reader", async () => {
		const copy = renderShare("pl");

		fireEvent.click(screen.getByRole("button", { name: copy.copyLink }));

		expect(await screen.findByText(copy.copied)).toBeDefined();
	});

	// A clipboard a browser refuses — Safari outside a user gesture, a page
	// without permission — must leave the reader something to do rather than a
	// button that silently did nothing.
	it("says so when the browser refused the clipboard", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
		const copy = renderShare("pl");

		fireEvent.click(screen.getByRole("button", { name: copy.copyLink }));

		expect(await screen.findByText(copy.copyFailed)).toBeDefined();
	});
});

import { useEffect, useRef } from "react";
import type { Language } from "@/content";
import { SITE_CONFIG } from "@/content/site-config";

/**
 * Cloudflare's bot check, reduced to one callback.
 *
 * What the form gets is a token or a null, and what it never has to know is
 * that a remote script draws the widget, that the script has to be loaded
 * once per page and not once per mount, that a token expires after five
 * minutes, or that Turnstile's API is imperative in the middle of a
 * declarative tree. All of that is in here.
 *
 * The widget is rendered explicitly rather than by Cloudflare's automatic
 * scan for `.cf-turnstile` elements: the automatic mode races React, which
 * mounts and unmounts this container whenever the form re-renders, and a
 * widget bound to a detached node silently stops producing tokens.
 */

/** The slice of Cloudflare's global the component actually uses. */
interface TurnstileApi {
	render(
		container: HTMLElement,
		options: {
			sitekey: string;
			language: string;
			callback: (token: string) => void;
			"expired-callback": () => void;
			"error-callback": () => void;
		},
	): string | undefined;
	remove(widgetId: string): void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

/**
 * The script tag, created once and shared by every mount.
 *
 * Appending a second copy would re-run Cloudflare's bootstrap and orphan the
 * widgets the first one is managing, so this looks for the existing tag before
 * making one.
 */
function loadScript(): HTMLScriptElement {
	const existing = document.getElementById(SCRIPT_ID);
	if (existing) return existing as HTMLScriptElement;

	const script = document.createElement("script");
	script.id = SCRIPT_ID;
	script.src = SCRIPT_URL;
	script.async = true;
	script.defer = true;
	document.head.appendChild(script);
	return script;
}

/**
 * Renders the widget and reports what it produces.
 *
 * `onToken` receives a token when Turnstile vouches for the visitor, and null
 * when the token expires or the widget errors — the two are the same fact for
 * the form (there is nothing to submit), and keeping them one callback is what
 * stops the caller from having to model Turnstile's lifecycle.
 */
export function TurnstileWidget({
	language,
	onToken,
}: {
	language: Language;
	onToken: (token: string | null) => void;
}) {
	const container = useRef<HTMLDivElement>(null);

	// Held in a ref so the effect can stay keyed to nothing and run once. A
	// caller passing an inline arrow — which is every caller — would otherwise
	// re-render the widget on each keystroke, and each re-render throws away a
	// token the signer already earned.
	const report = useRef(onToken);
	report.current = onToken;

	useEffect(() => {
		let widgetId: string | undefined;
		let cancelled = false;

		const render = (): void => {
			const api = window.turnstile;
			const element = container.current;
			if (cancelled || !api || !element || widgetId !== undefined) return;

			widgetId = api.render(element, {
				sitekey: SITE_CONFIG.turnstileSiteKey,
				// Without this the script reads the browser's language, which is how
				// an English page ends up drawing a Polish bot check.
				language,
				callback: (token) => report.current(token),
				"expired-callback": () => report.current(null),
				"error-callback": () => report.current(null),
			});
		};

		const script = loadScript();
		// The script may already have run — from a previous mount, or because
		// the browser had it cached — in which case no `load` event is coming.
		render();
		script.addEventListener("load", render);

		return () => {
			cancelled = true;
			script.removeEventListener("load", render);
			if (widgetId !== undefined) window.turnstile?.remove(widgetId);
		};
	}, [
		// Without this the script reads the browser's language, which is how
		// an English page ends up drawing a Polish bot check.
		language,
	]);

	return <div ref={container} />;
}

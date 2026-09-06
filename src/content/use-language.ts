import { useRouterState } from "@tanstack/react-router";
import type { Language } from "./index";
import { languageFromPath } from "./routing";

/**
 * The language of the page currently on screen.
 *
 * Routes know their own language statically and pass it down, which is what
 * keeps most components out of the router's state. This exists for the few
 * that cannot be passed anything: the document element wraps every route, and
 * the not-found and error components are rendered by the router itself rather
 * than by a route that could hand them a value.
 */
export function useLanguage(): Language {
	return languageFromPath(useRouterState({ select: (state) => state.location.pathname }));
}

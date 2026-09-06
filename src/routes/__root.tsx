/// <reference types="vite/client" />

import ibmPlexSansLatin from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url";
import newsreaderLatin from "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2?url";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type * as React from "react";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme";
import { languageFromPath } from "@/content/routing";
import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			// Everything else in the head is per-language and per-page, so each
			// route builds its own with `buildHead`. What is left here is what
			// every page shares regardless of what it says.
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			// The hero headline is the LCP element and it is set in the display
			// serif, so both latin cuts are fetched alongside the stylesheet rather
			// than after it. The latin-ext cuts carrying the Polish diacritics are
			// left to the unicode-range rules in styles.css.
			{
				rel: "preload",
				as: "font",
				type: "font/woff2",
				href: newsreaderLatin,
				crossOrigin: "anonymous",
			},
			{
				rel: "preload",
				as: "font",
				type: "font/woff2",
				href: ibmPlexSansLatin,
				crossOrigin: "anonymous",
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png",
			},
			{ rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
			{ rel: "icon", href: "/favicon.ico" },
		],
	}),
	errorComponent: (props) => {
		return (
			<RootDocument>
				<DefaultCatchBoundary {...props} />
			</RootDocument>
		);
	},
	notFoundComponent: () => <NotFound />,
	component: RootComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange={false}
			>
				<Outlet />
			</ThemeProvider>
		</RootDocument>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	// The one place that has to read the language off the router rather than
	// receive it: the document element wraps every route, so no route can set
	// it. `languageFromPath` is the same function the switcher and the hreflang
	// pair use, and it is tested against `/energia` not being English.
	const pathname = useRouterState({ select: (state) => state.location.pathname });

	return (
		<html lang={languageFromPath(pathname)}>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<TanStackRouterDevtools position="bottom-right" />
				<ReactQueryDevtools buttonPosition="bottom-left" />
				<Scripts />
			</body>
		</html>
	);
}

/// <reference types="vite/client" />

import ibmPlexSansLatin from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url";
import newsreaderLatin from "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2?url";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type * as React from "react";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme";
import appCss from "@/styles.css?url";
import { seo } from "@/utils/seo";

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
			...seo({
				title: "petition-on-cf — szablon strony petycji na Cloudflare Workers",
				description:
					"Otwarty szablon strony petycji: formularz podpisu ze zgodami RODO, licznik podpisów na żywo, mapa poparcia i treści po polsku oraz po angielsku. Jedno wdrożenie to jedna petycja, w całości na Twoim koncie Cloudflare.",
			}),
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
	// Polish is the default language; Phase 3 adds the /en prefix and makes this
	// per-route rather than fixed.
	return (
		<html lang="pl">
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

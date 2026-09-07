import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { buildHead } from "@/content/head";
import { fetchSignatureCounts } from "@/core/functions/signature-counts";
import { fetchSupporters } from "@/core/functions/supporters";

/**
 * Polish, served without a prefix because it is the default language.
 *
 * Its English twin is `src/routes/en/index.tsx`. Both do the same three
 * things — read the page's data, name a language, hand both to the same page
 * and the same head builder — so every decision they could disagree about is
 * made somewhere they both call.
 */
export const Route = createFileRoute("/")({
	// Runs on the server for the first paint, so the count and the first page of
	// the list are in the HTML the browser receives rather than something it
	// fetches afterwards.
	loader: async () => {
		const [counts, supporters] = await Promise.all([fetchSignatureCounts(), fetchSupporters()]);
		return { counts, supporters };
	},
	head: () => buildHead("pl", "/"),
	component: () => {
		const { counts, supporters } = Route.useLoaderData();
		return <LandingPage counts={counts} supporters={supporters} language="pl" path="/" />;
	},
});

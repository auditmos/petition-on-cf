import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { buildHead } from "@/content/head";
import { fetchSignatureCounts } from "@/core/functions/signature-counts";
import { fetchSupporters } from "@/core/functions/supporters";

/** English, served under `/en`. The Polish twin is `src/routes/index.tsx`. */
export const Route = createFileRoute("/en/")({
	loader: async () => {
		const [counts, supporters] = await Promise.all([fetchSignatureCounts(), fetchSupporters()]);
		return { counts, supporters };
	},
	head: () => buildHead("en", "/"),
	component: () => {
		const { counts, supporters } = Route.useLoaderData();
		return <LandingPage counts={counts} supporters={supporters} language="en" path="/" />;
	},
});

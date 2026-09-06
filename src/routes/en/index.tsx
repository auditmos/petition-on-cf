import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { buildHead } from "@/content/head";
import { fetchSignatureCounts } from "@/core/functions/signature-counts";

/** English, served under `/en`. The Polish twin is `src/routes/index.tsx`. */
export const Route = createFileRoute("/en/")({
	loader: () => fetchSignatureCounts(),
	head: () => buildHead("en", "/"),
	component: () => <LandingPage counts={Route.useLoaderData()} language="en" path="/" />,
});

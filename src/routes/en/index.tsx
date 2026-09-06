import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { buildHead } from "@/content/head";
import { fetchSignatureCount } from "@/core/functions/signature-count";

/** English, served under `/en`. The Polish twin is `src/routes/index.tsx`. */
export const Route = createFileRoute("/en/")({
	loader: () => fetchSignatureCount(),
	head: () => buildHead("en", "/"),
	component: () => <LandingPage count={Route.useLoaderData()} language="en" path="/" />,
});

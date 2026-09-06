import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { buildHead } from "@/content/head";
import { fetchSignatureCount } from "@/core/functions/signature-count";

/**
 * Polish, served without a prefix because it is the default language.
 *
 * Its English twin is `src/routes/en/index.tsx`. Both are three lines that name
 * a language and hand it to the same page and the same head builder — every
 * decision they could disagree about is made somewhere they both call.
 */
export const Route = createFileRoute("/")({
	// Runs on the server for the first paint, so the count is in the HTML the
	// browser receives rather than something it fetches afterwards.
	loader: () => fetchSignatureCount(),
	head: () => buildHead("pl", "/"),
	component: () => <LandingPage count={Route.useLoaderData()} language="pl" path="/" />,
});

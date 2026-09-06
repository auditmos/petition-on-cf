import { createFileRoute } from "@tanstack/react-router";
import { CounterSection } from "@/components/landing/counter-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { StatsSection } from "@/components/landing/stats-section";
import { NavigationBar } from "@/components/navigation";
import { fetchSignatureCount } from "@/core/functions/signature-count";

export const Route = createFileRoute("/")({
	// Runs on the server for the first paint, so the count is in the HTML the
	// browser receives rather than something it fetches afterwards.
	loader: () => fetchSignatureCount(),
	component: LandingPage,
});

function LandingPage() {
	const count = Route.useLoaderData();

	return (
		<div className="min-h-screen bg-paper">
			<NavigationBar />
			<main>
				<HeroSection />
				<CounterSection count={count} />
				<StatsSection />
				<FeaturesSection />
				<HowItWorksSection />
			</main>
			<Footer />
		</div>
	);
}

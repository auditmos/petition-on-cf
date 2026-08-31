import { createFileRoute } from "@tanstack/react-router";
import { FeaturesSection } from "@/components/landing/features-section";
import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { StatsSection } from "@/components/landing/stats-section";
import { NavigationBar } from "@/components/navigation";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	return (
		<div className="min-h-screen bg-paper">
			<NavigationBar />
			<main>
				<HeroSection />
				<StatsSection />
				<FeaturesSection />
				<HowItWorksSection />
			</main>
			<Footer />
		</div>
	);
}

import { CounterSection } from "@/components/landing/counter-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { SignSection } from "@/components/landing/sign-section";
import { StatsSection } from "@/components/landing/stats-section";
import { NavigationBar } from "@/components/navigation";
import { getContent, type Language } from "@/content";

/**
 * The landing page, in whichever language the route serves.
 *
 * There are two route files — `/` and `/en` — and one page, so the two can only
 * differ in the language they ask for. Anything a route could get wrong twice
 * is decided here once.
 *
 * `path` is this page without a language prefix. The route supplies it as the
 * literal it already is, which is what keeps the language switcher out of the
 * router's state and therefore testable.
 */
export function LandingPage({
	count,
	language,
	path = "/",
}: {
	count: number;
	language: Language;
	path?: string;
}) {
	const content = getContent(language);

	return (
		<div className="min-h-screen bg-paper">
			<NavigationBar
				language={language}
				path={path}
				copy={content.nav}
				languageSwitch={content.languageSwitch}
				theme={content.theme}
			/>
			<main>
				<HeroSection copy={content.hero} />
				<CounterSection count={count} language={language} copy={content.counter} />
				<SignSection copy={content.sign} language={language} />
				<StatsSection copy={content.stats} />
				<FeaturesSection copy={content.features} />
				<HowItWorksSection copy={content.howItWorks} />
			</main>
			<Footer copy={content.footer} />
		</div>
	);
}

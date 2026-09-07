import { useLiveCounts } from "@/components/counter/use-live-counts";
import { CounterSection } from "@/components/landing/counter-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FloatingBar } from "@/components/landing/floating-bar";
import { Footer } from "@/components/landing/footer";
import { HERO_SECTION_ID, HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { MapSection } from "@/components/landing/map-section";
import { SignSection } from "@/components/landing/sign-section";
import { StatsSection } from "@/components/landing/stats-section";
import { NavigationBar } from "@/components/navigation";
import { getContent, type Language } from "@/content";
import type { SignatureCounts } from "@/core/signature-counts";

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
 *
 * `counts` is what the loader read from D1 for the first paint. From here the
 * page takes over: one socket, opened once, feeding all three places the
 * numbers appear — the counter, the bar and the map. Opening a connection per
 * reader would triple every deployment's socket count to show one payload
 * three ways, and the three could then disagree.
 */
export function LandingPage({
	counts,
	language,
	path = "/",
}: {
	counts: SignatureCounts;
	language: Language;
	path?: string;
}) {
	const content = getContent(language);
	const live = useLiveCounts(counts);

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
				<CounterSection count={live.total} language={language} copy={content.counter} />
				<SignSection copy={content.sign} legal={content.legal} language={language} />
				<MapSection
					counts={live}
					language={language}
					copy={content.map}
					nouns={content.counter.nouns}
				/>
				<StatsSection copy={content.stats} />
				<FeaturesSection copy={content.features} />
				<HowItWorksSection copy={content.howItWorks} />
			</main>
			<Footer copy={content.footer} legal={content.legal} language={language} />
			<FloatingBar
				count={live.total}
				language={language}
				copy={content}
				watching={HERO_SECTION_ID}
			/>
		</div>
	);
}

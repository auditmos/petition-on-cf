import { useLiveCounts } from "@/components/counter/use-live-counts";
import { CounterSection } from "@/components/landing/counter-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FloatingBar } from "@/components/landing/floating-bar";
import { Footer } from "@/components/landing/footer";
import { HERO_SECTION_ID, HeroSection } from "@/components/landing/hero-section";
import { MapSection } from "@/components/landing/map-section";
import { MechanismSection } from "@/components/landing/mechanism-section";
import { ShareSection } from "@/components/landing/share-section";
import { SignSection } from "@/components/landing/sign-section";
import { StatsSection } from "@/components/landing/stats-section";
import { SupportersSection } from "@/components/landing/supporters-section";
import { NavigationBar } from "@/components/navigation";
import { getContent, type Language } from "@/content";
import { SITE_CONFIG, socialLinks } from "@/content/site-config";
import type { SignatureCounts } from "@/core/signature-counts";
import type { SupporterPage } from "@/core/supporters";

/**
 * The landing page, in whichever language the route serves.
 *
 * There are two route files — `/` and `/en` — and one page, so the two can only
 * differ in the language they ask for. Anything a route could get wrong twice
 * is decided here once.
 *
 * `path` is this page without a language prefix. The route supplies it as the
 * literal it already is, which is what keeps the language switcher out of the
 * router's state and therefore testable. The share section reads it too, for
 * the same reason: the link a reader passes on has to be the canonical address
 * of the page they are looking at, in the language they are looking at it in.
 *
 * The section order is the argument the page makes — the evidence and the
 * demands before the form, everything a reader does *after* signing after it.
 * `landing-page.test.tsx` pins it, because the order is a decision rather than
 * a consequence of how the file happens to be written.
 *
 * `counts` and `supporters` are both what the loader read from D1 for the
 * first paint, and one connection carries both onwards. It is opened once and
 * feeds the four places the petition's state appears — the counter, the bar,
 * the map and the list. Opening a connection per consumer would multiply every
 * deployment's socket count to show one payload four ways, and the four could
 * then disagree.
 *
 * What the connection delivers to the list is names, not the list: the section
 * still owns what is on screen and still fetches older pages when the reader
 * asks. A signature whose signer declined publication therefore moves the
 * counter and leaves the list untouched, which is the intended behaviour rather
 * than the two contradicting each other.
 */
export function LandingPage({
	counts,
	supporters,
	language,
	path = "/",
}: {
	counts: SignatureCounts;
	supporters: SupporterPage;
	language: Language;
	path?: string;
}) {
	const content = getContent(language);
	const { counts: live, arrivals } = useLiveCounts(counts);

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
				<StatsSection copy={content.stats} />
				<MechanismSection copy={content.mechanism} />
				<CounterSection counts={live} language={language} copy={content.counter} />
				<SignSection copy={content.sign} legal={content.legal} language={language} />
				<MapSection
					counts={live}
					language={language}
					copy={content.map}
					nouns={content.counter.nouns}
				/>
				<SupportersSection page={supporters} arrivals={arrivals} copy={content.supporters} />
				<ShareSection copy={content.share} language={language} path={path} />
				<FaqSection copy={content.faq} />
			</main>
			<Footer
				copy={content.footer}
				legal={content.legal}
				language={language}
				socials={socialLinks(SITE_CONFIG)}
			/>
			<FloatingBar
				count={live.total}
				language={language}
				copy={content}
				watching={HERO_SECTION_ID}
				path={path}
			/>
		</div>
	);
}

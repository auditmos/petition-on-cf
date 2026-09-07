import { Footer } from "@/components/landing/footer";
import { LegalText } from "@/components/legal/legal-text";
import { NavigationBar } from "@/components/navigation";
import { getContent, type Language } from "@/content";
import { getLegalText, type LegalDocumentName, legalDocumentPath } from "@/content/legal";
import { SITE_CONFIG, socialLinks } from "@/content/site-config";

/**
 * One legal document, as a page.
 *
 * There are two route files per document — the Polish one and the English one
 * — and they are three lines each, so every decision the two could disagree
 * about is made here once.
 *
 * The document itself is Polish in both languages, by decision: a translated
 * consent or clause would be a second legal wording nobody has approved. What
 * the English side adds is a line saying so, and `lang="pl"` on the document
 * itself, so a screen reader does not read Polish with an English voice.
 *
 * The page carries the site's own navigation and footer rather than standing
 * alone. A reader arrives here from a consent checkbox in the middle of
 * signing, and the way back to the petition — and to the other document — has
 * to be where it is everywhere else.
 */
export function LegalPage({
	document,
	language,
}: {
	document: LegalDocumentName;
	language: Language;
}) {
	const content = getContent(language);
	// The switcher needs the page without its language prefix, so that changing
	// language lands on this document rather than on the home page.
	const path = legalDocumentPath(document);

	return (
		<div className="min-h-screen bg-paper">
			<NavigationBar
				language={language}
				path={path}
				copy={content.nav}
				languageSwitch={content.languageSwitch}
				theme={content.theme}
			/>
			<main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
				{language === "pl" ? null : (
					<p className="mb-10 rounded-lg border border-divider bg-ground p-4 text-sm leading-relaxed text-quiet">
						{content.legal.polishOnlyNotice}
					</p>
				)}

				<div lang="pl">
					<LegalText markdown={getLegalText(document)} language={language} />
				</div>
			</main>
			<Footer
				copy={content.footer}
				legal={content.legal}
				language={language}
				socials={socialLinks(SITE_CONFIG)}
			/>
		</div>
	);
}

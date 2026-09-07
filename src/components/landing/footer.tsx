import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { Content, Language } from "@/content";
import { LEGAL_DOCUMENT_NAMES, legalDocumentPath } from "@/content/legal";
import { toLanguagePath } from "@/content/routing";
import { SITE_CONFIG } from "@/content/site-config";

/** Which document each footer entry points at. Labels come from the content. */
const HREFS = {
	repository: SITE_CONFIG.repositoryUrl,
	prd: SITE_CONFIG.prdUrl,
	plan: SITE_CONFIG.planUrl,
	issues: SITE_CONFIG.issuesUrl,
} as const;

/**
 * The legal documents are a second list on purpose.
 *
 * The ones above are about the software and live on GitHub; these are about
 * this deployment and live on this site, in the reader's own language. Mixing
 * them would mean one list where half the entries open a new tab and half do
 * not, and where "Documents" meant two different things.
 */
export function Footer({
	copy,
	legal,
	language,
}: {
	copy: Content["footer"];
	legal: Content["legal"];
	language: Language;
}) {
	return (
		<footer className="border-t border-divider bg-ground">
			<div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
				<div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
					<div className="max-w-md">
						<p className="text-base font-semibold text-ink">{copy.name}</p>
						<p className="mt-3 text-sm leading-relaxed text-quiet">{copy.description}</p>
					</div>

					<nav aria-label={copy.documentsHeading}>
						<h2 className="text-xs font-medium uppercase tracking-wider text-quiet">
							{copy.documentsHeading}
						</h2>
						<ul className="mt-4 space-y-2">
							{copy.documents.map((document) => (
								<li key={document.key}>
									<a
										href={HREFS[document.key as keyof typeof HREFS] ?? SITE_CONFIG.repositoryUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="group inline-flex items-center text-sm text-quiet transition-colors hover:text-brand-dark"
									>
										{document.label}
										<ExternalLink className="ml-1.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
									</a>
								</li>
							))}
						</ul>
					</nav>

					<nav aria-label={copy.legalHeading}>
						<h2 className="text-xs font-medium uppercase tracking-wider text-quiet">
							{copy.legalHeading}
						</h2>
						<ul className="mt-4 space-y-2">
							{LEGAL_DOCUMENT_NAMES.map((name) => (
								<li key={name}>
									<Link
										to={toLanguagePath(legalDocumentPath(name), language)}
										className="text-sm text-quiet transition-colors hover:text-brand-dark"
									>
										{legal.documents[name].title}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				</div>

				<div className="mt-12 flex flex-col gap-2 border-t border-divider pt-6 text-xs text-quiet sm:flex-row sm:items-center sm:justify-between">
					<p>{copy.disclaimer}</p>
					<p>
						{copy.licenseLead}{" "}
						<a
							href={SITE_CONFIG.licenseUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="underline underline-offset-2 transition-colors hover:text-brand-dark"
						>
							{copy.licenseLabel}
						</a>
					</p>
				</div>
			</div>
		</footer>
	);
}

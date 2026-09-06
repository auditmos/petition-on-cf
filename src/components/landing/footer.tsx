import { ExternalLink } from "lucide-react";
import type { Content } from "@/content";
import { SITE_CONFIG } from "@/content/site-config";

/** Which document each footer entry points at. Labels come from the content. */
const HREFS = {
	repository: SITE_CONFIG.repositoryUrl,
	prd: SITE_CONFIG.prdUrl,
	plan: SITE_CONFIG.planUrl,
	issues: SITE_CONFIG.issuesUrl,
} as const;

export function Footer({ copy }: { copy: Content["footer"] }) {
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

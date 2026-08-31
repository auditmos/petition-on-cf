import { ExternalLink } from "lucide-react";
import { PROJECT_LINKS } from "@/components/landing/project-links";

const documents = [
	{ name: "Repozytorium na GitHubie", href: PROJECT_LINKS.repository },
	{ name: "Założenia projektu (PRD)", href: PROJECT_LINKS.prd },
	{ name: "Plan wdrożenia w fazach", href: PROJECT_LINKS.plan },
	{ name: "Zadania i postęp prac", href: PROJECT_LINKS.issues },
];

export function Footer() {
	return (
		<footer className="border-t border-divider bg-ground">
			<div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
				<div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
					<div className="max-w-md">
						<p className="text-base font-semibold text-ink">petition-on-cf</p>
						<p className="mt-3 text-sm leading-relaxed text-quiet">
							Szablon strony petycji na Cloudflare Workers. Rozwijany publicznie jako projekt
							otwarty — dokumenty poniżej opisują, co powstaje i w jakiej kolejności.
						</p>
					</div>

					<nav aria-label="Dokumenty projektu">
						<h2 className="text-xs font-medium uppercase tracking-wider text-quiet">Dokumenty</h2>
						<ul className="mt-4 space-y-2">
							{documents.map((document) => (
								<li key={document.name}>
									<a
										href={document.href}
										target="_blank"
										rel="noopener noreferrer"
										className="group inline-flex items-center text-sm text-quiet transition-colors hover:text-brand-dark"
									>
										{document.name}
										<ExternalLink className="ml-1.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
									</a>
								</li>
							))}
						</ul>
					</nav>
				</div>

				<div className="mt-12 flex flex-col gap-2 border-t border-divider pt-6 text-xs text-quiet sm:flex-row sm:items-center sm:justify-between">
					<p>
						Odpowiedzialność za zgodność treści prawnych konkretnej kampanii spoczywa na jej
						organizatorze.
					</p>
					<p>
						Licencja{" "}
						<a
							href={PROJECT_LINKS.license}
							target="_blank"
							rel="noopener noreferrer"
							className="underline underline-offset-2 transition-colors hover:text-brand-dark"
						>
							MIT
						</a>
					</p>
				</div>
			</div>
		</footer>
	);
}

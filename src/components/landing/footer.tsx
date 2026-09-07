import { Link } from "@tanstack/react-router";
import { Facebook, Linkedin, Share2 } from "lucide-react";
import type { Content, Language } from "@/content";
import { LEGAL_DOCUMENT_NAMES, legalDocumentPath } from "@/content/legal";
import { toLanguagePath } from "@/content/routing";
import { SITE_CONFIG, type SocialLink, type SocialNetwork } from "@/content/site-config";

const ICONS: Record<SocialNetwork, typeof Facebook> = {
	facebook: Facebook,
	x: Share2,
	linkedin: Linkedin,
};

/**
 * Who is behind the petition, and where its documents are.
 *
 * The identity block is the point of the footer rather than an ornament: the
 * consent texts above it name an administrator and promise an address to write
 * to, and a reader who wants to check either should not have to open a legal
 * document to do it. Everything in it comes from the site config, so a
 * personalised deployment says its own name without a component being edited.
 *
 * What is deliberately not here is the template's own backlog. A petition's
 * footer belongs to its campaign; one honest line crediting the software is
 * the whole of what a visitor needs to know about where the site came from.
 */
export function Footer({
	copy,
	legal,
	language,
	socials,
}: {
	copy: Content["footer"];
	legal: Content["legal"];
	language: Language;
	/** Already filtered by `socialLinks` — whatever is here gets a link. */
	socials: SocialLink[];
}) {
	return (
		<footer className="border-t border-divider bg-ground">
			<div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
				<div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
					<div className="max-w-md">
						<p className="text-base font-semibold text-ink">{copy.name}</p>
						<p className="mt-3 text-sm leading-relaxed text-quiet">{copy.description}</p>
						<address className="mt-4 text-sm not-italic leading-relaxed text-quiet">
							{SITE_CONFIG.organizerStreet}
							<br />
							{SITE_CONFIG.organizerCity}
							<br />
							<a
								href={`mailto:${SITE_CONFIG.contactEmail}`}
								className="underline underline-offset-2 transition-colors hover:text-brand-dark"
							>
								{SITE_CONFIG.contactEmail}
							</a>
						</address>
					</div>

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

					{/*
					 * Absent, not empty. A deployment with no profiles would otherwise
					 * ship a heading over nothing, which reads as a page that failed to
					 * load rather than as a campaign that is not on Facebook.
					 */}
					{socials.length === 0 ? null : (
						<nav aria-label={copy.socialHeading}>
							<h2 className="text-xs font-medium uppercase tracking-wider text-quiet">
								{copy.socialHeading}
							</h2>
							<ul className="mt-4 flex gap-4">
								{socials.map((social) => {
									const Icon = ICONS[social.network];
									return (
										<li key={social.network}>
											<a
												href={social.url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex text-quiet transition-colors hover:text-brand-dark"
											>
												<Icon aria-hidden="true" className="h-5 w-5" />
												<span className="sr-only">{copy.socialNetworks[social.network]}</span>
											</a>
										</li>
									);
								})}
							</ul>
						</nav>
					)}
				</div>

				<div className="mt-12 flex flex-col gap-2 border-t border-divider pt-6 text-xs text-quiet sm:flex-row sm:items-center sm:justify-between">
					<p>{copy.disclaimer}</p>
					<p>
						<a
							href={SITE_CONFIG.repositoryUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="underline underline-offset-2 transition-colors hover:text-brand-dark"
						>
							{copy.colophon}
						</a>{" "}
						· {copy.licenseLead}{" "}
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

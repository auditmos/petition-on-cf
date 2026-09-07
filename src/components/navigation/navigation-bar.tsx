import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import * as React from "react";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Content, Language } from "@/content";
import { toLanguagePath } from "@/content/routing";

/**
 * The bar at the top, on every page of the site.
 *
 * Its entries name sections of the landing page, and the bar is also rendered
 * on the two legal documents — where those sections do not exist. So each
 * entry is a link to the section's address rather than a button that scrolls:
 * on the landing page the click is intercepted and the scroll happens in
 * place, and anywhere else the router follows the href, lands on the landing
 * page and scrolls to the hash on arrival.
 *
 * Being a link is worth more than the interception. It carries an address a
 * reader can copy or open in a new tab, it works with scripting off, and it is
 * what a reader who opened the RODO clause from a consent checkbox needs when
 * they want the form back.
 */
export function NavigationBar({
	language,
	path,
	copy,
	languageSwitch,
	theme,
}: {
	language: Language;
	path: string;
	copy: Content["nav"];
	languageSwitch: Content["languageSwitch"];
	theme: Content["theme"];
}) {
	const [isOpen, setIsOpen] = React.useState(false);
	const home = toLanguagePath("/", language);

	/**
	 * Scroll instead of navigating, but only when there is something to scroll
	 * to. The section's presence is the question — not whether this looks like
	 * the landing page — because that is exactly what the answer depends on.
	 *
	 * The address bar is deliberately left alone: a reader who wants the deep
	 * link can copy it off the entry, and writing the hash on every click would
	 * turn the back button into an undo for scrolling.
	 */
	const scrollToSection = (event: React.MouseEvent, sectionId: string) => {
		const section = document.getElementById(sectionId);
		setIsOpen(false);
		if (!section) return;

		event.preventDefault();
		section.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<nav className="sticky top-0 z-50 bg-brand-deep text-white">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:h-20 lg:px-8">
				<Link to={toLanguagePath("/", language)} className="flex flex-col no-underline">
					<span className="font-display text-lg font-semibold tracking-tight lg:text-xl">
						{copy.brand}
					</span>
					<span className="text-[0.65rem] font-medium uppercase tracking-wider text-white/60">
						{copy.tagline}
					</span>
				</Link>

				<div className="hidden items-center gap-1 lg:flex">
					{copy.items.map((item) => (
						<Link
							key={item.sectionId}
							to={home}
							hash={item.sectionId}
							onClick={(event) => scrollToSection(event, item.sectionId)}
							className="rounded-md px-4 py-2 text-sm font-medium text-white/80 no-underline transition-colors hover:bg-white/10 hover:text-white"
						>
							{item.label}
						</Link>
					))}

					<div className="ml-2 flex items-center border-l border-white/20 pl-2 text-white">
						<LanguageSwitcher language={language} path={path} copy={languageSwitch} />
						<ThemeToggle copy={theme} variant="ghost" align="end" />
					</div>
				</div>

				<div className="flex items-center gap-2 text-white lg:hidden">
					<LanguageSwitcher language={language} path={path} copy={languageSwitch} />
					<ThemeToggle copy={theme} variant="ghost" align="end" />
					<Sheet open={isOpen} onOpenChange={setIsOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-white/10">
								<Menu className="h-5 w-5" />
								<span className="sr-only">{copy.openMenuLabel}</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="right" className="w-[300px]">
							<SheetHeader className="text-left">
								<SheetTitle>{copy.menuTitle}</SheetTitle>
							</SheetHeader>

							<div className="flex flex-col gap-1 px-4">
								{copy.items.map((item) => (
									<Link
										key={item.sectionId}
										to={home}
										hash={item.sectionId}
										onClick={(event) => scrollToSection(event, item.sectionId)}
										className="rounded-md px-4 py-3 text-left text-sm font-medium text-quiet no-underline transition-colors hover:bg-brand-soft hover:text-brand-dark"
									>
										{item.label}
									</Link>
								))}
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</nav>
	);
}

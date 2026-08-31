import { Link } from "@tanstack/react-router";
import { Github, Menu } from "lucide-react";
import * as React from "react";
import { PROJECT_LINKS } from "@/components/landing/project-links";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface NavigationItem {
	label: string;
	sectionId: string;
}

const navigationItems: NavigationItem[] = [
	{ label: "Zakres szablonu", sectionId: "funkcje" },
	{ label: "Uruchomienie", sectionId: "start" },
	{ label: "Architektura", sectionId: "architektura" },
];

export function NavigationBar() {
	const [isOpen, setIsOpen] = React.useState(false);

	const scrollToSection = (sectionId: string) => {
		document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
		setIsOpen(false);
	};

	return (
		<nav className="sticky top-0 z-50 bg-brand-deep text-white">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:h-20 lg:px-8">
				<Link to="/" className="flex flex-col no-underline">
					<span className="font-display text-lg font-semibold tracking-tight lg:text-xl">
						petition-on-cf
					</span>
					<span className="text-[0.65rem] font-medium uppercase tracking-wider text-white/60">
						Szablon petycji
					</span>
				</Link>

				<div className="hidden items-center gap-1 lg:flex">
					{navigationItems.map((item) => (
						<button
							key={item.label}
							type="button"
							onClick={() => scrollToSection(item.sectionId)}
							className="rounded-md px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
						>
							{item.label}
						</button>
					))}

					<a
						href={PROJECT_LINKS.repository}
						target="_blank"
						rel="noopener noreferrer"
						className="ml-2 inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-medium transition-colors hover:bg-white hover:text-brand-deep"
					>
						<Github className="h-4 w-4" />
						GitHub
					</a>

					<div className="ml-2 border-l border-white/20 pl-2 text-white">
						<ThemeToggle variant="ghost" align="end" />
					</div>
				</div>

				<div className="flex items-center gap-2 text-white lg:hidden">
					<ThemeToggle variant="ghost" align="end" />
					<Sheet open={isOpen} onOpenChange={setIsOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-white/10">
								<Menu className="h-5 w-5" />
								<span className="sr-only">Otwórz menu nawigacji</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="right" className="w-[300px]">
							<SheetHeader className="text-left">
								<SheetTitle>Nawigacja</SheetTitle>
							</SheetHeader>

							<div className="flex flex-col gap-1 px-4">
								{navigationItems.map((item) => (
									<button
										key={item.label}
										type="button"
										onClick={() => scrollToSection(item.sectionId)}
										className="rounded-md px-4 py-3 text-left text-sm font-medium text-quiet transition-colors hover:bg-brand-soft hover:text-brand-dark"
									>
										{item.label}
									</button>
								))}
								<a
									href={PROJECT_LINKS.repository}
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => setIsOpen(false)}
									className="mt-2 inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium text-quiet transition-colors hover:bg-brand-soft hover:text-brand-dark"
								>
									<Github className="h-4 w-4" />
									GitHub
								</a>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</nav>
	);
}

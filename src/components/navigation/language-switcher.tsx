import { Link } from "@tanstack/react-router";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Content, Language } from "@/content";
import { LANGUAGES } from "@/content";
import { toLanguagePath } from "@/content/routing";

/**
 * Changes the language without changing the page.
 *
 * `path` is the current page with no language prefix, which the route knows
 * statically — a reader on `/en/podpisz` is on the same page as a reader on
 * `/podpisz`, and both get taken to their own version of it rather than to the
 * home page. The arithmetic lives in `@/content/routing`, which is tested
 * against the awkward cases (`/energia` is not English).
 *
 * Each destination is named in its own language: somebody who cannot read this
 * page has to be able to find the one they can.
 */
export function LanguageSwitcher({
	language,
	path,
	copy,
}: {
	language: Language;
	path: string;
	copy: Content["languageSwitch"];
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-white/10">
					<Languages className="h-4 w-4" aria-hidden="true" />
					<span className="sr-only">{copy.label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{LANGUAGES.map((option) => (
					<DropdownMenuItem key={option} asChild>
						<Link
							to={toLanguagePath(path, option)}
							hrefLang={option}
							aria-current={option === language ? "true" : undefined}
						>
							{copy.options[option]}
						</Link>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

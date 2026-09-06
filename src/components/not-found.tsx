import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, Home } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getContent } from "@/content";
import { toLanguagePath } from "@/content/routing";
import { useLanguage } from "@/content/use-language";

/**
 * Rendered by the router rather than by a route, so it reads its own language
 * off the location instead of being handed one — and it sends the reader home
 * in that language rather than dropping them into Polish.
 */
export function NotFound({ children }: { children?: React.ReactNode }) {
	const language = useLanguage();
	const copy = getContent(language).notFound;

	return (
		<div className="min-h-[60vh] flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardContent className="pt-6">
					<div className="flex flex-col items-center text-center space-y-6">
						<div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
							<FileQuestion className="h-10 w-10 text-muted-foreground" />
						</div>

						<div className="space-y-2">
							<h1 className="text-2xl font-semibold tracking-tight">{copy.heading}</h1>
							<div className="text-muted-foreground">{children || <p>{copy.description}</p>}</div>
						</div>

						<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
							<Button
								variant="default"
								onClick={() => window.history.back()}
								className="flex items-center gap-2"
							>
								<ArrowLeft className="h-4 w-4" />
								{copy.back}
							</Button>
							<Button variant="outline" asChild>
								<Link to={toLanguagePath("/", language)} className="flex items-center gap-2">
									<Home className="h-4 w-4" />
									{copy.home}
								</Link>
							</Button>
						</div>

						<div className="pt-4 border-t w-full">
							<p className="text-sm text-muted-foreground">{copy.hint}</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

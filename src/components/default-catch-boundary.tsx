import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Bug, ChevronDown, Home, Mail, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getContent } from "@/content";
import { toLanguagePath } from "@/content/routing";
import { SITE_CONFIG } from "@/content/site-config";
import { useLanguage } from "@/content/use-language";

/**
 * Rendered by the router rather than by a route, so it reads its own language
 * off the location. The report button opens a mail to the address in the site
 * config — the organizer of this deployment, not the template's author.
 */
export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();
	const language = useLanguage();
	const copy = getContent(language).errorBoundary;
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});
	const [showDetails, setShowDetails] = useState(false);

	// biome-ignore lint/suspicious/noConsole: surface route errors for debugging
	console.error(error);

	const errorMessage = error?.message || copy.fallbackMessage;
	const errorStack = error?.stack || "";
	const hasStack = errorStack.length > 0;

	const handleReportError = () => {
		const subject = encodeURIComponent(copy.reportSubject);
		const body = encodeURIComponent(
			`${copy.reportIntro}\n\n${errorMessage}\n\n${errorStack}\n\n${copy.reportPrompt}`,
		);
		window.location.href = `mailto:${SITE_CONFIG.contactEmail}?subject=${subject}&body=${body}`;
	};

	return (
		<div className="min-h-[60vh] flex items-center justify-center p-4">
			<Card className="w-full max-w-2xl">
				<CardHeader>
					<div className="flex items-center space-x-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="h-5 w-5 text-destructive" />
						</div>
						<div>
							<CardTitle className="text-xl">{copy.heading}</CardTitle>
							<p className="text-sm text-muted-foreground">{copy.description}</p>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					<Alert variant="destructive">
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription className="font-medium">{errorMessage}</AlertDescription>
					</Alert>

					<div className="flex flex-col sm:flex-row gap-3">
						<Button onClick={() => router.invalidate()} className="flex items-center gap-2">
							<RefreshCw className="h-4 w-4" />
							{copy.retry}
						</Button>

						{isRoot ? (
							<Button variant="outline" asChild>
								<Link to={toLanguagePath("/", language)} className="flex items-center gap-2">
									<Home className="h-4 w-4" />
									{copy.home}
								</Link>
							</Button>
						) : (
							<Button
								variant="outline"
								onClick={() => window.history.back()}
								className="flex items-center gap-2"
							>
								<ArrowLeft className="h-4 w-4" />
								{copy.back}
							</Button>
						)}
					</div>

					{hasStack && (
						<Collapsible open={showDetails} onOpenChange={setShowDetails}>
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
								>
									<Bug className="h-4 w-4" />
									{copy.detailsToggle}
									<ChevronDown
										className={`h-4 w-4 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
									/>
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-2">
								<div className="rounded-lg bg-muted p-4">
									<h4 className="text-sm font-medium mb-2">{copy.stackHeading}</h4>
									<pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
										{errorStack}
									</pre>
								</div>
							</CollapsibleContent>
						</Collapsible>
					)}

					<div className="border-t pt-4">
						<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
							<div className="text-sm text-muted-foreground">{copy.supportNote}</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleReportError}
								className="flex items-center gap-2"
							>
								<Mail className="h-4 w-4" />
								{copy.report}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

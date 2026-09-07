import { Check, Copy, Facebook, Linkedin, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Content } from "@/content";

/**
 * The four networks and the copy-link, in one place.
 *
 * Both the share section and the floating bar offer them, and they must not be
 * two implementations that agree today: a reader who copies the link from the
 * bar and a reader who copies it from the section have to get the same
 * address, and an endpoint corrected in one place has to be corrected in both.
 *
 * Every button is an ordinary link to a network's own compose window. Nothing
 * here loads a network's script — the official share buttons are third-party
 * JavaScript that watches whoever passes, and a petition page is the last
 * place to invite that in. The cost is that we cannot know whether anybody
 * actually posted, which is a statistic this template does not collect anyway.
 *
 * The endpoints are the networks' documented intent URLs. Facebook and
 * LinkedIn take only the address and read the title and picture from the page's
 * own Open Graph tags; X takes a sentence beside it, and WhatsApp has no URL
 * field at all, so there the link travels inside the message.
 */
const ENDPOINTS = {
	facebook: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encode(url)}`,
	x: (url: string, message: string) =>
		`https://x.com/intent/post?url=${encode(url)}&text=${encode(message)}`,
	linkedin: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encode(url)}`,
	whatsapp: (url: string, message: string) =>
		`https://api.whatsapp.com/send?text=${encode(`${message} ${url}`)}`,
} as const;

const ICONS = {
	facebook: Facebook,
	x: Share2,
	linkedin: Linkedin,
	whatsapp: MessageCircle,
} as const;

function encode(value: string): string {
	return encodeURIComponent(value);
}

/** Whether the clipboard has just taken the link, refused it, or neither. */
type CopyState = "idle" | "copied" | "failed";

/**
 * How much room there is to say it.
 *
 * `labelled` is the share section, where the row is the content and each
 * button can say what it does. `compact` is the floating bar, where five
 * spelled-out labels would not fit a phone beside the count and the call to
 * action — so the label is read out rather than shown, and the confirmation
 * goes to a live region nobody has to make space for.
 */
type ShareVariant = "labelled" | "compact";

export function ShareLinks({
	copy,
	url,
	variant,
}: {
	copy: Content["share"];
	/** The canonical address of the page being shared, in the reader's language. */
	url: string;
	variant: ShareVariant;
}) {
	const [copied, setCopied] = useState<CopyState>("idle");
	const compact = variant === "compact";

	const links = [
		{ key: "facebook", href: ENDPOINTS.facebook(url), label: copy.networks.facebook },
		{ key: "x", href: ENDPOINTS.x(url, copy.message), label: copy.networks.x },
		{ key: "linkedin", href: ENDPOINTS.linkedin(url), label: copy.networks.linkedin },
		{
			key: "whatsapp",
			href: ENDPOINTS.whatsapp(url, copy.message),
			label: copy.networks.whatsapp,
		},
	] as const;

	return (
		<div className={compact ? "flex items-center gap-0.5" : "flex flex-wrap items-center gap-3"}>
			{links.map((link) => {
				const Icon = ICONS[link.key];
				return (
					<Button
						key={link.key}
						asChild
						variant={compact ? "ghost" : "outline"}
						size={compact ? "icon" : "default"}
						className={
							compact ? "h-8 w-8 text-quiet hover:text-brand-dark sm:h-9 sm:w-9" : undefined
						}
					>
						<a href={link.href} target="_blank" rel="noopener noreferrer" title={link.label}>
							<Icon aria-hidden="true" className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
							{compact ? <span className="sr-only">{link.label}</span> : link.label}
						</a>
					</Button>
				);
			})}

			<Button
				type="button"
				variant={compact ? "ghost" : "outline"}
				size={compact ? "icon" : "default"}
				title={compact ? copy.copyLink : undefined}
				className={compact ? "h-8 w-8 text-quiet hover:text-brand-dark sm:h-9 sm:w-9" : undefined}
				onClick={() => {
					navigator.clipboard.writeText(url).then(
						() => setCopied("copied"),
						() => setCopied("failed"),
					);
				}}
			>
				{copied === "copied" ? (
					<Check aria-hidden="true" className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
				) : (
					<Copy aria-hidden="true" className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
				)}
				{compact ? <span className="sr-only">{copy.copyLink}</span> : copy.copyLink}
			</Button>

			{/*
			 * Announced rather than only shown: the button's own label does not
			 * change — a reader who copied the link may well want to copy it again
			 * — so without a live region a screen reader would report nothing at
			 * all happening. In the bar it is the *only* channel, since the icon
			 * swap is the whole of what a sighted reader gets.
			 */}
			<output className={compact ? "sr-only" : "mt-4 block w-full min-h-5 text-sm text-quiet"}>
				{copied === "copied" ? copy.copied : null}
				{copied === "failed" ? copy.copyFailed : null}
			</output>
		</div>
	);
}

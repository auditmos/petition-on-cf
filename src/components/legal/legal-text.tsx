import { Fragment } from "react";
import type { Language } from "@/content";
import { toLanguagePath } from "@/content/routing";

/**
 * Markdown, in the small dialect the legal fixtures are written in.
 *
 * A dependency would bring a full CommonMark parser and, with it, raw HTML —
 * which is the one thing a document assembled from a file and a config value
 * must not be able to contain. This renders to React elements instead, so
 * there is no HTML string anywhere in the path and nothing to sanitise.
 *
 * The dialect is deliberately small: what the fixtures use, and nothing on
 * spec. Anything outside it renders as the literal text it is, which is a
 * visible mistake rather than a silently dropped paragraph.
 */
export function LegalText({ markdown, language }: { markdown: string; language: Language }) {
	return (
		<>
			{blocks(markdown).map((block) => (
				// The block's own text is its identity. A legal document never says
				// the same paragraph twice, and nothing here reorders — the source
				// is a frozen fixture read top to bottom.
				<Fragment key={block}>{renderBlock(block, language)}</Fragment>
			))}
		</>
	);
}

/**
 * One line of legal text, with no block element around it.
 *
 * A consent checkbox's wording is a single sentence that has to sit inside the
 * element naming the box, and a `<p>` cannot live in a `<span>`. Same dialect,
 * same links, same language rule — only the wrapper is the caller's.
 */
export function LegalSentence({ markdown, language }: { markdown: string; language: Language }) {
	return <>{inline(markdown.trim(), language)}</>;
}

/** Paragraph-level chunks: what blank lines separate. */
function blocks(markdown: string): string[] {
	return markdown
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block.length > 0);
}

function renderBlock(block: string, language: Language) {
	const heading = /^(#{1,3})\s+(.*)$/.exec(block);

	if (heading) {
		const text = inline(heading[2] as string, language);
		switch (heading[1]?.length) {
			case 1:
				return <h1 className="mt-10 text-3xl first:mt-0 sm:text-4xl">{text}</h1>;
			case 2:
				return <h2 className="mt-10 text-2xl first:mt-0">{text}</h2>;
			default:
				return <h3 className="mt-8 text-lg font-semibold text-ink first:mt-0">{text}</h3>;
		}
	}

	if (block.startsWith("- ")) {
		return (
			<ul className="mt-4 space-y-2 pl-5 text-base leading-relaxed text-quiet">
				{block.split("\n").map((item) => (
					// The line is its own identity here: a fixture never repeats an
					// item verbatim, and if one ever did the two would be the same
					// item as far as the reader is concerned.
					<li key={item} className="list-disc">
						{inline(item.replace(/^-\s+/, ""), language)}
					</li>
				))}
			</ul>
		);
	}

	return <p className="mt-4 text-base leading-relaxed text-quiet">{inline(block, language)}</p>;
}

/** `[text](href)`, the one thing the fixtures say inside a paragraph. */
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * A block's text, with its links turned into links.
 *
 * Split rather than replaced, because the output is React elements: a
 * replacement would have to produce an HTML string, which is exactly the path
 * this component does not have.
 */
function inline(text: string, language: Language): React.ReactNode[] {
	const parts: React.ReactNode[] = [];
	let cursor = 0;

	for (const match of text.matchAll(LINK)) {
		const [whole, label, href] = match;
		if (match.index > cursor) parts.push(text.slice(cursor, match.index));
		parts.push(
			<a
				key={match.index}
				href={destination(href as string, language)}
				className="underline underline-offset-2 transition-colors hover:text-brand-dark"
			>
				{label}
			</a>,
		);
		cursor = match.index + whole.length;
	}

	if (cursor < text.length) parts.push(text.slice(cursor));
	return parts;
}

/**
 * Where a link in a legal text actually points.
 *
 * The fixtures name pages of this site by their Polish path, because that is
 * what the site config holds — one value, not one per language. A reader who
 * arrived in English should stay in English, so a path is re-prefixed here.
 * Anything that is not a path — `mailto:`, an absolute URL — is left exactly
 * as written: it does not belong to this site and has no language.
 */
function destination(href: string, language: Language): string {
	return href.startsWith("/") ? toLanguagePath(href, language) : href;
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Content } from "@/content";
import { parseSupporterPage, type Supporter, type SupporterPage } from "@/core/supporters";

/** Where the rest of the list comes from. The first page arrives as a prop. */
const SUPPORTERS_PATH = "/api/signatures/supporters";

/** The id the navigation scrolls to when a reader asks who has signed. */
export const SUPPORTERS_SECTION_ID = "podpisali";

/**
 * The people who agreed to be named.
 *
 * The first page arrives as a prop, read from D1 in the route loader, so the
 * list is in the first byte the browser receives — which is what "publicly
 * verifiable" has to mean for a reader with scripting off and for anything
 * that indexes the page.
 *
 * Nothing here decides who appears or under what name. Both are settled in
 * SQL, where the surname never leaves the database; a component that rebuilt
 * either could disagree with the query, and that disagreement would be a
 * privacy failure rather than a rendering bug. What this owns is the comma.
 *
 * Unlike the counter and the map it is not live, by decision: the counter
 * moves by one and this moves by a whole row, so pushing it would rewrite what
 * a reader is in the middle of reading. Later pages arrive only when the
 * reader asks, which also keeps a visitor on their way past the section from
 * loading two hundred names they never look at.
 */
export function SupportersSection({
	page,
	copy,
}: {
	page: SupporterPage;
	copy: Content["supporters"];
}) {
	const [shown, setShown] = useState<Supporter[]>(page.supporters);
	const [cursor, setCursor] = useState(page.nextCursor);
	// Not only a disabled button: it is what stops a second click from fetching
	// the same page again and listing everybody on it twice — the duplicate the
	// cursor rules out in the query, put back by an impatient reader.
	const [loading, setLoading] = useState(false);
	const [failed, setFailed] = useState(false);

	const loadMore = async (): Promise<void> => {
		if (cursor === null || loading) return;

		setLoading(true);
		setFailed(false);

		try {
			const response = await fetch(`${SUPPORTERS_PATH}?cursor=${encodeURIComponent(cursor)}`);
			const body = (await response.json()) as { data?: unknown };
			const next = parseSupporterPage(body.data);

			// A page that did not arrive is not a page that is empty. What is on
			// screen is already true, so it stays and the reader is told.
			if (!next) {
				setFailed(true);
				return;
			}

			setShown((listed) => [...listed, ...next.supporters]);
			setCursor(next.nextCursor);
		} catch {
			setFailed(true);
		} finally {
			setLoading(false);
		}
	};

	return (
		<section id={SUPPORTERS_SECTION_ID} className="border-t border-divider bg-paper py-20 sm:py-24">
			<div className="mx-auto max-w-6xl px-6 lg:px-8">
				<p className="text-xs font-medium uppercase tracking-wider text-quiet">{copy.eyebrow}</p>
				<h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">{copy.heading}</h2>
				<p className="mt-6 max-w-2xl text-sm leading-relaxed text-quiet">{copy.note}</p>

				{shown.length === 0 ? (
					<p className="mt-14 text-sm text-quiet">{copy.empty}</p>
				) : (
					<ul className="mt-14 grid grid-cols-1 gap-x-12 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
						{shown.map((supporter) => (
							<li key={supporter.id} className="text-sm text-ink">
								{supporter.city ? `${supporter.name}, ${supporter.city}` : supporter.name}
							</li>
						))}
					</ul>
				)}

				{failed ? <p className="mt-8 text-sm text-quiet">{copy.loadMoreFailed}</p> : null}

				{cursor === null ? null : (
					<Button
						type="button"
						variant="outline"
						className="mt-8"
						disabled={loading}
						onClick={() => void loadMore()}
					>
						{copy.loadMore}
					</Button>
				)}
			</div>
		</section>
	);
}

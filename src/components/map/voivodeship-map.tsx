import { type MouseEvent, useRef, useState } from "react";
import { formatCount } from "@/components/counter/signature-count";
import { MAP_VIEW_BOX, VOIVODESHIP_OUTLINES } from "@/components/map/geometry";
import type { Content, Language } from "@/content";
import type { SignatureCounts } from "@/core/signature-counts";
import { VOIVODESHIP_CODES, type VoivodeshipCode } from "@/core/voivodeship";
import { cn } from "@/lib/utils";

/**
 * How strongly a region is shaded, from empty to the strongest in the country.
 *
 * Discrete rather than continuous, and few rather than many: a reader compares
 * a region against its neighbours, not against a gradient, and four steps are
 * as many as anyone can tell apart on a map this size. Written out as whole
 * class names because Tailwind reads the source for them — building
 * `fill-brand/${n}` would leave every one of these out of the stylesheet.
 *
 * Index 0 is not a faint blue. A voivodeship nobody has signed from is a
 * different fact from one signature, and a scale that renders them as
 * neighbouring shades says the opposite.
 */
const SHADES = [
	"fill-divider",
	"fill-brand/25",
	"fill-brand/50",
	"fill-brand/75",
	"fill-brand",
] as const;

/** How far the readout sits from the cursor, in pixels. */
const READOUT_GAP = 12;

/**
 * Where the readout flips to the other side of the cursor.
 *
 * A fraction of the frame rather than a pixel count, because the frame is a
 * third of a wide page and the whole of a narrow one. Past this point there is
 * no room to the right and the readout hangs off the left of the cursor
 * instead.
 */
const FLIP_AT = 0.6;

/** The step a count earns, measured against the strongest region. */
function shadeOf(count: number, strongest: number): number {
	if (count <= 0 || strongest <= 0) return 0;
	return Math.ceil((count / strongest) * (SHADES.length - 1));
}

/** Where the pointer is inside the frame, and which way the readout hangs. */
interface Pointer {
	x: number;
	y: number;
	flip: boolean;
}

/**
 * Where the signatures came from, drawn and written out.
 *
 * Two renderings of one set of numbers, and the text is the one that counts.
 * Shading is a comparison — it says Mazowieckie outweighs Opolskie without
 * saying by how much, and it says nothing at all to a reader who cannot
 * separate the two colours. So every region's figure is written underneath in
 * words, and the drawing is what makes the pattern visible at a glance rather
 * than the only place the pattern exists.
 *
 * The sixteen regions are always all rendered. D1 returns only the codes it
 * holds, so a voivodeship nobody has signed from arrives as an absent key
 * rather than a zero; filling it in here is what keeps the map a map instead
 * of a list of whoever turned up.
 *
 * What is *not* one of the sixteen is derived rather than looked up:
 * `total - the sixteen` is whatever the pipeline could not place, whether that
 * is the `unknown` bucket it writes today, a row from before it existed, or a
 * bucket a later slice adds. Subtracting guarantees the parts add up to the
 * headline number, which a lookup by key could not promise.
 *
 * Pointing at a region answers immediately, in this page's own readout rather
 * than in the browser's. An SVG `<title>` is one line and was what this shipped
 * with, but it costs a second of dwell, leaves the region itself unchanged, and
 * shows text Chromium caches past the moment the count behind it moved — on a
 * page whose whole point is that the count moves. A visitor never learned the
 * map could be pointed at.
 */
export function VoivodeshipMap({
	counts,
	language,
	copy,
	nouns,
}: {
	counts: SignatureCounts;
	language: Language;
	copy: Content["map"];
	nouns: Content["counter"]["nouns"];
}) {
	const counted = VOIVODESHIP_CODES.map((code) => ({
		code,
		name: copy.regions[code],
		count: counts.byVoivodeship[code] ?? 0,
	}));

	const strongest = Math.max(...counted.map((region) => region.count));
	const regions = counted.map((region) => ({ ...region, shade: shadeOf(region.count, strongest) }));
	const placed = counted.reduce((sum, region) => sum + region.count, 0);
	const elsewhere = Math.max(0, counts.total - placed);

	// Alphabetical, and by the name this language uses rather than by the code
	// behind it. Ordering by count would be more interesting and would reorder
	// itself under the reader every time a signature arrives.
	const collator = new Intl.Collator(language);
	const listed = [...regions].sort((first, second) => collator.compare(first.name, second.name));

	const frame = useRef<HTMLDivElement>(null);
	const [hovered, setHovered] = useState<VoivodeshipCode | null>(null);
	const [pointer, setPointer] = useState<Pointer>({ x: 0, y: 0, flip: false });

	/**
	 * One handler on the drawing, rather than one per region.
	 *
	 * Which region the pointer is over is a question the event already answers,
	 * so it is read off the target instead of being pushed by sixteen
	 * `mouseenter` listeners. That is what makes the sea work: the space around
	 * Poland is inside the drawing and inside no region, and moving into it has
	 * to put the readout away rather than leave the last region asserted.
	 * Sixteen `mouseleave` listeners would have done it too, at the cost of a
	 * frame with nothing showing every time the pointer crossed a border.
	 */
	const track = (event: MouseEvent<SVGSVGElement>) => {
		const box = frame.current?.getBoundingClientRect();
		if (!box) return;

		const over = (event.target as Element).closest("[data-region]");
		setHovered((over?.getAttribute("data-region") as VoivodeshipCode | undefined) ?? null);

		const x = event.clientX - box.left;
		setPointer({ x, y: event.clientY - box.top, flip: x > box.width * FLIP_AT });
	};

	const pointedAt = regions.find((region) => region.code === hovered);

	return (
		<div ref={frame} className="relative grid gap-10 lg:grid-cols-5 lg:gap-12">
			<svg
				role="img"
				aria-label={copy.figureLabel}
				viewBox={MAP_VIEW_BOX}
				className="w-full max-w-2xl justify-self-center lg:col-span-3"
				onMouseMove={track}
				onMouseLeave={() => setHovered(null)}
			>
				{regions.map(({ code, shade }) => (
					<path
						key={code}
						d={VOIVODESHIP_OUTLINES[code]}
						data-region={code}
						data-shade={shade}
						data-hovered={code === hovered || undefined}
						className={cn("stroke-paper transition-[fill] duration-150", SHADES[shade])}
						strokeWidth={1.5}
					/>
				))}

				{/*
				 * The highlight is a seventeenth path rather than a thicker
				 * stroke on the sixteenth. A region is drawn before its
				 * neighbours to the east, so half of any stroke it grows is
				 * painted over by the next region's fill; an outline drawn last
				 * is drawn whole. It takes no pointer events, so tracing a
				 * border cannot make the map flicker between two regions.
				 */}
				{pointedAt && (
					<path
						d={VOIVODESHIP_OUTLINES[pointedAt.code]}
						className="pointer-events-none fill-none stroke-ink"
						strokeWidth={3}
					/>
				)}
			</svg>

			<dl className="grid grid-cols-1 gap-x-8 gap-y-3 self-start sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
				{listed.map(({ code, name, count }) => (
					<div
						key={code}
						data-hovered={code === hovered || undefined}
						className={cn(
							"flex items-baseline justify-between gap-4 border-b border-divider pb-2 transition-colors",
							code === hovered && "border-ink",
						)}
					>
						<dt className={cn("text-sm text-ink", code === hovered && "font-semibold")}>{name}</dt>
						<dd className="text-sm tabular-nums text-quiet">{written(count, language, nouns)}</dd>
					</div>
				))}

				{elsewhere > 0 && (
					<div className="flex items-baseline justify-between gap-4 border-b border-divider pb-2">
						<dt className="text-sm italic text-quiet">{copy.unknownLabel}</dt>
						<dd className="text-sm tabular-nums text-quiet">
							{written(elsewhere, language, nouns)}
						</dd>
					</div>
				)}
			</dl>

			{/*
			 * Hidden from assistive technology on purpose. It repeats what the
			 * list beside it already says, it only ever exists while a pointer
			 * is being moved, and announcing it would talk over the reader on
			 * every pixel of that movement.
			 */}
			{pointedAt && (
				<div
					data-testid="map-readout"
					aria-hidden="true"
					style={{
						left: pointer.flip ? pointer.x - READOUT_GAP : pointer.x + READOUT_GAP,
						top: pointer.y - READOUT_GAP,
					}}
					className={cn(
						"pointer-events-none absolute z-10 flex items-baseline gap-3 whitespace-nowrap rounded-md border border-divider bg-paper px-3 py-2 shadow-lg",
						"-translate-y-full",
						pointer.flip && "-translate-x-full",
					)}
				>
					<span className="text-sm font-semibold text-ink">{pointedAt.name}</span>
					<span className="text-sm tabular-nums text-brand">
						{written(pointedAt.count, language, nouns)}
					</span>
				</div>
			)}
		</div>
	);
}

/** A count and the word for it, the way the counter section writes it. */
function written(count: number, language: Language, nouns: Content["counter"]["nouns"]): string {
	const { figure, noun } = formatCount(count, language, nouns);
	return `${figure} ${noun}`;
}

/**
 * Which of Poland's sixteen voivodeships a signature is attributed to.
 *
 * Attribution happens once, at insert time, and is never revisited — the map
 * (#8) and the live counter (#7) both read the stored code rather than
 * recomputing it, so this is the only place the question is answered.
 *
 * ## The order, and why it is that order
 *
 * A supplied postal code wins over geo-IP outright, even when the two
 * disagree. Geo-IP is confidently wrong for mobile and VPN signers — it
 * attributes them to a carrier's egress city, which is frequently a different
 * voivodeship from the one they live in — whereas a postal code is
 * self-reported about where the signer actually is. It is also structured
 * where the free-text city field is not: `NN-NNN` validates, so its lookup is
 * deterministic rather than a guess at what "Wwa" means.
 *
 * The price is that Polish postal districts were drawn in 1972 around ten
 * sorting centres, not around the sixteen voivodeships created in 1999, so the
 * mapping below is approximate near borders. Prefix 82 is the clearest case:
 * it covers Elbląg, which is warmińsko-mazurskie, alongside Malbork and Sztum,
 * which are pomorskie. One prefix cannot be both, and this table answers
 * pomorskie. That inaccuracy is bounded and local; geo-IP's is neither.
 */

/** ISO 3166-2:PL, as the standard has written them since 2015. */
export const VOIVODESHIP_CODES = [
	"PL-DS",
	"PL-KP",
	"PL-LU",
	"PL-LB",
	"PL-LD",
	"PL-MA",
	"PL-MZ",
	"PL-OP",
	"PL-PK",
	"PL-PD",
	"PL-PM",
	"PL-SL",
	"PL-SK",
	"PL-WN",
	"PL-WP",
	"PL-ZP",
] as const;

export type VoivodeshipCode = (typeof VOIVODESHIP_CODES)[number];

/**
 * The bucket for a signature nothing could attribute.
 *
 * A stored value rather than a null, so `GROUP BY voivodeship_code` yields it
 * as a row every reader can count without spelling out the null case. It is
 * deliberately not shaped like an ISO code — nobody should be able to mistake
 * it for one.
 */
export const UNKNOWN_VOIVODESHIP = "unknown";

/**
 * Postal-code prefixes, as ranges over the first two digits.
 *
 * Ranges rather than a hundred literals because that is how Poczta Polska
 * assigned them — each run is one postal district — and a range is checkable
 * against the source in a way a flattened list is not. Together they cover
 * 00–99 exactly once, which `voivodeship.test.ts` enforces.
 */
const POSTAL_PREFIXES: readonly { from: number; to: number; code: VoivodeshipCode }[] = [
	{ from: 0, to: 9, code: "PL-MZ" }, // Warszawa, Płock, Siedlce
	{ from: 10, to: 14, code: "PL-WN" }, // Olsztyn, Elbląg
	{ from: 15, to: 19, code: "PL-PD" }, // Białystok, Łomża, Suwałki
	{ from: 20, to: 24, code: "PL-LU" }, // Lublin, Zamość, Puławy
	{ from: 25, to: 29, code: "PL-SK" }, // Kielce, Radom, Ostrowiec
	{ from: 30, to: 34, code: "PL-MA" }, // Kraków, Tarnów, Nowy Sącz
	{ from: 35, to: 39, code: "PL-PK" }, // Rzeszów, Przemyśl, Krosno
	{ from: 40, to: 44, code: "PL-SL" }, // Katowice, Częstochowa, Gliwice
	{ from: 45, to: 49, code: "PL-OP" }, // Opole, Nysa, Kędzierzyn-Koźle
	{ from: 50, to: 59, code: "PL-DS" }, // Wrocław, Wałbrzych, Legnica
	{ from: 60, to: 64, code: "PL-WP" }, // Poznań, Kalisz, Konin, Piła
	{ from: 65, to: 69, code: "PL-LB" }, // Zielona Góra, Gorzów, Żary
	{ from: 70, to: 79, code: "PL-ZP" }, // Szczecin, Koszalin, Stargard
	{ from: 80, to: 84, code: "PL-PM" }, // Gdańsk, Gdynia, Tczew
	{ from: 85, to: 89, code: "PL-KP" }, // Bydgoszcz, Toruń, Włocławek
	{ from: 90, to: 99, code: "PL-LD" }, // Łódź, Piotrków, Sieradz
];

/**
 * Cloudflare's `regionCode`, in both spellings a geo database might use.
 *
 * The docs say ISO 3166-2 without the country prefix — `"MZ"` — but the
 * standard renumbered Poland's subdivisions from digits to letters in 2015 and
 * geo databases have not all caught up. Accepting `"14"` beside `"MZ"` costs
 * sixteen lines and avoids attributing a whole country to the unknown bucket
 * because of a data vintage nobody here controls.
 */
const REGION_CODES: Readonly<Record<string, VoivodeshipCode>> = {
	DS: "PL-DS",
	KP: "PL-KP",
	LU: "PL-LU",
	LB: "PL-LB",
	LD: "PL-LD",
	MA: "PL-MA",
	MZ: "PL-MZ",
	OP: "PL-OP",
	PK: "PL-PK",
	PD: "PL-PD",
	PM: "PL-PM",
	SL: "PL-SL",
	SK: "PL-SK",
	WN: "PL-WN",
	WP: "PL-WP",
	ZP: "PL-ZP",
	// The pre-2015 numbering, alphabetical by Polish name in steps of two.
	"02": "PL-DS",
	"04": "PL-KP",
	"06": "PL-LU",
	"08": "PL-LB",
	"10": "PL-LD",
	"12": "PL-MA",
	"14": "PL-MZ",
	"16": "PL-OP",
	"18": "PL-PK",
	"20": "PL-PD",
	"22": "PL-PM",
	"24": "PL-SL",
	"26": "PL-SK",
	"28": "PL-WN",
	"30": "PL-WP",
	"32": "PL-ZP",
};

/** What the pipeline knows about where a signature came from. */
export interface RegionSignals {
	/** `NN-NNN` when the signer gave one. Validated before it gets here. */
	postalCode?: string | null;
	/** Two-letter country from `request.cf`. Anything but `PL` is ignored. */
	country?: string | null;
	/** First-level subdivision from `request.cf`. */
	regionCode?: string | null;
}

/**
 * The voivodeship a postal code names, or nothing when it names none.
 *
 * Returning nothing rather than a guess is what lets the caller fall through
 * to geo-IP: a prefix this table does not cover is a question this table
 * cannot answer, and answering it anyway would put a signature in a
 * voivodeship for no reason.
 */
function fromPostalCode(postalCode: string): VoivodeshipCode | undefined {
	const prefix = Number(postalCode.slice(0, 2));
	if (!Number.isInteger(prefix) || !/^\d{2}/.test(postalCode)) return undefined;

	return POSTAL_PREFIXES.find(({ from, to }) => prefix >= from && prefix <= to)?.code;
}

/** The voivodeship to store, postal code first and geo-IP second. */
export function resolveVoivodeship({
	postalCode,
	country,
	regionCode,
}: RegionSignals): VoivodeshipCode | typeof UNKNOWN_VOIVODESHIP {
	const declared = postalCode ? fromPostalCode(postalCode) : undefined;
	if (declared) return declared;

	// Only within Poland. A signer in Berlin has a `regionCode` too, and it is
	// not a voivodeship — attributing them to one would be inventing data.
	if (country === "PL" && regionCode) {
		const observed = REGION_CODES[regionCode.toUpperCase()];
		if (observed) return observed;
	}

	return UNKNOWN_VOIVODESHIP;
}

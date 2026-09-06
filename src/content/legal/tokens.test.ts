import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { interpolate, TOKEN_PATTERN } from "@/content/tokens";
import { LEGAL_TOKENS, PLACEHOLDER_VALUES } from "./tokens";

const TOKENIZED = resolve(__dirname, "tokenized");

const FIXTURES = readdirSync(TOKENIZED)
	.filter((name) => name.endsWith(".md"))
	.sort();

function read(name: string): string {
	return readFileSync(resolve(TOKENIZED, name), "utf8");
}

function tokensIn(text: string): string[] {
	return [...text.matchAll(TOKEN_PATTERN)].map((match) => match[1] as string);
}

describe("legal fixtures", () => {
	it("holds the texts the legal layer needs", () => {
		expect(FIXTURES).toEqual([
			"consent-public-list-organization.md",
			"consent-public-list-person.md",
			"consent-rodo-acknowledgment.md",
			"consent-updates.md",
			"inline-klauzula-informacyjna.md",
			"klauzula-rodo-podpisanie-petycji.md",
		]);
	});
});

describe("token vocabulary", () => {
	it.each(FIXTURES)("only uses known tokens in %s", (name) => {
		const unknown = tokensIn(read(name)).filter((token) => !LEGAL_TOKENS.includes(token as never));
		expect(unknown).toEqual([]);
	});

	it("documents no token the fixtures never use", () => {
		const used = new Set(FIXTURES.flatMap((name) => tokensIn(read(name))));
		expect([...LEGAL_TOKENS].filter((token) => !used.has(token))).toEqual([]);
	});

	it.each(FIXTURES)("resolves every placeholder in %s", (name) => {
		expect(interpolate(read(name), PLACEHOLDER_VALUES)).not.toMatch(/\{\{/);
	});
});

/**
 * The fixtures carry legal *wording* from the reference site, deliberately and
 * per the PRD. They must carry none of its *identity*: no organizer name or
 * address, no registration numbers, no contact address, no domain, no petition
 * name. Those all live behind tokens, so any literal of that shape appearing
 * here means a capture leaked through.
 *
 * Shape-based on purpose — writing the real values into a denylist would
 * reintroduce exactly the data this guards against.
 */
describe("no captured identity data", () => {
	const FORBIDDEN = [
		["an e-mail address", /[\w.+-]+@[\w-]+\.\w+/],
		["a registration number", /\b\d{9,}\b/],
		["a domain name", /\b[\w-]+\.(?:pl|org|com|eu|net)\b/i],
	] as const;

	it.each(
		FIXTURES.flatMap((name) => FORBIDDEN.map(([label, pattern]) => ({ name, label, pattern }))),
	)("$name contains no $label", ({ name, pattern }) => {
		expect(read(name)).not.toMatch(pattern);
	});
});

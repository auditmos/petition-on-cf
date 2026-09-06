import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

/**
 * Zero copy in components — the durable decision, made checkable.
 *
 * A component that still holds a sentence is a component that cannot be
 * translated, and the failure mode is quiet: the page renders, in one language,
 * and nobody notices until an English reader arrives. So the rule is enforced
 * here rather than trusted.
 *
 * What counts as copy is deliberately crude — a run of letters containing a
 * space — because the alternative is a clever heuristic that lets the next
 * sentence through. Class names, ids, `aria-*` values and imports are not
 * prose; the exclusions below say which of those are skipped, and each says
 * why. Anything that trips this and is genuinely not copy belongs in the
 * exclusions with a reason beside it, not deleted from the test.
 */
const COMPONENTS = resolve(__dirname);
const ROOT = resolve(__dirname, "..", "..");

/**
 * Shadcn writes these and a cloner adds more with one command. They are
 * vendored rather than authored, and what English they carry ("Toggle
 * Sidebar") is upstream's to translate, not this template's.
 */
const VENDORED = "ui";

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return entry.name === VENDORED ? [] : sourceFiles(path);
		if (!/\.tsx?$/.test(extname(path) === ".tsx" ? path : `${path}x`)) return [];
		if (/\.test\.tsx?$/.test(path)) return [];
		return [path];
	});
}

/**
 * Source with the parts that never reach a reader removed.
 *
 * Comments and imports are obvious. Thrown errors are the one judgement call:
 * `throw new Error("useTheme must be used within a ThemeProvider")` is
 * addressed to whoever wired the component tree wrong, fires only when the
 * application is already broken, and translating it would make a stack trace
 * harder to search rather than a page friendlier.
 */
function code(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1")
		.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "")
		.replace(/throw new \w+\([\s\S]*?\);/g, "");
}

/**
 * String and JSX-text literals that read as a sentence: at least two words of
 * letters. One-word literals are overwhelmingly identifiers — `"button"`,
 * `"podpisz"` as an element id — and a real one-word heading would be a heading
 * the content files can still own without this test noticing.
 */
function proseIn(source: string): string[] {
	const cleaned = code(source);
	const found: string[] = [];

	const quoted = cleaned.match(/"[^"\n]{4,}"|'[^'\n]{4,}'/g) ?? [];
	for (const literal of quoted) {
		const text = literal.slice(1, -1);
		// Tailwind class strings are many words and none of them are prose.
		if (/^[a-z0-9:/[\]().,%-]+(\s+[a-z0-9:/[\]().,%-]+)*$/.test(text)) continue;
		// A CSS media query — `(prefers-color-scheme: dark)` — reads as two
		// words to the check below and is addressed to the browser rather than
		// to a reader. It is the one syntax the class-string filter misses.
		if (/^\(\s*[\w-]+\s*:[^)]*\)$/.test(text)) continue;
		if (/\p{L}+\s+\p{L}+/u.test(text)) found.push(text);
	}

	// JSX text: what sits between a `>` and a `<` on its own.
	const jsxText = cleaned.match(/>[^<>{}\n]*\p{L}+[^<>{}\n]*</gu) ?? [];
	for (const chunk of jsxText) {
		const text = chunk.slice(1, -1).trim();
		if (/\p{L}+\s+\p{L}+/u.test(text)) found.push(text);
	}

	return found;
}

const FILES = sourceFiles(COMPONENTS);

describe("components hold no copy", () => {
	it("finds the components to check", () => {
		expect(FILES.length).toBeGreaterThan(5);
	});

	it.each(FILES.map((file) => relative(ROOT, file)))("%s renders no literal sentence", (file) => {
		expect(proseIn(readFileSync(resolve(ROOT, file), "utf8"))).toEqual([]);
	});

	// The exclusion has to stay one directory, and it has to stay the vendored
	// one — a growing skip list is how this rule stops meaning anything.
	it("skips only the vendored primitives", () => {
		expect(FILES.some((file) => file.includes(`/${VENDORED}/`))).toBe(false);
		expect(readdirSync(join(COMPONENTS, VENDORED)).length).toBeGreaterThan(0);
	});
});

#!/usr/bin/env tsx
/**
 * One-shot project bootstrap. Idempotent — safe to re-run.
 *
 * 1. Prompt once for kebab-case project name.
 * 2. Rename root package.json + wrangler.jsonc (skip if already renamed).
 * 3. Warn if wrangler.jsonc lacks env.staging / env.production blocks.
 * 4. Fan out *.example templates into per-environment files (skip if exists).
 * 5. Interview for this deployment's identity (see `personalize.ts`).
 * 6. Print a next-steps checklist.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { type Ask, personalize } from "./personalize";

/**
 * The project this run is bootstrapping.
 *
 * Normally the repository this file sits in. `INIT_PROJECT_ROOT` overrides it
 * so the tests can run the real script — process, stdin and all — against
 * throwaway copies of the files rather than against this repository, which is
 * the only way to prove that a piped run actually works end to end.
 */
const ROOT =
	process.env.INIT_PROJECT_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGINAL_WORKER_NAME = "tanstack-start-app";

type RenameTarget =
	| { file: string; mode: "package-name" }
	| { file: string; mode: "all-occurrences"; needle: string };
type EnvTemplate = { template: string; targets: string[] };
type RenameResult = "renamed" | "skipped" | "missing";
type FanoutResult = "copied" | "skipped" | "no-template";

const RENAME_TARGETS: RenameTarget[] = [
	{ file: "package.json", mode: "package-name" },
	{ file: "wrangler.jsonc", mode: "all-occurrences", needle: ORIGINAL_WORKER_NAME },
];

/**
 * Committed templates, and the per-environment files each one becomes. Both
 * follow the `<real file>.example` convention, so which template produces which
 * file is readable without consulting this list.
 */
export const ENV_TEMPLATES: EnvTemplate[] = [
	{ template: ".env.example", targets: [".env"] },
	{ template: ".dev.vars.example", targets: [".dev.vars", ".staging.vars", ".production.vars"] },
];

const WRANGLER_FILES = ["wrangler.jsonc"];
const REQUIRED_WRANGLER_ENVS = ["staging", "production"];

const NEXT_STEPS = [
	"Apply migrations to the local D1: pnpm run db:migrate:dev",
	"  No credentials needed — the local database is created on the spot.",
	"Start dev: pnpm run dev",
	"",
	"Before deploying:",
	"  Create the databases: wrangler d1 create <name> (once per environment)",
	"  Paste each id over the all-zero database_id placeholders in wrangler.jsonc.",
	"  Push the Turnstile secret to each environment it will run in:",
	"    wrangler secret put TURNSTILE_SECRET_KEY --env staging",
	"  The answer above only reached .dev.vars, which stays on this machine.",
	"(optional) Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in .env",
	"  or run `wrangler login` instead.",
];

// ── helpers ──────────────────────────────────────────────────────────

function abs(...segments: string[]): string {
	return path.join(ROOT, ...segments);
}

/**
 * One question at a time, pulling one line of stdin for each.
 *
 * Iterating the interface rather than calling `rl.question` per prompt is the
 * whole of what makes a piped run work. `question` waits for the *next* `line`
 * event, and on a pipe readline emits every buffered line the moment the chunk
 * arrives — so answers two onward are announced to nobody and lost, and the
 * run finishes having read exactly one of them. The async iterator pauses the
 * stream between pulls instead, so each question consumes exactly its own
 * line. Interactively the two are indistinguishable, which is what makes the
 * per-question version such a convincing mistake.
 *
 * A pipe that runs out reads as skipped, so `echo my-app | init-project`
 * renames the project rather than blocking on an answer that is not coming.
 */
function asker(): { line: (question: string) => Promise<string>; close: () => void } {
	const interactive = process.stdin.isTTY === true;
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: interactive,
	});
	const lines = rl[Symbol.asyncIterator]();
	return {
		line: async (question) => {
			process.stdout.write(question);
			const next = await lines.next();
			if (next.done) {
				process.stdout.write("\n");
				return "";
			}
			// A terminal echoes what was typed; a pipe does not, and without this
			// the transcript of a scripted run is every question on one line with
			// no sign of which answer went where.
			if (!interactive) process.stdout.write(`${next.value}\n`);
			return next.value.trim();
		},
		close: () => rl.close(),
	};
}

function readJson<T = unknown>(file: string): T {
	return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

function writeJson(file: string, value: unknown): void {
	fs.writeFileSync(file, `${JSON.stringify(value, null, "\t")}\n`, "utf-8");
}

function renamePackageJson(file: string, name: string): "renamed" | "skipped" {
	const pkg = readJson<{ name?: string }>(file);
	if (pkg.name === name) return "skipped";
	pkg.name = name;
	writeJson(file, pkg);
	return "renamed";
}

function renameAllOccurrences(file: string, name: string, needle: string): "renamed" | "skipped" {
	const content = fs.readFileSync(file, "utf-8");
	const replaced = content.replaceAll(needle, name);
	if (replaced === content) return "skipped";
	fs.writeFileSync(file, replaced, "utf-8");
	return "renamed";
}

function applyRename(target: RenameTarget, name: string): RenameResult {
	const file = abs(target.file);
	if (!fs.existsSync(file)) return "missing";
	if (target.mode === "package-name") return renamePackageJson(file, name);
	return renameAllOccurrences(file, name, target.needle);
}

function stripJsonc(content: string): string {
	return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function checkWranglerEnvs(file: string, required: string[]): string[] {
	if (!fs.existsSync(file)) return [`${file}: file not found`];
	let parsed: { env?: Record<string, unknown> };
	try {
		parsed = JSON.parse(stripJsonc(fs.readFileSync(file, "utf-8"))) as {
			env?: Record<string, unknown>;
		};
	} catch (e) {
		return [`${file}: parse failed (${(e as Error).message.split("\n")[0]})`];
	}
	const envs = parsed.env ?? {};
	return required.filter((e) => !envs[e]).map((e) => `${file}: missing env.${e}`);
}

/**
 * Copies one template to one target, unless the target is already there.
 *
 * Never overwriting is what makes the whole script re-runnable: by the second
 * run the targets hold real credentials, and a bootstrap step that clobbers
 * them is worse than one that was never run.
 */
export function fanoutEnv(template: string, target: string, root: string = ROOT): FanoutResult {
	const templatePath = path.join(root, template);
	const targetPath = path.join(root, target);
	if (!fs.existsSync(templatePath)) return "no-template";
	if (fs.existsSync(targetPath)) return "skipped";
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	fs.copyFileSync(templatePath, targetPath);
	return "copied";
}

function symbolFor(result: RenameResult | FanoutResult): string {
	if (result === "renamed" || result === "copied") return "✓";
	if (result === "skipped") return "·";
	return "✗";
}

// ── steps ────────────────────────────────────────────────────────────

function stepRename(name: string): void {
	console.log("[1/5] Rename project references");
	for (const target of RENAME_TARGETS) {
		const result = applyRename(target, name);
		console.log(`      ${symbolFor(result)} ${target.file} (${result})`);
	}
}

function stepVerifyWrangler(): void {
	console.log("\n[2/5] Verify wrangler env blocks");
	const warnings = WRANGLER_FILES.flatMap((w) => checkWranglerEnvs(abs(w), REQUIRED_WRANGLER_ENVS));
	if (warnings.length === 0) {
		console.log(`      ✓ all wrangler.jsonc declare ${REQUIRED_WRANGLER_ENVS.join(", ")}`);
		return;
	}
	for (const w of warnings) console.log(`      ⚠ ${w}`);
	console.log("      (warn-only — script does not modify wrangler structure)");
}

function stepFanoutEnv(): void {
	console.log("\n[3/5] Create per-environment env files");
	for (const { template, targets } of ENV_TEMPLATES) {
		for (const target of targets) {
			const result = fanoutEnv(template, target);
			const detail = result === "copied" ? `from ${template}` : result;
			console.log(`      ${symbolFor(result)} ${target} (${detail})`);
		}
	}
}

/**
 * The identity interview.
 *
 * Everything about which questions exist and what they do belongs to
 * `personalize`; this step owns only how a question looks on a terminal — the
 * current value offered in brackets, and Enter as the way to take it.
 */
async function stepIdentity(line: (question: string) => Promise<string>): Promise<void> {
	console.log("\n[4/5] Personalize this deployment");
	console.log("      Enter keeps what is shown. Answered values are not asked about again.\n");
	const ask: Ask = ({ question, current }) => line(`      ${question}\n      [${current || "—"}] `);
	const { written, kept } = await personalize(ask, ROOT);
	console.log(`\n      ✓ ${written.length} written, ${kept.length} left as they were`);
}

function stepNextSteps(name: string): void {
	console.log("\n[5/5] Next steps:\n");
	for (const step of NEXT_STEPS) console.log(`  ${step}`);
	console.log(
		`\n✓ Project "${name}" initialized. Re-run anytime — already-applied steps are skipped.`,
	);
}

// ── main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const { line, close } = asker();
	try {
		const name = await line("Project name (kebab-case): ");
		if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
			console.error("✗ Invalid name. Must be kebab-case (e.g. my-app).");
			process.exit(1);
		}

		console.log(`\n→ Initializing project: ${name}\n`);
		stepRename(name);
		stepVerifyWrangler();
		stepFanoutEnv();
		await stepIdentity(line);
		stepNextSteps(name);
	} finally {
		close();
	}
}

// Only when run as a command. Importing this file — as the tests do — must not
// leave a prompt waiting on stdin.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}

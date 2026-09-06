export type ErrorCode =
	| "VALIDATION"
	| "NOT_FOUND"
	| "CONFLICT"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "RATE_LIMITED"
	| "INTERNAL";

export class AppError extends Error {
	constructor(
		message: string,
		public code: ErrorCode,
		public status: number = 500,
		public field?: string,
	) {
		super(message);
		this.name = "AppError";
	}
}

/**
 * @public
 *
 * Nothing in this template returns a `Result` — the endpoints throw `AppError`
 * and let the Hono error handler map it. It ships anyway because it is half of
 * the convention `.claude/rules/error-handling.md` states and the README
 * documents: throw for the unexpected, return a `Result` when the caller has to
 * branch on failure without a try/catch. A cloner writing that second kind of
 * function should find the type already here, spelled the way the rules spell
 * it, rather than invent a fourth shape for it.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

/** Every message in an error's `cause` chain, outermost first. */
function causeChain(error: unknown): string[] {
	const messages: string[] = [];
	let current = error;
	while (current instanceof Error) {
		messages.push(current.message);
		current = current.cause;
	}
	return messages;
}

/**
 * The message that explains a failure, rather than the one that wraps it.
 *
 * Drizzle rethrows driver errors with `Failed query: <sql>` as the message and
 * the real error on `cause`; D1 in turn wraps workerd's. A log line built from
 * the outermost message says what was attempted and never why it failed.
 */
export function rootCauseMessage(error: unknown): string {
	return causeChain(error).at(-1) ?? String(error);
}

/**
 * Whether a failed write lost a race for a unique index.
 *
 * SQLite — and therefore D1 — reports this in the message rather than in a
 * code, so this matches text. The alternative is checking for a row first,
 * which is not a check but a race: the index is the only thing that decides.
 */
export function isUniqueViolation(error: unknown): boolean {
	return causeChain(error).some((message) => /UNIQUE constraint failed/i.test(message));
}

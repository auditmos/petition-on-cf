import { AppError, isUniqueViolation, rootCauseMessage } from "./errors";

/**
 * How a failed D1 statement actually arrives.
 *
 * The driver throws with a `D1_ERROR:` prefix and hangs the runtime's own error
 * off `cause`; Drizzle then wraps that again, and its `message` names the query
 * rather than the problem. Anything reading a database failure has to walk the
 * chain, so the fixtures here are chains.
 */
function d1Error(reason: string): Error {
	const runtime = new Error(`${reason}: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)`);
	return new Error(`D1_ERROR: ${reason}`, { cause: runtime });
}

function drizzleWrapped(cause: Error): Error {
	return new Error("Failed query: insert into signatures\nparams: ", { cause });
}

describe("AppError", () => {
	it("carries code, status, and optional field", () => {
		const err = new AppError("nope", "VALIDATION", 400, "email");
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("AppError");
		expect(err.message).toBe("nope");
		expect(err.code).toBe("VALIDATION");
		expect(err.status).toBe(400);
		expect(err.field).toBe("email");
	});

	it("defaults status to 500", () => {
		const err = new AppError("boom", "INTERNAL");
		expect(err.status).toBe(500);
		expect(err.field).toBeUndefined();
	});
});

describe("rootCauseMessage", () => {
	// Drizzle's own message is "Failed query: <sql>", which says what was asked
	// and nothing about what went wrong. A log carrying only that is a log that
	// costs a round trip to the database to interpret.
	it("reaches past a wrapper to the message that explains the failure", () => {
		const err = drizzleWrapped(d1Error("UNIQUE constraint failed: signatures.email"));

		expect(rootCauseMessage(err)).toMatch(/UNIQUE constraint failed: signatures\.email/);
		expect(rootCauseMessage(err)).not.toMatch(/Failed query/);
	});

	it("returns the message itself when nothing wraps it", () => {
		expect(rootCauseMessage(new Error("storage unavailable"))).toBe("storage unavailable");
	});

	it("stringifies whatever was thrown when it is not an Error", () => {
		expect(rootCauseMessage("oops")).toBe("oops");
		expect(rootCauseMessage(null)).toBe("null");
	});
});

describe("isUniqueViolation", () => {
	it("detects a duplicate reported directly by D1", () => {
		expect(isUniqueViolation(d1Error("UNIQUE constraint failed: signatures.email"))).toBe(true);
	});

	// The shape a query actually throws: the sign path (issue #4) catches this
	// one, not the bare driver error.
	it("detects a duplicate through Drizzle's wrapper", () => {
		const err = drizzleWrapped(d1Error("UNIQUE constraint failed: signatures.email"));

		expect(isUniqueViolation(err)).toBe(true);
	});

	it("returns false for a different constraint", () => {
		expect(isUniqueViolation(d1Error("NOT NULL constraint failed: signatures.email"))).toBe(false);
	});

	it("returns false when nothing in the chain names a constraint", () => {
		expect(isUniqueViolation(new Error("network"))).toBe(false);
	});

	it("returns false for non-Error inputs", () => {
		expect(isUniqueViolation(null)).toBe(false);
		expect(isUniqueViolation("oops")).toBe(false);
		expect(isUniqueViolation({ message: "UNIQUE constraint failed" })).toBe(false);
	});
});

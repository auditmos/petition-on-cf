import { vi } from "vitest";
import { checkDatabase } from "./queries";

/**
 * A D1 binding whose statements fail — the shape a Worker sees when the
 * database it is bound to is not answering. Only the surface Drizzle's D1
 * driver reaches for is implemented; anything else it touches should fail
 * loudly rather than be quietly stubbed.
 */
function unreachableD1(message: string): D1Database {
	const reject = () => Promise.reject(new Error(message));
	const statement = {
		bind: () => statement,
		all: reject,
		run: reject,
		first: reject,
		raw: reject,
	};
	return { prepare: () => statement, batch: reject, exec: reject } as unknown as D1Database;
}

describe("checkDatabase", () => {
	it("reports disconnected and logs structured JSON when the query throws", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			const result = await checkDatabase(unreachableD1("D1_ERROR: storage unavailable"));

			expect(result).toBe("disconnected");
			expect(spy).toHaveBeenCalledTimes(1);

			const arg = spy.mock.calls[0]?.[0];
			expect(typeof arg).toBe("string");
			const parsed = JSON.parse(arg as string) as Record<string, unknown>;
			expect(parsed.message).toBe("db health check failed");
			expect(parsed.error).toBe("D1_ERROR: storage unavailable");
		} finally {
			spy.mockRestore();
		}
	});
});

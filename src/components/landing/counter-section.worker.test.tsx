import { env } from "cloudflare:test";
import { renderToString } from "react-dom/server";
import { CounterSection } from "@/components/landing/counter-section";
import { countSignatures } from "@/db/signatures";
import { resetDatabase } from "@/db/test-support";

/**
 * The walking skeleton, end to end: the migration that ships is applied to a
 * real D1, the query that ships reads it, and the markup the browser receives
 * carries the number — before any client JavaScript has run.
 *
 * Everything here is the real thing except the route wrapper: TanStack Start's
 * server entry cannot boot inside `vitest-pool-workers` (its
 * `#tanstack-router-entry` virtual module only exists after a Start build), so
 * `src/server.worker.test.ts` covers dispatch and this covers the render.
 */
beforeEach(resetDatabase);

async function seed(count: number): Promise<void> {
	for (let i = 0; i < count; i++) {
		await env.DB.prepare(
			`INSERT INTO signatures (id, first_name, surname, email, city, consent_rodo)
			 VALUES (?, 'Anna', 'Kowalska', ?, 'Warszawa', 1)`,
		)
			.bind(crypto.randomUUID(), `signer-${i}@example.com`)
			.run();
	}
}

/** What the browser gets: the section rendered on the server, as a string. */
async function renderCounter(): Promise<string> {
	return renderToString(<CounterSection count={await countSignatures(env.DB)} />);
}

describe("landing counter, server-rendered from D1", () => {
	it("renders zero on an empty database", async () => {
		const html = await renderCounter();

		expect(html).toMatch(/>0</);
		expect(html).toContain("podpisów");
	});

	it("renders the number of rows D1 actually holds", async () => {
		await seed(3);

		const html = await renderCounter();

		expect(html).toMatch(/>3</);
		expect(html).toContain("podpisy");
	});

	// The count has to survive the trip through the markup, not just through the
	// query — a section that truncates or re-derives it is a bug this catches.
	// Formatting itself belongs to the component's own test; four digits go
	// ungrouped in Polish, so there is nothing to assert about separators here.
	it("carries a four-digit count into the markup unchanged", async () => {
		await seed(1234);

		expect(await renderCounter()).toContain(">1234<");
	});
});

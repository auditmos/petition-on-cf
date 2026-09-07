import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import type { SupporterPage } from "@/core/supporters";
import { readSupporters } from "@/db/signatures";

/**
 * The list's first page, read on the server.
 *
 * A server function for the same reason the counts are one: a loader runs in
 * the browser too on client-side navigation, and neither the D1 binding nor
 * the Drizzle driver belongs in a bundle the browser downloads.
 *
 * Only the first page. Every page after it is fetched from
 * `/api/signatures/supporters` by the section itself, because the reader asks
 * for those and nobody is waiting on them — where this one is in the HTML the
 * browser receives, which is what makes a list of public supporters something
 * a crawler and a reader with scripting off can both see.
 */
export const fetchSupporters = createServerFn({ method: "GET" }).handler(
	async (): Promise<SupporterPage> => readSupporters(env.DB),
);

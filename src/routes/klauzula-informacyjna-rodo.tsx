import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";
import { getContent } from "@/content";
import { buildHead } from "@/content/head";
import { legalDocumentPath } from "@/content/legal";

/**
 * Polish, served without a prefix because it is the default language.
 * Its twin is `src/routes/en/klauzula-informacyjna-rodo.tsx`.
 *
 * The document is Polish in both languages by decision; what differs is the
 * page around it. Everything either file could get wrong twice is decided in
 * `LegalPage`.
 */
const PATH = legalDocumentPath("rodoClause");

export const Route = createFileRoute("/klauzula-informacyjna-rodo")({
	head: () => buildHead("pl", PATH, getContent("pl").legal.documents.rodoClause),
	component: () => <LegalPage document="rodoClause" language="pl" />,
});

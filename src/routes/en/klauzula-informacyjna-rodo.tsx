import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";
import { getContent } from "@/content";
import { buildHead } from "@/content/head";
import { legalDocumentPath } from "@/content/legal";

/**
 * English, served under `/en`. Its twin is `src/routes/klauzula-informacyjna-rodo.tsx`.
 *
 * The document is Polish in both languages by decision; what differs is the
 * page around it. Everything either file could get wrong twice is decided in
 * `LegalPage`.
 */
const PATH = legalDocumentPath("rodoClause");

export const Route = createFileRoute("/en/klauzula-informacyjna-rodo")({
	head: () => buildHead("en", PATH, getContent("en").legal.documents.rodoClause),
	component: () => <LegalPage document="rodoClause" language="en" />,
});

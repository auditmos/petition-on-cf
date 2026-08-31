# Plan: Public Petition Site Template (150proc.pl-style)

> Source PRD: https://github.com/auditmos/petition-on-cf/issues/1

## Architectural decisions

Durable decisions that apply across all phases:

- **Deployment model**: one petition = one deployment. No multi-petition support anywhere in the data model or UI.
- **Architecture style**: Cloudflare-native full stack inherited from tstack-on-cf — TanStack Start (SSR) + Hono API on Workers. D1 (SQLite, Drizzle ORM) is the **single source of truth**; one `LiveCounter` Durable Object per deployment is a cache + broadcaster only, never a write path. Write flow: Worker → D1 → fire-and-forget DO notify.
- **Data model**: single `signatures` entity — first name, surname, e-mail (unique, dedup key), city (display-only free text), signer type (person/company), company name (nullable), voivodeship code (from Cloudflare geo-IP `regionCode`, ISO 3166-2:PL), three consent flags (RODO acknowledgment — required; public-list consent; updates consent), created-at. Schema is petition-agnostic; no petition entity exists.
- **Live transport**: WebSocket with DO Hibernation API, broadcasts coalesced to ~1/sec; client falls back to polling the snapshot endpoint. SSE explicitly rejected (DO duration billing).
- **Trust pipeline**: Cloudflare Turnstile (official always-pass test keys as shipped defaults) + per-IP rate limit + unique-e-mail dedup. No e-mail verification, no e-mail provider, ever (PRD scope).
- **Content externalization**: zero copy in components. Identity values in a site config file (written by `init-project`); all copy in per-language content files (PL/EN) validated by one Zod schema with key parity enforced; legal texts as tokenized Markdown copied **verbatim** from 150proc.pl. Legal documents Polish-only with an EN notice.
- **i18n**: path-based — `/` = Polish (default), `/en/*` = English; hreflang + localized OG tags.
- **Two-path deploy**: "Deploy to Cloudflare" button → working placeholder demo (auto-provisioned D1 + DO, migrations in deploy command, test Turnstile keys); `init-project` → personalization pass, push, CI redeploys.
- **No auth anywhere**: public site, no admin surface. Organizer data access = documented `wrangler d1` export queries in the README.
- **Toolchain**: tstack-on-cf conventions preserved — strict TS, Zod at boundaries, Biome, Vitest, knip, semantic-release.

---

## Phase 1: D1 walking skeleton

**User stories**: 36, 37

### What to build

Swap the persistence layer from Neon Postgres to Cloudflare D1 and prove the whole stack end-to-end: a visitor loads the landing page and sees a total signature count (zero) read from D1 through Drizzle. Remove the tstack-on-cf demo domain (clients CRUD, example middleware/functions/demo components and their guard test) so the codebase starts clean. Create the `signatures` table migration per the durable data model. Local dev loop works against local D1; remote deploy works against a provisioned D1.

### Assumptions carried in

- tstack-on-cf template code is the starting point as generated; its toolchain (Biome, Vitest, knip, CI scripts) is healthy.
- Drizzle's D1 driver replaces the Neon driver without changing the migration workflow's shape (generate/apply per env).

### Out of scope for this phase

- No form, no writes — read-only count.
- No Durable Object, no Turnstile, no i18n.
- No changes to deploy-button plumbing yet (Phase 11).

### Acceptance criteria

- [ ] Landing page SSR-renders a total count sourced from D1 — [test: integration test seeds local D1, asserts rendered count]
- [ ] `signatures` migration applies cleanly to a fresh local D1 — [command: local migration apply exits 0 on empty DB]
- [ ] No Neon/Hyperdrive dependency or config remains — [command: repo-wide grep for neon/hyperdrive returns nothing; `pnpm knip` clean]
- [ ] Demo-domain code fully removed — [command: `pnpm knip && pnpm test` green after removal]
- [ ] Full toolchain green — [command: `pnpm lint && pnpm types && pnpm test` exits 0]

---

## Phase 2: Minimal sign path

**User stories**: 6, 11 (partial — success state; live tick arrives in Phase 5), 12

### What to build

The thinnest complete signing experience: a visitor fills first name, surname, e-mail, city, ticks a mandatory-consent checkbox (placeholder wording until Phase 7), submits, and sees a success state; reloading shows the count incremented. A duplicate e-mail gets a distinct, friendly "already signed" response with the count unchanged. Server side: one sign endpoint with Zod validation and unique-e-mail dedup on D1, plus a public snapshot endpoint (total count) that the page consumes — this same endpoint later becomes the polling fallback.

### Assumptions carried in

- Phase 1's schema and local D1 loop; no schema redesign, only additive migrations if needed.

### Out of scope for this phase

- No Turnstile, no rate limiting, no geo attribution (Phase 4).
- No person/company toggle, no real consent wording, no inline klauzula (Phase 7).
- No live updates (Phase 5); count refreshes on reload only.

### Acceptance criteria

- [ ] Happy path: valid submission persists a row and returns success — [test: integration test asserts row content + response]
- [ ] Duplicate e-mail returns "already signed" semantics, no second row — [test: integration test, count unchanged]
- [ ] Invalid payloads (missing field, bad e-mail, unticked mandatory consent) rejected with field-level errors — [test: validation test matrix]
- [ ] Snapshot endpoint returns the true D1 count — [test: seed N rows, assert snapshot == N]
- [ ] E2E: submit → success state → reload → count incremented — [test: browser E2E on local D1]

---

## Phase 3: Content module + PL/EN routing

**User stories**: 18, 23, 25, 29, 35

### What to build

Externalize every string and stand up bilingual routing. One Zod schema validates PL and EN content files (repeating sections — stats, FAQ — modeled as arrays even if not yet rendered); a typed content accessor interpolates `{{tokens}}` from the site config file; all copy introduced in Phases 1–2 moves out of components. Path-based i18n: root serves Polish, `/en` serves English; the switcher preserves the current page; hreflang and localized OG tags render server-side. Shipped content is honest generic placeholder demo copy in both languages.

### Assumptions carried in

- Phases 1–2 UI exists and is the refactor target; no visual changes, only copy relocation.
- Site config ships with placeholder identity values; `init-project` writes real ones later (Phase 10).

### Out of scope for this phase

- Legal Markdown pipeline and legal routes (Phase 7) — the schema reserves space, nothing renders.
- No new page sections; only existing UI is bilingualized.

### Acceptance criteria

- [ ] PL and EN content files validate against the schema; key parity enforced — [test: schema test fails on a fixture missing an EN key]
- [ ] No unresolved `{{token}}` and no hardcoded copy in rendered pages — [test: render test scans output; grep-style test over components for literal copy]
- [ ] `/` serves Polish, `/en` serves English, switcher preserves current route — [test: E2E]
- [ ] hreflang pair + localized OG tags present on both language roots — [test: SSR response assertion]
- [ ] Placeholder demo copy is visibly generic above the fold — [observable: fresh render shows placeholder petition name from site config]

---

## Phase 4: Trust pipeline

**User stories**: 10, 28, 33

### What to build

Harden the sign endpoint into the full trust pipeline: Turnstile widget on the form with server-side siteverify (shipping Cloudflare's official always-pass test keys as defaults, real keys via config/secret), a per-IP rate limit on the sign endpoint, and geo attribution — each signature stores its voivodeship code from Cloudflare request metadata at insert time. Pipeline order: validate → Turnstile → rate limit → geo → dedup/insert.

### Assumptions carried in

- Phase 2 sign endpoint is the single write path; this phase wraps it, no parallel endpoint.
- Test-key behavior: widget and siteverify succeed without human interaction in dev/CI.

### Out of scope for this phase

- No map rendering (Phase 6) — voivodeship codes are stored, not displayed.
- No WAF/dashboard configuration; rate limiting lives in the Worker so the template is self-contained.

### Acceptance criteria

- [ ] Missing/invalid Turnstile token → rejection; test-key token → pass — [test: integration tests for both paths]
- [ ] Burst over the per-IP limit → rate-limit response; under limit → success — [test: integration test with simulated IPs]
- [ ] New signatures carry a voivodeship code when region metadata is present, and a defined "unknown" bucket when absent — [test: insert with mocked request metadata, assert stored code]
- [ ] Real-key configuration path documented and consumed from secrets, never from content files — [observable: secret name in env typegen; README section]

---

## Phase 5: Live counter

**User stories**: 5, 11 (complete), 13, 22, 38

### What to build

The live layer. A `LiveCounter` Durable Object holds in-memory total + per-voivodeship counts, rebuilds them from D1 on cold start, accepts increment notifications from the sign path, and broadcasts over WebSockets using the Hibernation API with broadcasts coalesced to ~1/sec. The client consumes a connection hook: counter ticks live after signing; if the socket can't be established, the page silently degrades to polling the Phase 2 snapshot endpoint. The floating bottom bar ships here: hidden at top, appears after scrolling past the hero, shows the sign CTA + live count. Snapshot endpoint extends to include per-voivodeship counts (feeding Phase 6).

### Assumptions carried in

- Phase 4 pipeline is the only writer; DO increments arrive fire-and-forget from it.
- D1 remains truth; any DO/D1 divergence resolves by rebuild, never by writing D1 from the DO.

### Out of scope for this phase

- No map UI (Phase 6) — region counts flow through snapshot/broadcast unrendered.
- No reconnect storm engineering beyond the platform's WebSocket close/retry + polling fallback.

### Acceptance criteria

- [ ] DO cold-start rebuild equals a direct D1 count — [test: seed D1, destroy DO state, first request rebuilds correctly]
- [ ] Two connected clients both receive a broadcast within the coalescing window after a sign — [test: DO integration test with two sockets]
- [ ] 50-signature burst: final broadcast state equals D1 truth within ~1 s — [test: burst test asserts convergence threshold]
- [ ] Socket blocked → page falls back to polling and still refreshes — [test: E2E with WS disabled]
- [ ] Floating bar absent at top, appears after hero scroll, shows live count + CTA — [test: E2E scroll assertions]
- [ ] Signing ticks the visible counter without reload — [test: E2E completes story 11]

---

## Phase 6: Voivodeship map

**User stories**: 14

### What to build

An SVG Poland map with all 16 voivodeships, shaded by signature counts from the snapshot payload and updating live from the Phase 5 stream. Each region carries its count as accessible text (name + count), not color alone. Unknown-region signatures count toward the total without breaking the map.

### Assumptions carried in

- Phase 5 snapshot + broadcast already carry per-voivodeship counts keyed by ISO 3166-2:PL codes.

### Out of scope for this phase

- No world map, no abroad bucket UI (PRD assumption: Poland-centric v1).
- No per-city drill-down.

### Acceptance criteria

- [ ] Map renders 16 regions shaded from seeded snapshot data — [test: component test with fixture counts]
- [ ] Live update re-shades the affected region without reload — [test: E2E sign → region count increments]
- [ ] Region counts exposed as accessible text — [test: a11y assertion on region labels]
- [ ] Zero-signature and unknown-region states render sanely — [test: fixture tests for empty + unknown bucket]

---

## Phase 7: Full legal layer

**User stories**: 7, 8, 9, 19, 20, 26

### What to build

Prerequisite first: a real-browser inspection pass of 150proc.pl (it renders client-side) capturing the exact signature form field set, exact consent wording, and the inline klauzula text — legal texts verbatim, everything else structure-only. Then: the form gains the three real consent checkboxes (mandatory RODO acknowledgment; optional public-list consent; optional updates consent) with verbatim wording and tokenized proper nouns, the inline "Klauzula informacyjna" popup, and the osoba prywatna / firma toggle (firma reveals a required company-name field; type + company stored). Consent flags persist per signature. The tokenized legal Markdown pipeline renders two Polish-only routes — Klauzula informacyjna RODO and Polityka prywatności — linked from the checkboxes and footer, each carrying the one-line EN notice on the English side.

### Assumptions carried in

- Phase 3 content module handles tokens and reserved legal slots; this phase fills them.
- Site config placeholder values interpolate into legal texts until `init-project` (Phase 10) writes real ones.

### Out of scope for this phase

- No EN translation of legal documents (PRD out-of-scope).
- Supporters list rendering (Phase 8) — the public-list consent is stored, not yet consumed.

### Acceptance criteria

- [ ] Captured wording matches the live site verbatim (diff review at implementation time) — [observable: captured-text fixtures committed with source screenshots/notes]
- [ ] Mandatory consent unticked → validation error; optional consents stored as flags — [test: integration matrix]
- [ ] Firma toggle requires company name; stored type/company round-trips — [test: integration + E2E toggle behavior]
- [ ] Inline klauzula opens at the form with interpolated identity values — [test: E2E popup assertion]
- [ ] Legal routes render from Markdown with zero unresolved tokens; EN side shows the Polish-only notice — [test: SSR render assertions on both routes and both languages]

---

## Phase 8: Supporters list

**User stories**: 15

### What to build

The consent-gated public supporters list: a paginated section showing only signers who ticked the public-list consent — "Imię N., Miejscowość" for persons, company name for companies — newest first, fetched from D1 per page (deliberately not live). A seeded non-consenting signer must never appear in any page of results.

### Assumptions carried in

- Phase 7 consent flags and signer types exist in the schema and are populated.

### Out of scope for this phase

- No live-stream updates to the list (PRD decision D6).
- No search/filter within the list.

### Acceptance criteria

- [ ] Only consenting signers appear; non-consenting seeded signer absent from all pages — [test: integration test over seeded mix]
- [ ] Person renders as "Imię N., Miejscowość"; company renders as company name — [test: render test both formats]
- [ ] Pagination walks the full consenting set without duplicates or gaps — [test: integration pagination walk]
- [ ] List endpoint never exposes e-mail, full surname, or consent flags — [test: response-shape assertion]

---

## Phase 9: Full page anatomy

**User stories**: 1, 2, 3, 4, 16, 17, 21

### What to build

Complete the 150proc.pl-inspired single-page anatomy with generic placeholder content from the content files: hero (petition one-liner + primary CTA scrolling to the form), array-driven stats/evidence section where every figure renders its source, mechanism explainer, share section (Facebook, X, LinkedIn, WhatsApp share URLs + copy-link with the canonical language-aware URL), FAQ accordion (array-driven), and footer (organizer identity, legal links, social URLs from site config). A mobile pass at 375 px covers the whole page — form, map, floating bar, list included.

### Assumptions carried in

- All copy flows through Phase 3 content files; this phase adds structure and rendering only.
- Sections between the hero and the form don't alter the sign pipeline.

### Out of scope for this phase

- No Blog, no ScamWatch-like secondary service (PRD out-of-scope).
- No analytics, no cookie banner beyond what the legal pages state.

### Acceptance criteria

- [ ] All sections render in PRD order from content arrays; adding a stat/FAQ entry requires only a content-file edit — [test: render test with extended fixture]
- [ ] Hero CTA scrolls to and focuses the form — [test: E2E]
- [ ] Share buttons produce correct per-network share URLs; copy-link writes the canonical URL for the active language — [test: E2E href/clipboard assertions]
- [ ] FAQ accordion expands and collapses accessibly (keyboard + ARIA) — [test: E2E + a11y assertion]
- [ ] Full-page E2E suite passes at 375 px viewport — [test: mobile-viewport E2E run]
- [ ] Every stat entry renders its source line — [test: render assertion over stats fixture]

---

## Phase 10: init-project extension

**User stories**: 24, 27 (documentation half), 29 (finalized), 34

### What to build

Extend the inherited `init-project` script with the identity interview: petition display name, organizer/administrator legal name, organizer contact e-mail, petition addressee, public domain, optional social profile URLs, optional Turnstile site key, optional Turnstile secret. Public values land in the site config file; the Turnstile secret lands in local secrets, never in tracked files. The script stays idempotent — re-runs never overwrite filled-in values, and skipped optional prompts leave working defaults (test keys, placeholder socials). The README gains the organizer data-access section: ready-to-run `wrangler d1` export queries (full signature CSV; updates-consent e-mail list) with documented columns.

### Assumptions carried in

- Existing init-project behavior (rename, env fan-out, idempotency contract) from tstack-on-cf keeps working; this phase extends, not rewrites.
- Content/token pipeline (Phases 3, 7) consumes whatever the script writes with no further wiring.

### Out of scope for this phase

- No admin UI, no export endpoint (PRD decision D8).
- No non-interactive/CI personalization flow beyond what piped answers already allow.

### Acceptance criteria

- [ ] Scripted run with piped answers writes site config + secrets correctly — [test: script test asserts file contents]
- [ ] Second run over filled values is a no-op — [test: idempotency test compares before/after]
- [ ] Secret never appears in any tracked file — [test: script test + gitignore assertion]
- [ ] Personalized values appear in rendered legal texts and checkboxes after the script runs — [test: render test against script-written config]
- [ ] Both documented export queries run against seeded local D1 and yield documented columns — [command: query execution exits 0 with expected header row]

---

## Phase 11: Deploy button + pipeline

**User stories**: 27 (delivery half), 30, 31, 32, 33 (verification)

### What to build

Make the one-click path real. Wrangler config declares D1 and the DO migration so the "Deploy to Cloudflare" button auto-provisions both; the Workers Builds deploy command applies D1 migrations before deploying; Turnstile test keys are the shipped defaults so the fresh deploy signs successfully with zero configuration. The README leads with the deploy button, the two-path model (button → demo; clone + init-project → personalize; push → CI redeploys), the quick start, and a "before you go live" checklist (real Turnstile keys, personalization, legal review responsibility). Close with the full acceptance run in a clean Cloudflare account.

### Assumptions carried in

- All prior phases green; this phase adds plumbing and documentation, no feature code.
- PRD platform assumptions hold (button auto-provisions D1/DO; custom deploy command supported) — if not, this phase flags the PRD for revision per its Assumptions section.

### Out of scope for this phase

- No staging/production multi-env deploy-button flows — button targets one worker; the inherited env scripts remain for manual use.
- No semantic-release changes beyond what the template inherits.

### Acceptance criteria

- [ ] Button deploy in a clean account: site loads, D1 + DO provisioned, migrations applied — [observable: documented acceptance run with dashboard evidence]
- [ ] Fresh button deploy accepts a signature end-to-end on test keys — [observable: acceptance run signs successfully]
- [ ] Button-to-first-signature under 10 minutes with no local tooling — [observable: timed acceptance run]
- [ ] Deploy command provably runs migrations before deploy — [observable: Workers Builds log shows migration step preceding deploy]
- [ ] README contains button, two-path model, quick start, export queries, go-live checklist — [observable: README review against PRD checklist]
- [ ] Full suite green on the shipped template — [command: `pnpm lint && pnpm types && pnpm test && pnpm knip` exits 0]

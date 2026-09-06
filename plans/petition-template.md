# Plan: Public Petition Site Template (150proc.pl-style)

> Source PRD: https://github.com/auditmos/petition-on-cf/issues/1

## Architectural decisions

Durable decisions that apply across all phases:

- **Deployment model**: one petition = one deployment. No multi-petition support anywhere in the data model or UI.
- **Architecture style**: Cloudflare-native full stack inherited from tstack-on-cf — TanStack Start (SSR) + Hono API on Workers. D1 (SQLite, Drizzle ORM) is the **single source of truth**; one `LiveCounter` Durable Object per deployment is a cache + broadcaster only, never a write path. Write flow: Worker → D1 → fire-and-forget DO notify.
- **Data model**: single `signatures` entity — first name, surname, e-mail (unique, dedup key), city (display-only free text), postal code (nullable, `NN-NNN`), signer type (person/non-personal entity), entity name (nullable, column `company_name`), signer role in that entity (nullable), voivodeship code (ISO 3166-2:PL, derived postal-code-first with Cloudflare `regionCode` as fallback), three consent flags (RODO acknowledgment — required; public-list consent; updates consent), created-at. Schema is petition-agnostic; no petition entity exists.
- **Live transport**: WebSocket with DO Hibernation API, broadcasts coalesced to ~1/sec; client falls back to polling the snapshot endpoint. SSE explicitly rejected (DO duration billing).
- **Trust pipeline**: Cloudflare Turnstile (official always-pass test keys as shipped defaults) + per-IP rate limit + unique-e-mail dedup. No e-mail verification, no e-mail provider, ever (PRD scope).
- **Signer type wording is the deployment's choice.** A signature is either from a private person or from a non-personal entity, and the deployment picks the noun for the second: *firma*, *organizacja*, or another word that fits its campaign. `init-project` prompts for it (Phase 10). Because Polish declines nouns and the two candidates decline differently — "nazwy firmy" but "nazwy organizacji" — the config supplies the noun once per grammatical case the copy actually uses: mianownik for the toggle, dopełniacz for the name label and the public-list consent, miejscownik for the role label. The stored column stays `company_name`; the noun is presentation, not schema, and renaming it would buy a migration and nothing else.
- **Postal code is collected, always optional, and is the preferred region signal when given.** The form asks for it; a signature without one is valid, and the column is nullable. Attribution order is postal code → geo-IP → an explicit unknown bucket. Two caveats this buys, both real: Polish postal-code prefixes follow ten postal districts centred on major cities, **not** the sixteen voivodeship borders, so mapping needs a prefix table and stays approximate near boundaries — whereas Cloudflare's `regionCode` hands back an exact ISO 3166-2:PL code for free. The trade is worth it because geo-IP is confidently wrong for mobile and VPN signers, attributing them to a carrier's egress city, while a postal code is self-reported about where the signer actually lives. It also differs from the free-text city field the PRD rejected for map use: `NN-NNN` is structured and validatable, so its lookup is deterministic rather than a guess at "Wwa". Format is validated only when the field is non-empty.
- **The signer's role in the entity is optional, and collecting it at all is configurable.** "Twoja funkcja w organizacji" is worth asking when an association or NGO endorses and it matters who signs on its behalf; it is noise when a company signs under its own name. So the deployment decides whether the field appears, and the default follows the chosen noun — collected for *organizacja*, not for *firma*, overridable either way for a custom noun. When shown it is never required: a signature without it is valid. The column is nullable and always present, so the choice never becomes a migration.
- **Content externalization**: zero copy in components. Identity values in a site config file (written by `init-project`); all copy in per-language content files (PL/EN) validated by one Zod schema with key parity enforced; legal texts as tokenized Markdown copied **verbatim** from 150proc.pl. Legal documents Polish-only with an EN notice.
- **Visual design**: editorial-civic register modeled on Polish civic-data journalism (reference: openbooks.pl), accent rotated from crimson to blue. Display serif (Newsreader) for headlines and figures, IBM Plex Sans for everything else, both self-hosted latin/latin-ext only. Semantic tokens (`ink`/`paper`/`ground`/`quiet`/`divider`/`brand`) with the shadcn variables aliased onto them, so no component hardcodes a colour and re-branding is a token edit. Red and green mean outcome only, never identity. Full spec and rationale: `docs/decisions/visual-design-system.md`.
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

### Readiness review — 2026-09-05

**Status: ready to start issue #2; acceptance wording and inherited conventions need the clarifications below.** Reviewed open issues #1–#14 and their dependency lists against the current repository; none has additional decisions in comments. Issue #1 is the PRD, #2 is the first implementation task, #3 is an independent legal-capture task, and #14 is an upgrade report, not a prerequisite. No new product decision or dependency upgrade is required to start #2.

Baseline: `pnpm types`, `pnpm test` (209 tests in 25 files), `pnpm lint`, `pnpm knip`, and `pnpm build` all passed. Tests/build warn about missing database secrets; existing Workers tests supply stand-ins and do not prove database connectivity. An existing uncommitted change in `worker-configuration.d.ts` predates this review and was preserved. No application code or GitHub issue was changed by the review.

Clarifications to carry into #2:

- **Make the removal check achievable.** A literal repository-wide search cannot return zero: generated `worker-configuration.d.ts` includes the platform's `Hyperdrive` interface, Drizzle's lockfile metadata names optional adapters, and this plan records the migration history. The intended check should exclude platform-generated declarations, dependency metadata, and explicitly historical prose, while verifying no application import, direct dependency, binding, database credential, executable script, or current setup instruction uses the old database. Regenerate types/lockfile normally; do not hand-edit them to satisfy a text search.
- **Use the current cleanup inventory.** The repository now has a petition-template landing page and the accepted visual design system. Preserve that work while removing `src/db/client/`, `src/hono/api/clients.ts`, `src/routes/clients.tsx`, `src/components/clients/`, their references, and the old SQL migrations/seed. The named README-cleanup guard and example middleware/functions are not present under those names. Inspect actual tests instead: `src/readme-security-posture.test.ts` enforces the demo/auth narrative, `src/secrets-contract.test.ts` requires nonempty secrets, and DB/health tests assume the old driver. Update or remove obsolete assertions without discarding unrelated coverage.
- **Replace inherited database guidance with the implementation.** `.claude/rules/db/drizzle.md` currently requires `pgTable()`; `.claude/rules/db/neon.md` requires the old singleton/credentials; `docs/decisions/database-driver.md` still marks that driver accepted. PRD #1 and this plan take precedence. Update these rules, their references in `.claude/agents/`, the health query, setup/runbook guidance, and `init-project` next steps as part of the migration. The identity interview remains in #12.
- **Specify migration execution, not just the driver swap.** Recommended path: Drizzle generates SQLite SQL; Wrangler applies it to D1, retaining the existing per-environment generate/apply command names and migration-directory convention. Bind D1 explicitly for dev, staging, and production and align each `migrations_dir` with its generator output. Dev uses `--local`; remote commands select the environment explicitly. Local setup must need no external database credentials. Describe provisioning and manual remote migration separately from the button/Workers Builds automation reserved for #13. This follows the [D1 migration model](https://developers.cloudflare.com/d1/reference/migrations/) and [Wrangler migration commands](https://developers.cloudflare.com/d1/wrangler-commands/#migrations-apply).
- **Include a real SSR integration path in #2.** `vitest.config.ts` substitutes the application handler with `new Response("app")`; the jsdom project also does not exercise the route's HTTP SSR response. Keep dispatch tests, but add a test that applies the actual migration, seeds local D1, requests `/` through the real TanStack application, and asserts a visible count of 0 and then a nonzero seeded count in the returned HTML before browser JavaScript runs. A mocked count or component-only render cannot satisfy this acceptance criterion. Keep this coverage reachable from `pnpm test`.
- **Document schema conventions alongside the migration.** The field inventory is sufficient to start. Make the ID/timestamp representation, consent defaults, and nullable company/region fields explicit so #4/#6/#9 use one contract. Before #4 writes signatures, settle and test e-mail normalization for dedup; before #6 attributes regions, settle the normalized PL region representation. These are bounded implementation choices, not reasons to add more entities or a preparatory slice.

Later-slice findings, not blockers for #2:

- **#7 / Phase 5:** cold-start rebuild can already include the row whose increment notification woke the DO. Blindly incrementing after rebuilding double-counts it; a lost notification while the DO stays active can leave the cache stale indefinitely. Specify reconciliation with D1 and test both cases before claiming the PRD's convergence guarantee.
- **#11 / Phase 9:** its only declared blocker is #5, but its assumptions require the floating bar and its full-page mobile acceptance includes the map and supporters list. Section implementation can start after #5; full acceptance must wait for #7/#8/#10 (and their dependencies).
- **#12 / Phase 10:** the inherited idempotency assumption is only partly true. `renamePackageJson()` overwrites an already personalized package name on a different answer, whereas Worker-name replacement stops matching after the first rename. Cover the entire scripted rerun in #12; current tests mainly cover environment-file fan-out.

### Implementation — 2026-09-06

**Status: done.** `pnpm lint`, `pnpm types`, `pnpm test` (242 tests in 28 files), `pnpm knip` and `pnpm build` all pass. Verified by hand end to end: `pnpm db:migrate:dev` applies to a fresh local D1, `/` server-renders `0 podpisów`, one row inserted with `wrangler d1 execute` turns it into `1 podpis`, and `/api/health/ready` reports `database: connected`.

Decisions taken while implementing, binding on later slices:

- **Schema conventions** (documented in `src/db/signatures/table.ts`): UUID `TEXT` primary key defaulted in the application; `email` `UNIQUE` as the dedup key; booleans as `INTEGER NOT NULL DEFAULT 0` so a consent never given reads false rather than null; `created_at` as Unix seconds defaulted by the database rather than by the Worker's clock; `company_name` and `voivodeship_code` nullable. E-mail normalisation (#4) and PL region representation (#6) remain open, as planned.
- **Access shape**: `getDb(binding)` takes the `D1Database` as a parameter — no singleton, no `initDatabase()`. D1 has no connection to amortise, and the parameter is what lets a test hand a query its own database. `src/db/driver-boundary.test.ts` enforces that `src/db/setup.ts` stays the only importer of a driver.
- **Migration execution**: Drizzle generates (no credentials needed), Wrangler applies. `migrations_dir` per environment matches the matching `drizzle-<env>.config.ts` `out`, held together by `src/wrangler-config.test.ts`. `db:pull:*`, `db:studio` and `db:seed:*` were removed rather than ported — Studio needs a connection D1 does not offer, and the seed data was the demo domain's.
- **Placeholder database ids**: all-zero UUIDs in every environment, guarded by a test so a plausible-looking id cannot be shipped in their place.

Deviation from this review's SSR requirement, and why:

- **The real TanStack Start handler cannot boot inside `vitest-pool-workers`.** Wiring the actual server entry into the Workers project fails at `Missing "#tanstack-router-entry" specifier` — those virtual modules only exist after the Start plugin has run a full build, which the pool never provides. Requesting `/` through the real application from `pnpm test` is therefore not reachable without making `pnpm test` depend on `vite build`.
- **What shipped instead**: `src/components/landing/counter-section.worker.test.tsx` applies the shipped migration to a real D1 inside workerd, seeds it, runs the real Drizzle query, and server-renders the actual landing section with `react-dom/server`, asserting the count in the returned HTML. Migration, database, query and render are all real; the single uncovered link is the route's one-line loader, which was verified by hand as recorded above. `src/server.worker.test.ts` still covers dispatch.
- **If that link ever needs covering**, the route is to build first and drive `dist/server` under Miniflare as a separate suite. It was considered and declined here for the ~40–60s build it adds to every run.

---

## Phase 2: Minimal sign path

**User stories**: 6, 11 (partial — success state; live tick arrives in Phase 5), 12

### What to build

The thinnest complete signing experience: a visitor fills first name, surname, e-mail, city, optionally a postal code, ticks a mandatory-consent checkbox (placeholder wording until Phase 7), submits, and sees a success state; reloading shows the count incremented. A duplicate e-mail gets a distinct, friendly "already signed" response with the count unchanged. Server side: one sign endpoint with Zod validation and unique-e-mail dedup on D1, plus a public snapshot endpoint (total count) that the page consumes — this same endpoint later becomes the polling fallback.

### Assumptions carried in

- Phase 1's schema and local D1 loop; no schema redesign, only additive migrations if needed.

### Out of scope for this phase

- No Turnstile, no rate limiting, no region attribution (Phase 4) — the postal code is stored, not yet used.
- No signer-type toggle, no real consent wording, no inline klauzula (Phase 7).
- No live updates (Phase 5); count refreshes on reload only.

### Acceptance criteria

- [ ] Happy path: valid submission persists a row and returns success — [test: integration test asserts row content + response]
- [ ] Duplicate e-mail returns "already signed" semantics, no second row — [test: integration test, count unchanged]
- [ ] Invalid payloads (missing field, bad e-mail, unticked mandatory consent) rejected with field-level errors — [test: validation test matrix]
- [ ] Postal code is accepted when omitted and when well-formed, rejected only when present and malformed — [test: validation matrix over empty, `NN-NNN`, and junk; empty stores null]
- [ ] Snapshot endpoint returns the true D1 count — [test: seed N rows, assert snapshot == N]
- [ ] E2E: submit → success state → reload → count incremented — [test: browser E2E on local D1]

### Implementation — 2026-09-06

**Status: done.** `pnpm lint`, `pnpm types`, `pnpm test` (32 files) and `pnpm knip` all pass. Verified by hand in a browser against local D1: the form stores a signature, the count moves on reload, and the same address submitted again gets the "already signed" notice with the count unchanged.

Decisions taken while implementing, binding on later slices:

- **One schema, in `src/core/signature-input.ts`, validating on both sides.** The form and the endpoint parse the same Zod object, so they cannot drift into disagreeing about what a valid signature is. It lives in `core/` rather than in `src/db/signatures/` because that barrel re-exports query functions — importing it from a component would pull Drizzle and the D1 driver into the browser bundle. `.claude/rules/api/hono.md` was updated to say so; the inherited version pointed at `@/db/{domain}`.
- **E-mail normalisation is trim + lowercase, and it happens in the schema.** Settled here as issue #2 planned. Normalising before the format check means a trailing space is absorbed rather than rejected, and the value that reaches the unique index is the same for `Anna@Example.COM ` as for `anna@example.com`.
- **Dedup is the unique index's answer, never a lookup's.** `insertSignature` attempts the write and reads `isUniqueViolation` off the failure. A select-then-insert is not a check but a race: two concurrent submissions both find nothing and both insert.
- **A duplicate is an outcome, not an error.** `insertSignature` returns `{ status: "created" } | { status: "duplicate" }`; the endpoint maps the second to 409 with its own wording, and the form renders it as a notice rather than a failure.
- **Postal code shipped in an additive migration** (`0001_cooing_xorn.sql`, `ALTER TABLE ... ADD postal_code text`). Blank and absent both store null; a supplied value must be `NN-NNN`. Nothing reads it yet — Phase 4 does.
- **Validation messages are Polish and written by hand**, asserted verbatim in `src/core/signature-input.test.ts`. The library's defaults ("Too small: expected string to have >=1 characters") reached the rendered page in the first browser pass, which a test asserting merely "some string" could not catch. Like the rest of the form's copy they are hard-coded until Phase 3.
- **`@tanstack/react-form` was added** so the form follows `.claude/rules/frontend/form-patterns.md` rather than the rule being rewritten around a `useState` implementation. `useForm` + `form.Field` + `form.Subscribe`, submitting through `useMutation` with `mutate` (not `mutateAsync`, which turns a failed request into a rejected `handleSubmit` nobody catches).
- **Snapshot returns an object, not a number.** `{ data: { total } }` so Phase 5 can add per-voivodeship counts beside `total` without changing shape on every consumer.

Deviation from the E2E acceptance criterion, and why:

- **There is no browser test harness in this repository** — no Playwright, no Cypress — and adding one is a toolchain decision this slice should not make on its own. What covers the criterion instead: `src/hono/api/signatures.worker.test.ts` drives the real endpoint over HTTP inside workerd against a real migrated D1, and `src/components/signature-form/signature-form.test.tsx` drives the real form through its labelled controls under jsdom with only `fetch` stubbed. The seam between them — the browser actually posting to the Worker — was walked by hand as recorded above.
- **If that seam ever needs covering automatically**, it needs a browser runner and a built `dist/server` under Miniflare, which is the same shape as the deferred work Phase 1 recorded.

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

### Implementation — 2026-09-06

**Status: done, with one acceptance criterion deliberately unmet — see below.** `pnpm lint`, `pnpm types`, `pnpm test` (36 files) and `pnpm knip` all pass. Verified by hand: `/` renders Polish and `/en` English with `<html lang>` following the route, the switcher moves between them client-side, both roots carry the full mutual hreflang pair with `x-default` and their own canonical, and no `{{token}}` survives into either page.

Decisions taken while implementing, binding on later slices:

- **`src/content/site-config.ts` is the single identity source.** The legal fixtures' `PLACEHOLDER_VALUES` is now narrowed from it rather than declared beside it, so an organizer's name is written once and reads the same in a heading and in a consent checkbox. `LEGAL_TOKENS` stays an explicit list: the config is deliberately wider than the legal vocabulary, and a fixture reaching for an interface token is a mistake that list catches.
- **Interpolation moved up to `src/content/tokens.ts`**, shared by the UI copy and the legal fixtures. An unknown token is left standing rather than blanked — a visible `{{oops}}` gets fixed, a silent empty string is a sentence that reads fine and says the wrong thing.
- **`getContent(language)` validates and interpolates on every read.** Both are pure work over a few kilobytes of frozen literals; a memoised singleton would buy microseconds in exchange for a cache that has to stay correct across requests on a reused isolate.
- **Key parity is not a separate check.** Both files parse against one strict schema, so a translation missing a heading fails to parse. Repeating sections (stats, features, FAQ) are arrays even where nothing renders them, so the FAQ section will be a component change rather than a schema change.
- **Routing is mirrored route files** — `src/routes/index.tsx` and `src/routes/en/index.tsx`, each three lines naming a language and handing it to one `LandingPage` and one `buildHead`. Every decision the two could disagree about is made somewhere they both call.
- **Language is passed down, not read from the router**, except in the three places nothing can pass it: the document element, the not-found component and the error boundary, which use `useLanguage()`. That is what keeps components testable without a router.
- **`src/content/routing.ts` owns the prefix arithmetic**, and `/en` is matched as a whole first segment — `/energia` is a Polish page. The switcher, the hreflang pair and `<html lang>` all call it, so the awkward cases are settled once and tested once.
- **Validation messages became copy.** `createSignatureInputSchema(messages)` takes them from the content files; the rule is the same in every language, the sentence explaining it is not. The endpoint builds its schema with the default language and answers with `details[].field`, which is language-independent and is what a client keys off.
- **`.claude/rules/frontend/form-patterns.md` was followed rather than rewritten**, which is why `@tanstack/react-form` is now a dependency (recorded under Phase 2).
- **The base template's English leaked further than the landing page.** The not-found page, the error boundary and the theme control all held copy, and the error boundary mailed `support@example.com`. All three now read from the content module, and the report button mails the address in the site config.

Deviations, and why:

- **The demo-copy acceptance criterion is not met, by decision.** AC 5 asks for a placeholder petition name above the fold, which conflicts with this issue's own "no visual changes, only copy relocation" — the hero is template marketing, not a petition. Asked, and told to keep the marketing copy as it stands. The placeholder petition name does render, interpolated from the site config, in the sign section's heading ("Podpisz petycję „Nazwa petycji”"), so the token path is demonstrably live; it is simply not above the fold. Converting the hero into a demo petition is a deliberate later choice, most naturally alongside `init-project` in Phase 10.
- **The switcher's `[test: E2E]` is covered without a browser harness**, as in Phase 2. `src/content/routing.test.ts` drives the path arithmetic the switcher's promise rests on, including the cases a hand-written switcher gets wrong (`/energia`, query strings, fragments, round trips); the menu itself was exercised by hand.
- **`buildHead` is a module rather than inline route code** because `src/routes/**` is excluded from test discovery and TanStack Start's server entry cannot boot in the Workers pool. `src/content/head.test.ts` asserts the tags; the route's remaining job is the one line that calls it.
- **`src/components/no-hardcoded-copy.test.ts` is deliberately crude** — a run of letters containing a space counts as prose — because a cleverer heuristic is one that lets the next sentence through. It skips only `src/components/ui/**` (vendored), CSS media queries, and `throw new Error(...)` messages, which are addressed to whoever wired the tree wrong rather than to a reader. Each exclusion carries its reason in the file.

---

## Phase 4: Trust pipeline

**User stories**: 10, 28, 33

### What to build

Harden the sign endpoint into the full trust pipeline: Turnstile widget on the form with server-side siteverify (shipping Cloudflare's official always-pass test keys as defaults, real keys via config/secret), a per-IP rate limit on the sign endpoint, and region attribution — each signature stores a voivodeship code at insert time, derived from its postal code when one was given and from Cloudflare request metadata otherwise. Pipeline order: validate → Turnstile → rate limit → region → dedup/insert. The postal-code path needs a prefix→voivodeship table shipped with the template; see the durable decision on why the mapping is approximate near voivodeship borders and why it still beats geo-IP.

### Assumptions carried in

- Phase 2 sign endpoint is the single write path; this phase wraps it, no parallel endpoint.
- Test-key behavior: widget and siteverify succeed without human interaction in dev/CI.

### Out of scope for this phase

- No map rendering (Phase 6) — voivodeship codes are stored, not displayed.
- No WAF/dashboard configuration; rate limiting lives in the Worker so the template is self-contained.

### Acceptance criteria

- [ ] Missing/invalid Turnstile token → rejection; test-key token → pass — [test: integration tests for both paths]
- [ ] Burst over the per-IP limit → rate-limit response; under limit → success — [test: integration test with simulated IPs]
- [ ] A supplied postal code decides the voivodeship, overriding geo-IP even when the two disagree — [test: insert with a postal code and a conflicting mocked region, assert the postal-code answer wins]
- [ ] Without a postal code, signatures carry the geo-IP voivodeship, and a defined "unknown" bucket when that is absent too — [test: insert with mocked request metadata, assert stored code; then with neither]
- [ ] Every prefix in the shipped table resolves to a real voivodeship code, and unmapped prefixes fall through to geo-IP rather than guessing — [test: table completeness check; insert with an unmapped prefix]
- [ ] Real-key configuration path documented and consumed from secrets, never from content files — [observable: secret name in env typegen; README section]

### Implementation — 2026-09-06

**Status: done.** `pnpm lint`, `pnpm types`, `pnpm test` (471 tests in 39 files) and `pnpm knip` all pass. Verified by hand against `pnpm dev`: an absent token is refused 403, the test-key token stores a row, the sixth submission from one address inside a minute is refused 429 while a different address is unaffected, a `50-001` postal code stores `PL-DS`, and a browser signature through the real Turnstile widget stored `80-001` → `PL-PM`. The always-blocks key pair (`2x…`) was swapped in temporarily to watch the refusal path render, then reverted.

Decisions taken while implementing, binding on later slices:

- **The unknown bucket is the string `unknown`, not null.** Attribution always writes a value, so `GROUP BY voivodeship_code` yields an explicit row the DO (#7) and the map (#8) can count without either of them spelling out a null case. The column stays nullable — rows written before this slice keep their nulls, and no migration was needed.
- **Rate limiting is Cloudflare's `ratelimits` binding**, five per minute per `CF-Connecting-IP`, declared in `wrangler.jsonc` and repeated in every env block. It is simulated locally by Miniflare — including inside `vitest-pool-workers` — so the burst test is real rather than mocked. A request that arrives with no client address shares one `unattributed` bucket; on Cloudflare that only happens if it did not come through the edge.
- **A failed siteverify request is not a `false`.** `verifyTurnstile` returns a boolean for a verdict and lets a network failure propagate to the 500 handler, so an outage tells the signer "try again in a moment" rather than accusing them of being a robot.
- **The geo-IP path is guarded on `country === "PL"`.** Subdivision codes are unique only within a country: Lucerne is `CH-LU` and lubelskie is `PL-LU`, and Czech subdivisions are numeric like the pre-2015 Polish ones. Without the guard a Swiss signer lands in lubelskie. The resolver also accepts the legacy numeric `regionCode` spellings, since geo databases have not all adopted the 2015 letters.
- **The Turnstile widget is told the page's language.** Left alone the script reads the *browser's*, which rendered a Polish bot check on `/en`. `language` is drilled from the route the same way `NavigationBar` already receives it.

Correction to this phase's acceptance criteria:

- **"Unmapped prefixes fall through to geo-IP rather than guessing" cannot be exercised with a real postal code.** Poland uses all one hundred two-digit prefixes, so the shipped table covers `00`–`99` exactly once and no valid `NN-NNN` misses it. What shipped instead: the completeness test asserts total coverage with no gap or overlap, that every entry is one of the sixteen ISO codes, and that all sixteen are reachable, plus seventeen spot checks against known cities; the fall-through is tested at the resolver's own boundary, with input its table cannot read. The criterion as written assumed gaps that do not exist.

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

### Implementation — 2026-09-06

**Status: done.** `pnpm lint`, `pnpm types`, `pnpm test` (523 tests in 44 files), `pnpm knip` and `pnpm build` all pass. Verified by hand against `pnpm dev`: two WebSocket clients on one page both tick within a second of a signature; ten signatures in a row produce two pushes and land on D1's number; a duplicate produces none; the floating bar is absent at the top, appears past the hero with the count and the CTA, and goes away again on the way back up; a signature made from outside the browser moves the visible counter from 11 to 12 without a reload; and with `window.WebSocket` replaced by a throwing constructor, the page falls back to polling and picks up the next signature on its own.

Decisions taken while implementing, binding on later slices:

- **The notification carries no number, and the DO does no arithmetic.** `signatureRecorded()` says *that* a signature was stored; the object answers by re-reading D1 and broadcasting whatever came back. This is the answer to the readiness review's warning under Phase 1: adding one to a cold-start rebuild double-counts the row that woke the object, and there is no counter-side arithmetic left to get wrong. The cost is one `GROUP BY` per coalescing window per deployment — not per signature and not per reader.
- **One alarm is the object's whole clock.** `ctx.storage.setAlarm` rather than `setTimeout`, because a timer belongs to the request that created it and this object is built to be evicted between requests. `#scheduleAt` only ever brings the alarm forward, so a burst of notifications collapses into the one alarm already set. The same alarm doubles as a 30-second reconciliation heartbeat while at least one socket is attached — the second half of the review's warning, since a fire-and-forget notification can be dropped and would otherwise leave every connected reader permanently one short. It stops rescheduling itself when nobody is attached, so an idle petition pays nothing.
- **The snapshot endpoint reads D1, not the DO.** It is the fallback for when the socket path is unavailable, so routing it through the object it falls back from would put both in one failure domain. It answers `{ total, byVoivodeship }` — the same shape the socket broadcasts, so a page that lost its connection renders the object it was already rendering.
- **`countSignatures` became `readSignatureCounts`**, one `GROUP BY` returning total and per-voivodeship counts together. Two queries would let the headline number disagree with the sum of the map's parts. Rows written before #6 carry a null `voivodeship_code` and are coalesced into the same `unknown` bucket #6 writes explicitly. Only codes D1 holds appear — zero-filling the other fifteen is the map's decision in #8, not a count query's.
- **`SignatureCounts` lives in `src/core/signature-counts.ts` as a Zod schema**, because two of its three consumers are network boundaries the browser reads from. It is the same trap `src/core/signature-input.ts` documents: taking the type from `@/db/signatures` would put Drizzle and the D1 driver on the browser's import graph.
- **Sockets are accepted with `ctx.acceptWebSocket`, and a test proves it.** Flipping it to `server.accept()` fails four tests, including one that evicts the object and asserts the socket still receives broadcasts. A page left in a background tab is the normal case for a petition, and the difference is whether the deployment pays for an object behind every one of them.
- **`durable_objects` is repeated in all three env blocks; `migrations` is stated once.** Wrangler does not inherit the first and does inherit the second. `src/wrangler-config.test.ts` now also asserts that the bound class is declared in a migration and exported from the Worker entry — three ways to break a deploy that all look fine at `pnpm dev`.
- **The Node vitest project stubs `cloudflare:workers`.** The Hono router now imports the endpoint that addresses the DO, so every Node-side test touching `apiHono` has the class on its import graph, and Node cannot resolve a `cloudflare:` specifier at all. The stub is an empty base class, mirroring the existing `stubAppEntry` plugin; the real object runs on the real runtime in the Workers project.
- **`useLiveCount` returns a number, not the counts.** The per-voivodeship split travels over the wire and through the snapshot endpoint unrendered, exactly as this phase's scope says; the hook widens in #8 when the map is what reads it.
- **The floating bar watches the hero with an `IntersectionObserver`, not a scroll offset.** The hero's height is whatever its copy needs, in whichever language, at whichever width — a pixel threshold would be wrong on a phone or wrong on a desktop and could not be right on both. It renders nothing rather than something hidden, so it is never in the tab order while it is invisible, and it is deliberately not a live region: the counter section's `output` already announces, and two would announce every signature twice.
- **Two pieces of copy were rewritten because the feature made them false.** The counter's note told readers to reload, and the success note said the same; both now describe a number that moves on its own and a fallback that happens in silence.

Deviations from the acceptance criteria, and why:

- **The three `[test: E2E]` criteria have no browser harness**, as in Phases 2 and 3 — there is still no Playwright or Cypress here, and adding one is a toolchain decision a feature slice should not make alone. What covers them instead: `src/live/live-counter.worker.test.ts` drives the real Durable Object in workerd over real WebSockets against a real migrated D1 (cold-start rebuild, two-client broadcast, a 50-signature burst, hibernation across an eviction, the heartbeat, and the stop when nobody is listening); `src/hono/api/live.worker.test.ts` and `src/hono/api/signatures.worker.test.ts` drive the HTTP surface; and `use-live-count.test.tsx`, `floating-bar.test.tsx` and `landing-page.test.tsx` drive the page under jsdom with only the network and `IntersectionObserver` stubbed. The seam between them — a real browser, scrolling, on a real socket — was walked by hand as recorded above.
- **The burst test asserts convergence as a deadline, not as a stopwatch reading.** `vi.waitFor(..., { timeout: 2000 })` failing *is* the threshold assertion; a measured elapsed time compared against a constant would be the same claim with a flake in it. The observed shape is four pushes for fifty signatures, so the coalescing assertion has real margin rather than passing because the alarm happens to batch.

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

Prerequisite first: a real-browser inspection pass of 150proc.pl (it renders client-side) capturing the exact signature form field set, exact consent wording, and the inline klauzula text — legal texts verbatim, everything else structure-only. Then: the form gains the three real consent checkboxes (mandatory RODO acknowledgment; optional public-list consent; optional updates consent) with verbatim wording and tokenized proper nouns, the inline "Klauzula informacyjna" panel, and the osoba prywatna / *&lt;configured noun&gt;* toggle — the second option reveals a required entity-name field, and the public-list consent switches to its organisation wording, which is a second consent text rather than a variant of the first. Type + entity name stored. Consent flags persist per signature. The tokenized legal Markdown pipeline renders two Polish-only routes — Klauzula informacyjna RODO and Polityka prywatności — linked from the checkboxes and footer, each carrying the one-line EN notice on the English side.

### Assumptions carried in

- Phase 3 content module handles tokens and reserved legal slots; this phase fills them.
- Site config placeholder values interpolate into legal texts until `init-project` (Phase 10) writes real ones.

### Out of scope for this phase

- No EN translation of legal documents (PRD out-of-scope).
- Supporters list rendering (Phase 8) — the public-list consent is stored, not yet consumed.

### Acceptance criteria

- [ ] Captured wording matches the live site verbatim (diff review at implementation time) — [observable: captured-text fixtures committed with source screenshots/notes]
- [ ] Mandatory consent unticked → validation error; optional consents stored as flags — [test: integration matrix]
- [ ] Non-person toggle requires the entity name; stored type/name round-trips — [test: integration + E2E toggle behavior]
- [ ] The configured signer noun renders in the toggle, both entity field labels and the public-list consent, in the right grammatical case for each — [test: render with two different configured nouns, assert no nominative leaks into a declined slot]
- [ ] The role field appears only when the deployment collects it, and is never required when it does — [test: render under both settings; submit with the field shown and left empty, assert success and a null column]
- [ ] Inline klauzula opens at the form with interpolated identity values — [test: E2E popup assertion]
- [ ] Legal routes render from Markdown with zero unresolved tokens; EN side shows the Polish-only notice — [test: SSR render assertions on both routes and both languages]

### Capture done — 2026-09-06 (issue #3)

**Status: the prerequisite capture pass has landed; four of its findings are open decisions this phase must settle before writing the legal layer.** Fixtures, provenance, method and the full finding list are in `src/content/legal/capture/README.md`.

Only tokenized fixtures are committed. No identity value from the reference campaign is stored in this repository — not its organizer's name, address or registration numbers, not its documents, and not screenshots of its site, whose recent-signatures panel shows real signers' names and towns. `src/content/legal/tokens.test.ts` fails if an e-mail address, a registration-number-shaped digit run or a bare domain ever reappears in a fixture, and `src/content/legal/tokens.ts` ships only generic placeholder identity values.

What the capture changes about this phase's description above:

- **The legal documents are PDFs, not pages.** The reference site links `/dokumenty/*.pdf`. Serving them as real routes stays right; the source is just a PDF rather than a page scrape.
- **There are four consent texts, not three.** The public-list consent is rewritten for organisations. One stored flag still suffices; the rendered wording has to switch with the signer type.
- **The reference toggle is `organizacja`, not `firma`, and it adds two fields** — the entity name (required) and the signer's role in it (optional). **Resolved 2026-09-06**, per the two durable decisions above: the deployment chooses the noun, and it chooses whether the role field appears at all (default on for *organizacja*, off for *firma*). `signerOrgNounGen` is already tokenized in the public-list consent; the toggle and label forms come from the content module. Phase 1 shipped `company_name` and no role column, so this phase — the one that introduces the toggle — carries the additive nullable migration for it.
- **Polish declension defeats naive tokenization.** The organizer's short name appears in four grammatical cases across the wording. One token cannot decline a noun, so the vocabulary carries one token per case and the site config must supply each form. Anything generating legal text from these fixtures has to pick the right case, not the nominative everywhere.
- **Campaign-specific processing was baked into the source texts**, which is why the reference privacy policy was not kept at all and only the petition-signing clause survived from the RODO document. The general rule for this phase: a clause describing processing the deployment does not perform is worse than no clause, so whatever #9 authors must match what this template actually does. It needs its own privacy policy written here.
- **No addressee token exists.** 150proc.pl never names its addressee in legal text, so the token vocabulary has no slot for one despite issue #3 listing it.

Also observed, for phases other than this one: the live form requires a postal code (**resolved:** this template collects one too but always optional, and prefers it over geo-IP — see the durable decisions and Phase 4), the share row's fifth action copies a full prepared message rather than a link (Phase 9, PRD story 16 says "copy-link"), and the FAQ is a single-open accordion of eight items (Phase 9).

---

## Phase 8: Supporters list

**User stories**: 15

### What to build

The consent-gated public supporters list: a paginated section showing only signers who ticked the public-list consent — "Imię N., Miejscowość" for persons, the entity name for non-personal signers — newest first, fetched from D1 per page (deliberately not live). A seeded non-consenting signer must never appear in any page of results.

### Assumptions carried in

- Phase 7 consent flags and signer types exist in the schema and are populated.

### Out of scope for this phase

- No live-stream updates to the list (PRD decision D6).
- No search/filter within the list.

### Acceptance criteria

- [ ] Only consenting signers appear; non-consenting seeded signer absent from all pages — [test: integration test over seeded mix]
- [ ] Person renders as "Imię N., Miejscowość"; a non-personal signer renders as its entity name — [test: render test both formats]
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

Extend the inherited `init-project` script with the identity interview: petition display name, organizer/administrator legal name, organizer contact e-mail, petition addressee, public domain, the signer-type noun, optional social profile URLs, optional Turnstile site key, optional Turnstile secret. Public values land in the site config file; the Turnstile secret lands in local secrets, never in tracked files. The script stays idempotent — re-runs never overwrite filled-in values, and skipped optional prompts leave working defaults (test keys, placeholder socials). The README gains the organizer data-access section: ready-to-run `wrangler d1` export queries (full signature CSV; updates-consent e-mail list) with documented columns.

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
- [ ] The signer-type prompt offers *firma* and *organizacja* as picks, accepts a custom noun, and writes all the grammatical cases the copy needs — [test: script test for both offered nouns and one custom answer, asserting the declined forms land in the config]
- [ ] The role-field prompt defaults to on for *organizacja* and off for *firma*, and the answer is overridable — [test: script test asserts the default per noun and that an explicit answer wins]
- [ ] The organizer short name is likewise captured in every case the legal texts decline it into — [test: script test asserts each case is written and non-empty]
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

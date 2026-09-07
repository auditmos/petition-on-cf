# petition-on-cf

Public petition site template on Cloudflare Workers — one deployment = one petition, modeled on 150proc.pl. TanStack Start frontend + Hono API. **In active development**: eleven of the twelve slices have landed, so the site signs, counts, maps, publishes, reads as a petition rather than as the tstack-on-cf base it started from, and personalizes itself through `init-project`. What remains is the Deploy to Cloudflare pipeline.

## Before implementing anything

1. **PRD**: [issue #1](https://github.com/auditmos/petition-on-cf/issues/1) — problem, user stories, decisions, assumptions, validation strategy.
2. **Plan**: `plans/petition-template.md` — durable architectural decisions + 11 phased slices.
3. **Work items**: issue #13 is what is left (label `HITL`), with agent-verifiable acceptance criteria. Implement exactly what the issue scopes — nothing extra. Issues #2–#12 are closed; what was decided while implementing them is recorded per phase in the plan, not in the issues.

Durable decisions every slice must respect (full list in the plan header):

- **D1 is the single source of truth.** The `LiveCounter` Durable Object is cache + broadcaster only: WebSocket Hibernation API, broadcasts coalesced ~1/sec, counts rebuilt from D1 on cold start. Write flow is Worker → D1 → fire-and-forget DO notify. The DO never writes D1.
- **One `signatures` entity** — first name, surname, unique e-mail (the dedup key), city (display-only free text), optional postal code, person/company type + company name + optional signer role, voivodeship code (postal code first, `request.cf` region as fallback), three consent flags, created-at. No petition entity exists.
- **Trust pipeline order**: validate → Turnstile siteverify (official test keys are the shipped defaults) → per-IP rate limit → geo attribution → dedup/insert. No e-mail sending or e-mail provider, ever.
- **Zero copy in components** — all copy lives in Zod-validated per-language content files with `{{token}}` interpolation from the site config; legal texts are tokenized Markdown fixtures — verbatim from 150proc.pl except the privacy policy, which is authored here — and stay Polish-only in both languages.
- **i18n**: `/` = Polish (default), `/en/*` = English; hreflang + localized OG tags.
- **No auth surface anywhere** — no admin UI, no protected endpoints; organizer data access is documented `wrangler d1` export queries.

## Current state

Issues #2 through #12 have landed: D1 persistence, the legal text capture, a working sign path, the bilingual content module, the trust pipeline, the live counter, the voivodeship map, the full legal layer, the public supporters list, the full page anatomy, and the `init-project` identity interview.

- **Persistence** — `getDb(binding)` in `src/db/setup.ts` is the only module that imports a driver (`src/db/driver-boundary.test.ts` enforces it). Queries take the `D1Database` binding as a parameter — there is no singleton and no `initDatabase()`. The local loop needs no credentials: `pnpm run db:migrate:dev`. `wrangler.jsonc` ships all-zero placeholder `database_id` values; real ones come from `wrangler d1 create`.
- **Sign path** — `POST /api/signatures` (validate → dedup → insert) and `GET /api/signatures/snapshot`. One schema, `createSignatureInputSchema` in `src/core/signature-input.ts`, validates in the form and again in the endpoint, taking its messages from the content files. Dedup is the unique index's answer read through `isUniqueViolation`, never a lookup. The full pipeline runs in front of it — validate → Turnstile → per-IP rate limit → voivodeship attribution — and a stored row ends with a fire-and-forget notification to the live counter.
- **Content and i18n** — `src/content/` is the only place copy lives. `getContent(language)` validates a per-language file against one schema and interpolates `{{tokens}}` from `site-config.ts`; `src/components/no-hardcoded-copy.test.ts` fails the build if a component holds a sentence. `/` is Polish and `/en` English, as mirrored route files delegating to one `LandingPage`; `src/content/routing.ts` owns the prefix arithmetic, and `buildHead` owns the hreflang pair and the localized OG tags.
- **Live counter** — `src/live/live-counter.ts` is the `LiveCounter` Durable Object: one per deployment, addressed through `liveCounter(env)`, upgraded to over `GET /api/live`, accepting sockets with `ctx.acceptWebSocket` so it can hibernate under them. Its notification carries no number — it re-reads D1 and broadcasts, coalesced to ~1/sec through its own alarm, with that alarm doubling as a 30s reconciliation heartbeat while anybody is connected. The page consumes it through `useLiveCounts`, which degrades to polling the snapshot endpoint in silence and hands the whole `SignatureCounts` to the three things that render it: `CounterSection`, `FloatingBar` once the hero is off screen, and the map.
- **Voivodeship map** — `src/components/map/voivodeship-map.tsx` draws the sixteen regions from `geometry.ts`, vendored MIT outlines re-keyed to the ISO 3166-2:PL codes the pipeline stores. Shading is four discrete steps measured against the strongest region, and it is never the only channel: every region’s name and count are written out beside the map from `content.map.regions`. D1 returns only the codes it holds, so the map zero-fills the rest; whatever `total` exceeds the sixteen is shown as one unattributed bucket, derived by subtraction so the parts always add up. Pointing at a region answers immediately in the page’s own readout — cursor-following, region outlined, list row lit — rather than through an SVG `<title>`, which needs a second of dwell and shows text Chromium caches after the count has moved.
- **Legal layer** — `src/content/legal/` is the module: `getLegalText(name)` returns any of the seven tokenized fixtures with the site config interpolated in, and `LEGAL_DOCUMENT_NAMES`/`legalDocumentPath` cover the two that are also pages. `LegalText` parses the small Markdown dialect the fixtures use straight to React elements — no dependency, no HTML string, nothing to sanitise — and re-prefixes internal links to the reader's language; `LegalSentence` is the same without a block wrapper, for a consent that lives inside its checkbox's label element. The RODO clause and the privacy policy are served at the paths the site config names, through four three-line route files delegating to `LegalPage`; `src/content/legal/index.test.ts` fails if a configured path has no route file. The documents and the consents stay Polish in both languages, with `content.legal.polishOnlyNotice` on the English side. The privacy policy is the one fixture that was authored rather than captured — it describes only what this template actually does.
- **Supporters list** — `readSupporters(binding, cursor?)` in `src/db/signatures/queries.ts` is the whole of it: consent-gated in the `WHERE`, redacted in the `SELECT` (`substr(surname, 1, 1)`, so a surname never leaves D1), ordered `created_at DESC, id DESC` and paged by a keyset cursor rather than an offset, because the table is appended to while a reader has the page open. A page is 24 rows and the client cannot ask for more; one extra row is read to decide whether a next page exists. Published names are built server-side — `Imię N.` for a person, the entity's name and no city for anybody else — so nothing downstream can disagree about them. `GET /api/signatures/supporters` serves it and refuses a cursor it did not issue; `SupportersSection` renders the first page from the loader and fetches the rest when the reader asks. It is the one part of the page deliberately not live.
- **Signer type** — the form asks *osoba prywatna* or the noun this deployment configured, and the second reveals a required entity name plus an optional role (`COLLECT_SIGNER_ROLE` decides whether the role is asked at all). The noun is declined by the site config, one value per case — `signerOrgNoun`, `signerOrgNounGen`, `signerOrgNounLoc` — because Polish declines it and no single token can. Switching back to a private person clears the entity's details rather than hiding them.
- **Page anatomy** — the landing page is a petition, not a page about the template. Nine sections in one order, pinned by id in `landing-page.test.tsx`: hero → evidence → demands → counter → form → map → supporters → share → FAQ, then the footer. The hero's call to action is an anchor to `#podpisz` whose click also hands the cursor to the form's first field (`focusSignForm` in `sign-section.tsx`); the navigation may only name ids the landing page actually has, and a test fails if it does not. Its entries are `Link`s to those sections, not buttons: on the landing page the click is intercepted and scrolls in place with the URL untouched, and on the two legal pages — where the sections do not exist — the router follows the href and scrolls to the hash on arrival. Every statistic carries a mandatory `source` and an optional `sourceUrl`, so a figure without a citation cannot be written. Share links are hand-built intent URLs over `canonicalUrl(path, language)` from `head.ts` — no network script is ever loaded — and the copy-link button reports both clipboard outcomes, because a browser refuses the write without a user gesture. `share-links.tsx` is the one implementation of those five affordances; the share section renders it `labelled` and the floating bar renders it `compact` (icons, `sr-only` labels), so the two can never share different URLs. The FAQ is independent Radix collapsibles, so Enter and Space come from the `button` rather than from a key handler. The footer is the organizer's identity, the two legal documents, whichever social profiles `socialLinks(SITE_CONFIG)` finds configured (none ship), and one line crediting the template. The shipped copy is deliberately instructional placeholder — `00 000` beside "Nazwa raportu, instytucja, rok" — so a half-configured deployment reads as a demo rather than as somebody's campaign.
- **Personalization** — `scripts/personalize.ts` is the identity interview and `init-project` is where it runs; `personalize(ask, root)` is the whole interface, with `ask` injected so tests state answers instead of staging a terminal. Idempotency is a trailing `// placeholder` on every value the interview owns: the marker means "still what the template shipped", writing a real answer removes it, and an unmarked line is never asked about or rewritten — by this script or by the next person. An empty answer keeps what is there, so skipping is safe and re-runs are cheap. The signer noun declines from a table for *firma* and *organizacja* and is asked for its cases otherwise, the role toggle's default follows it, `siteUrl` is derived from the domain, and the Turnstile secret is the one answer that goes to `.dev.vars` instead of the config. `init-project` reads stdin through readline's async iterator rather than `rl.question`, which is what makes a piped run work at all; `INIT_PROJECT_ROOT` lets the tests run the real script against a throwaway project.
- **Organizer data access** — the two `wrangler d1` export queries in the README are the only way out of the database, and `src/db/signatures/export-queries.test.ts` reads them out of the README to check every identifier against the table and every documented column against what the query returns.
- Remaining issue (#13) defines the build order. Issue #15 is an open product question rather than a slice: the supporters list is deliberately not live while the counter and map beside it are, and whether that reads as intended is unresolved.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (Router + Query + SSR) |
| API | Hono on Cloudflare Workers |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) + Drizzle |
| Live updates | Durable Object + WebSocket hibernation |
| Bot protection | Cloudflare Turnstile |
| Styling | Tailwind CSS v4, Shadcn (new-york, Zinc, CSS vars) |
| Language | TypeScript (strict) |
| Linter | Biome |
| Package manager | pnpm |

## Project Structure

- `src/routes/` — file-based routes (auto-generates `routeTree.gen.ts`)
- `src/components/` — reusable React components
- `src/components/ui/` — Shadcn primitives (do not edit manually)
- `src/content/` — the only place copy lives: per-language files, one Zod schema, the site config, and `src/content/legal/` for the tokenized documents
- `src/hono/` — Hono API routes and factory
- `src/db/` — one directory per domain (`table.ts`, `queries.ts`, `index.ts`); `schema.ts` is what drizzle-kit reads
- `src/core/functions/` — TanStack server functions (server-only reads for route loaders)
- `src/live/` — the `LiveCounter` Durable Object and the way to address it
- `src/server.ts` — custom CF Workers entry (routes `/api/*` → Hono, rest → TanStack)
- `src/integrations/tanstack-query/` — query client setup and providers
- `plans/` — phased implementation plan (source of truth for slice scope)
- Path alias: `@/*` → `src/*`

## Commands

```bash
pnpm dev                  # dev server (port 3000)
pnpm build                # production build
pnpm serve                # preview production build
pnpm run deploy           # build + wrangler deploy (bare `pnpm deploy` is pnpm's own command)
pnpm test                 # run all tests
pnpm test:watch           # watch mode
pnpm test:coverage        # with coverage
pnpm types                # type-check (tsc --noEmit)
pnpm lint                 # biome check
pnpm lint:fix             # biome auto-fix
pnpm knip                 # unused files/deps/exports
pnpm deps                 # check for updates
pnpm deps:update          # apply minor updates
pnpx shadcn@latest add <component>  # add Shadcn component

# Database — Drizzle generates SQL, Wrangler applies it to D1
pnpm db:generate:dev      # generate migrations from src/db/schema.ts (dev)
pnpm db:generate:staging  # generate migrations (staging)
pnpm db:generate:production # generate migrations (production)
pnpm db:migrate:dev       # apply migrations to the local D1
pnpm db:migrate:staging   # apply migrations to the remote staging D1
pnpm db:migrate:production # apply migrations to the remote production D1
pnpm db:list:dev          # which migrations the local D1 still needs
pnpm db:seed:dev          # 195 demo signatures across the voivodeships (safe to re-run)

# Read or write the local database directly (also how you seed a row)
pnpm exec wrangler d1 execute DB --local --command "SELECT count(*) FROM signatures"
```

## Architecture

Prefer **deep modules** (Ousterhout): small interface hiding large implementation. Test at module boundaries, not internals. See `.claude/rules/deep-modules.md`. The template's three deep modules by design: the `LiveCounter` DO, the signature trust pipeline, and the content module.

Technology-specific rules live in `.claude/rules/api/`, `.claude/rules/db/` and `.claude/rules/frontend/` with scoped `paths:` frontmatter — they activate automatically when touching relevant files. The rules directly under `.claude/rules/` carry no scope and are always loaded.

## Verification

Max 500 lines per source file — split if exceeding.

<important if="you have finished implementing or modifying code">
Run manually before declaring done:
1. `pnpm types` — type-check
2. `pnpm test` — run all tests
3. `pnpm lint` — lint check
</important>

<important if="you are writing or modifying tests">
- Tests live next to source as `*.test.ts` / `*.test.tsx`
- Vitest with globals enabled — no need to import `describe`/`it`/`expect`
- Path alias `@` resolves to `src/`
- Route files (`src/routes/**`) are excluded from test discovery
- The filename picks the runtime, all from `pnpm test`: `*.worker.test.ts` runs inside the real Workers runtime with `wrangler.jsonc` bindings via `cloudflare:test`, `*.test.tsx` renders under jsdom with Testing Library, everything else runs in Node
- Browser APIs jsdom lacks are stubbed in `src/dom-shims.ts` — add to it rather than mocking per test
</important>

<important if="you are creating or reviewing design documents">
- The PRD (issue #1) and `plans/petition-template.md` are the source of truth for requirements; `docs/` holds base-stack decisions inherited from tstack-on-cf
- Standing decisions live in `docs/decisions/` — read before re-litigating one
- Apply review notes/status updates directly in the corresponding design doc
- Never create separate md files for reviews/audits/analyses unless explicitly asked
</important>

# petition-on-cf

Public petition site template on Cloudflare Workers — one deployment = one petition, modeled on 150proc.pl. TanStack Start frontend + Hono API. **In active development**: the code is still the inherited tstack-on-cf base; petition features land as vertical slices tracked in GitHub issues.

## Before implementing anything

1. **PRD**: [issue #1](https://github.com/auditmos/petition-on-cf/issues/1) — problem, user stories, decisions, assumptions, validation strategy.
2. **Plan**: `plans/petition-template.md` — durable architectural decisions + 11 phased slices.
3. **Work items**: issues #2–#13 (labels `AFK`/`HITL`), dependency-ordered via `Blocked by`, each with agent-verifiable acceptance criteria. Implement exactly what the issue scopes — nothing extra.

Durable decisions every slice must respect (full list in the plan header):

- **D1 is the single source of truth.** The `LiveCounter` Durable Object is cache + broadcaster only: WebSocket Hibernation API, broadcasts coalesced ~1/sec, counts rebuilt from D1 on cold start. Write flow is Worker → D1 → fire-and-forget DO notify. The DO never writes D1.
- **One `signatures` entity** — first name, surname, unique e-mail (the dedup key), city (display-only free text), person/company type + company name, voivodeship code from `request.cf` region, three consent flags, created-at. No petition entity exists.
- **Trust pipeline order**: validate → Turnstile siteverify (official test keys are the shipped defaults) → per-IP rate limit → geo attribution → dedup/insert. No e-mail sending or e-mail provider, ever.
- **Zero copy in components** — all copy lives in Zod-validated per-language content files with `{{token}}` interpolation from the site config; legal texts are verbatim 150proc.pl fixtures (tokenized Markdown) and stay Polish-only.
- **i18n**: `/` = Polish (default), `/en/*` = English; hreflang + localized OG tags.
- **No auth surface anywhere** — no admin UI, no protected endpoints; organizer data access is documented `wrangler d1` export queries.

## Current state

Issue #2 has landed: persistence is **Cloudflare D1**, the demo `clients` domain and the Neon driver are gone, and the landing page SSR-renders the signature count from the `signatures` table.

- `getDb(binding)` in `src/db/setup.ts` is the only module that imports a driver (`src/db/driver-boundary.test.ts` enforces it). Queries take the `D1Database` binding as a parameter — there is no singleton and no `initDatabase()`.
- The local loop needs no credentials: `pnpm run db:migrate:dev` creates and migrates a local D1.
- `wrangler.jsonc` ships all-zero placeholder `database_id` values for every environment; real ones come from `wrangler d1 create`.
- No signature form or write path yet — issue #4. The remaining issues define the build order.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (Router + Query + SSR) |
| API | Hono on Cloudflare Workers |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) + Drizzle |
| Live updates | Durable Object + WebSocket hibernation (issue #7, planned) |
| Bot protection | Cloudflare Turnstile (issue #6, planned) |
| Styling | Tailwind CSS v4, Shadcn (new-york, Zinc, CSS vars) |
| Language | TypeScript (strict) |
| Linter | Biome |
| Package manager | pnpm |

## Project Structure

- `src/routes/` — file-based routes (auto-generates `routeTree.gen.ts`)
- `src/components/` — reusable React components
- `src/components/ui/` — Shadcn primitives (do not edit manually)
- `src/hono/` — Hono API routes and factory
- `src/db/` — one directory per domain (`table.ts`, `queries.ts`, `index.ts`); `schema.ts` is what drizzle-kit reads
- `src/core/functions/` — TanStack server functions (server-only reads for route loaders)
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

# Read or write the local database directly (also how you seed a row)
pnpm exec wrangler d1 execute DB --local --command "SELECT count(*) FROM signatures"
```

## Architecture

Prefer **deep modules** (Ousterhout): small interface hiding large implementation. Test at module boundaries, not internals. See `.claude/rules/deep-modules.md`. The template's three deep modules by design: the `LiveCounter` DO, the signature trust pipeline, and the content module.

Technology-specific rules live in `.claude/rules/` with scoped `paths:` frontmatter — they activate automatically when touching relevant files.

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

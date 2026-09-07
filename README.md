# Petition on Cloudflare

*AI agent index: [llms.txt](./llms.txt)*

A **template for running a public petition site** on Cloudflare Workers — one deployment = one petition, modeled on the excellent UX of [150proc.pl](https://150proc.pl/): hero → evidence with cited sources → mechanism → signature form → live counter and Poland map → public supporters list → share → FAQ.

> **Status: in development.** Eleven of the twelve slices have landed: the site signs, counts, maps, publishes, reads as a petition in both languages, and `pnpm run init-project` personalizes it. What remains is the one-click Deploy to Cloudflare pipeline. See [Current state](#current-state) before running anything.

## What this template delivers (when complete)

- **Live signature counter + Poland voivodeship map** — a `LiveCounter` Durable Object broadcasts over WebSockets (Hibernation API, ~1 push/sec coalescing) with automatic polling fallback; D1 stays the single source of truth.
- **Complete Polish legal layer** — three RODO consent checkboxes, inline "Klauzula informacyjna", and full Klauzula RODO + Polityka prywatności routes, copied verbatim from 150proc.pl with proper nouns tokenized for your campaign.
- **Signature form with trust pipeline** — osoba prywatna / firma toggle, Cloudflare Turnstile (always-pass test keys shipped as defaults), per-IP rate limiting, unique-e-mail dedup, geo attribution from Cloudflare request metadata. No e-mail provider needed, ever.
- **Public supporters list** — consent-gated, paginated: "Imię N., Miejscowość" or company name.
- **Bilingual PL/EN** — `/` serves Polish, `/en` English; legal documents stay Polish-only with an EN notice. All copy lives in Zod-validated content files — zero text in components.
- **Sign CTA always in reach** — hero button plus a floating bottom bar with the live count once you scroll.
- **One-click start** — a Deploy to Cloudflare button yields a working placeholder demo (D1 + Durable Object auto-provisioned, migrations applied in the deploy command); `pnpm run init-project` then interviews you for petition name, organizer, addressee, domain, and Turnstile keys.
- **Organizer data access** — documented `wrangler d1` queries export the full signature CSV and the updates-consent e-mail list. No admin panel, no auth surface.

## Architecture at a glance

```
visitor ──► Worker (TanStack Start SSR + Hono /api)
                 │ validate → Turnstile → rate limit → geo → dedup
                 ▼
                D1  (single source of truth)
                 │ fire-and-forget notify
                 ▼
          LiveCounter DO  (in-memory counts, rebuilt from D1 on cold start)
                 │ WebSocket hibernation, ~1 push/sec
                 ▼
          connected browsers  (counter + voivodeship map; polling fallback)
```

Full decision log: [PRD (issue #1)](https://github.com/auditmos/petition-on-cf/issues/1) and the durable-decisions header of [`plans/petition-template.md`](plans/petition-template.md).

## Roadmap

Implementation is dispatched as dependency-ordered tracer-bullet slices — each issue is independently implementable and verifiable:

| Issue | Slice | Status |
|---|---|---|
| [#2](https://github.com/auditmos/petition-on-cf/issues/2) | D1 walking skeleton (Neon → D1, demo cleanup, `signatures` schema) | **landed** |
| [#3](https://github.com/auditmos/petition-on-cf/issues/3) | Legal text capture from 150proc.pl (verbatim fixtures) — HITL | **landed** |
| [#4](https://github.com/auditmos/petition-on-cf/issues/4) | Minimal sign path | **landed** |
| [#5](https://github.com/auditmos/petition-on-cf/issues/5) | Content module + PL/EN routing | **landed** |
| [#6](https://github.com/auditmos/petition-on-cf/issues/6) | Trust pipeline: Turnstile, rate limit, geo | **landed** |
| [#7](https://github.com/auditmos/petition-on-cf/issues/7) | Live counter DO + floating bar | **landed** |
| [#8](https://github.com/auditmos/petition-on-cf/issues/8) | Voivodeship map | **landed** |
| [#9](https://github.com/auditmos/petition-on-cf/issues/9) | Full legal layer | **landed** |
| [#10](https://github.com/auditmos/petition-on-cf/issues/10) | Supporters list | **landed** |
| [#11](https://github.com/auditmos/petition-on-cf/issues/11) | Full page anatomy + mobile pass | **landed** |
| [#12](https://github.com/auditmos/petition-on-cf/issues/12) | init-project extension | **landed** |
| [#13](https://github.com/auditmos/petition-on-cf/issues/13) | Deploy to Cloudflare button + acceptance run — HITL | planned |

## Current state

The repo was generated from [tstack-on-cf](https://github.com/auditmos/tstack-on-cf) (TanStack Start + Hono on Workers, Drizzle, Zod, Shadcn/UI, Biome + Vitest + knip). Eleven of the twelve slices have landed on top of it:

- **Persistence is Cloudflare D1**, reached through Drizzle's SQLite driver behind `src/db/setup.ts`. The `signatures` table ships as a migration, and the landing page server-renders the total count from it — the number is in the first byte of HTML, not fetched afterwards.
- **The demo `clients` domain is gone**, along with the Neon driver, its three credentials, and the seed script.
- **Signing works.** `POST /api/signatures` runs the full trust pipeline — validate → Turnstile → per-IP rate limit → region attribution → unique-e-mail dedup — and the form renders a distinct answer for each way it can end. Every signature stores an ISO 3166-2:PL voivodeship code derived from its postal code, or from Cloudflare's geo-IP, or the `unknown` bucket.
- **Copy is bilingual and lives outside the components.** `/` is Polish, `/en` English.
- **The counter is live.** A `LiveCounter` Durable Object holds the counts, rebuilds them from D1 whenever it is asked cold, and pushes them over a hibernatable WebSocket to every open page — coalesced to about one push a second, with a 30-second reconciliation heartbeat behind it. A page that cannot open a socket falls back to polling `/api/signatures/snapshot` without saying so. The floating bar arrives once the hero is behind the reader and carries the same number.
- **The map and the legal layer are in.** Sixteen voivodeships shaded by the codes the pipeline stores, every count also written out beside the drawing; the RODO clause and the privacy policy served as real routes from tokenized Markdown.
- **The supporters list is public and consent-gated.** `GET /api/signatures/supporters` pages through the signers who ticked the publication consent, newest first — "Anna K., Warszawa" for a person, the entity's name alone for an organisation. The first page is server-rendered with the count and the map; the rest arrives when the reader asks. It is deliberately the one thing on the page that is not live.
- **The page is a petition, not a page about the template.** Nine sections in one order — hero, evidence, demands, counter, form, map, supporters, share, FAQ — with every statistic carrying a mandatory source and share links hand-built rather than loaded from a network's script.
- **`init-project` interviews you for the identity.** One pass writes the petition name and addressee, the organizer's legal, prose and four declined short names, their registered address and registry numbers, the contact e-mail, the domain, the word this deployment uses for a signer that is not a person — declined into the cases the copy needs — and, optionally, the social profiles and real Turnstile keys. Public values go to `src/content/site-config.ts`; the Turnstile secret goes to `.dev.vars` and nowhere else. Re-running never overwrites an answer, so it is safe to stop halfway and come back.
- **Still ahead:** the one-click deploy ([#13](https://github.com/auditmos/petition-on-cf/issues/13)).

### Working on this repo

The local loop needs no Cloudflare account and no real credentials — D1 runs on your machine and the shipped Turnstile keys are Cloudflare's always-pass test pair.

```bash
pnpm install
cp .dev.vars.example .dev.vars   # Turnstile test secret; no account needed
pnpm cf-typegen
pnpm run db:migrate:dev          # applies migrations to the local D1
pnpm dev                         # port 3000
```

`pnpm db:seed:dev` fills the local database with 195 demo signatures spread unevenly across the voivodeships, so the counter has a number, the map has something to shade and the supporters list has something to page through. It leaves one voivodeship empty and seven signatures unattributed on purpose, a third of the rows withhold the publication consent, and six of them are organisations rather than people — those are the states easiest to break without noticing. Running it twice changes nothing; `scripts/seed-dev.sql` says how to empty the table again.

Read or write the local database directly with Wrangler — this is also how you add a single row and watch the counter move:

```bash
pnpm run db:seed:dev
pnpm exec wrangler d1 execute DB --local --command "SELECT count(*) FROM signatures"
```

Before declaring any change done: `pnpm lint && pnpm types && pnpm test && pnpm knip`.

#### Migration directories

Drizzle generates the SQL (`pnpm db:generate:<env>`); Wrangler applies it (`pnpm db:migrate:<env>`). Each environment's `migrations_dir` in `wrangler.jsonc` points at the directory its own generator writes to.

| Environment | Directory | Status |
| --- | --- | --- |
| `dev` | `src/db/migrations/dev` | In the repository |
| `staging` | `src/db/migrations/staging` | Created by `pnpm db:generate:staging` |
| `production` | `src/db/migrations/production` | Created by `pnpm db:generate:production` |

#### Deploying to a real database

`wrangler.jsonc` ships an all-zero placeholder `database_id` for every environment. Create the databases and paste the real ids in before deploying:

```bash
pnpm exec wrangler d1 create petition-staging
pnpm run db:generate:staging
pnpm run db:migrate:staging
pnpm run deploy:staging
```

Automating this into the Deploy to Cloudflare button is issue [#13](https://github.com/auditmos/petition-on-cf/issues/13).

Base-stack documentation (testing projects, deploy runbook, error handling) lives in the [upstream README](https://github.com/auditmos/tstack-on-cf#readme) and stays accurate where the slices have not rewritten this repo — this README grows the template's own quick start as features land (issue #13 finalizes it).

## Security posture

This template has **no auth surface, by design**. The petition site is entirely public, and an organizer reaches their own data with `wrangler d1` export queries from their machine rather than through a protected endpoint — so there is no admin panel, no account, and no password to leak.

Every API route is public because every API route is meant to be. Health (`/api/health/*`) reports status. Signing (`POST /api/signatures`) is the one write path, and it is public for the same reason the form is. `GET /api/signatures/snapshot` returns a total and a per-region split, and nothing else. `GET /api/signatures/supporters` is the one route that reads signatures back out, and what it can return is bounded by the query rather than by a filter: it selects only rows whose signer ticked the publication consent, and of the surname it selects one character. There is no request it will answer with an e-mail address, a full surname or a consent flag.

The write path is guarded by a trust pipeline rather than by authentication: **validate → Turnstile → per-IP rate limit → region attribution → unique-e-mail dedup**, in that order. A submission without a Turnstile token, or with one Cloudflare's siteverify does not approve, is refused with 403 before it reaches the database; a sixth submission from the same address inside a minute is refused with 429. The order matters — a signer who mistyped their e-mail is told that, rather than accused of being a robot, and a machine spends a challenge before it spends a rate-limit slot. **With the shipped test keys none of this stops anything**: read the next section before you deploy.

TanStack Start server functions are the one exception to "public by default": they are same-origin RPC endpoints, so `src/start.tsx` registers a CSRF middleware that answers 403 to a cross-site call. It currently guards two reads — the public count and the list's first page — and it does not cover `POST /api/signatures`, which is a Hono route — nor would it help there, since a site with no session cookie gains an attacker nothing they could not do from their own server. It is the default the next server function inherits.

That is a decision about what to build, not a claim that nothing needs guarding. Authentication attaches at `src/hono/factory.ts`: `createHono(...middleware)` accepts `ApiMiddleware` handlers and applies them to every route of the endpoint it builds, so a guard added there covers the whole surface instead of one handler. If you add an endpoint this template does not have, that is where it goes.

Before you deploy:

- Replace the placeholder `database_id` values in `wrangler.jsonc` with real ones from `wrangler d1 create`. They are all-zero and syntactically valid, so a deploy that skips this step succeeds and then fails on the first query.
- Keep production off the workers.dev subdomain — it ships off, and a custom domain is the intended way to reach it. A guessable second URL serving the same form collects signatures under no campaign identity at all.
- Replace the Turnstile test keys with real ones — see [Turnstile keys](#turnstile-keys) directly below. The shipped values accept every submission, including a script's.
- Review the legal texts against your campaign; responsibility for their sufficiency rests with the organizer.

### Turnstile keys

Turnstile has two halves, and they are not interchangeable:

| Key | Where it goes | Public? |
| --- | --- | --- |
| Site key | `turnstileSiteKey` in `src/content/site-config.ts` | Yes — the widget script reads it in the visitor's browser |
| Secret key | `TURNSTILE_SECRET_KEY`, a Worker secret | **No** — it never leaves the Worker |

What ships is Cloudflare's official **always-pass test pair** (`1x00000000000000000000AA` and `1x0000000000000000000000000000000AA`), so a fresh clone signs with no Cloudflare account and CI needs no credentials. They render a real widget and approve every visitor — they are the absence of bot protection, not bot protection.

To switch to real keys, create a widget in the Cloudflare dashboard under **Turnstile → Add widget**, add your deployment's hostnames, then:

```bash
# 1. Site key — public, committed
#    Paste it into turnstileSiteKey in src/content/site-config.ts

# 2. Secret key — never committed
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env staging
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env production
```

`wrangler.jsonc` declares `TURNSTILE_SECRET_KEY` under `secrets.required` in every environment, so `wrangler deploy` refuses to ship an environment where it was never set and names it. Locally, `cp .dev.vars.example .dev.vars` is enough — the test secret in it works offline.

To watch the failure path by hand, put `2x00000000000000000000AB` (Cloudflare's always-*blocks* site key) in the config and submit the form: the bot-check message appears instead of the success state.

`src/secrets-contract.test.ts` fails the build if a secret key ever appears in the source, if the content files mention one, or if the Worker reads it from anywhere but its env binding.

## Getting the signatures out

There is no admin panel and no export endpoint — [by design](#security-posture). An organizer reads their own data with Wrangler, from their own machine, against the environment they name. Both queries below emit CSV with a header row, and both need [`jq`](https://jqlang.github.io/jq/): `wrangler d1 execute --json` returns JSON, and the CSV shaping happens locally rather than in SQL so the same command works against any environment.

Swap `--env production` for `--env staging`, or `--local` for the database on your own machine. `--remote` is the flag that means "the real one".

#### Full signature export

Everything the petition holds, newest last, for delivering the petition to its addressee.

```bash
pnpm exec wrangler d1 execute DB --env production --remote --json \
  --command "SELECT id, first_name, surname, email, city, postal_code, signer_type, company_name, signer_role, voivodeship_code, consent_rodo, consent_public_list, consent_updates, datetime(created_at, 'unixepoch') AS signed_at FROM signatures ORDER BY created_at" \
  | jq -r '.[0].results | (.[0] | keys_unsorted), (.[] | [.[]]) | @csv' > signatures.csv
```

| Column | What it holds |
| --- | --- |
| `id` | UUID of the signature |
| `first_name` | As given |
| `surname` | In full — the public list only ever shows its initial |
| `email` | The dedup key; unique across the table |
| `city` | Free text, shown as typed, never matched against a dictionary |
| `postal_code` | `NN-NNN` or empty — always optional |
| `signer_type` | `person` or `company` |
| `company_name` | The entity's name, empty for a private person |
| `signer_role` | Their role in it, empty unless this deployment asks for one |
| `voivodeship_code` | ISO 3166-2:PL, or empty where attribution failed |
| `consent_rodo` | `1` — mandatory, stored so the record shows what was agreed |
| `consent_public_list` | `1` where the signature may be published |
| `consent_updates` | `1` where they asked to hear how it went |
| `signed_at` | UTC, `YYYY-MM-DD HH:MM:SS` |

#### Supporters who asked for updates

The only people this campaign may write to. Nothing in this template sends e-mail — there is no provider and no sending code — so this list is for pasting into whatever you do send with, and the consent is the whole basis for having it.

```bash
pnpm exec wrangler d1 execute DB --env production --remote --json \
  --command "SELECT email, first_name, surname FROM signatures WHERE consent_updates = 1 ORDER BY created_at" \
  | jq -r '.[0].results | (.[0] | keys_unsorted), (.[] | [.[]]) | @csv' > updates-consent.csv
```

| Column | What it holds |
| --- | --- |
| `email` | Where to write |
| `first_name` | For addressing them by name |
| `surname` | In full |

Both files are personal data the moment they exist. `src/db/signatures/export-queries.test.ts` fails the build if a documented column stops matching what the query returns.

## Planning artifacts

- **[PRD — issue #1](https://github.com/auditmos/petition-on-cf/issues/1)**: problem, 38 user stories, implementation decisions, assumptions, tradeoffs, validation strategy
- **[`plans/petition-template.md`](plans/petition-template.md)**: durable architectural decisions + 11 phased slices with acceptance criteria
- **[Issues #2–#13](https://github.com/auditmos/petition-on-cf/issues)**: dependency-ordered work items, labeled `AFK` (agent-implementable end-to-end) or `HITL` (named human checkpoint)

## Credits

- UX and legal-layer reference: [150proc.pl](https://150proc.pl/). Only the legal texts are copied (verbatim, tokenized); campaign content is not.
- Base stack: [tstack-on-cf](https://github.com/auditmos/tstack-on-cf).

## License

Open source under the [MIT License](LICENSE).

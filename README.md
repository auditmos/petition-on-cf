# Petition on Cloudflare

*AI agent index: [llms.txt](./llms.txt)*

A **template for running a public petition site** on Cloudflare Workers — one deployment = one petition, modeled on the excellent UX of [150proc.pl](https://150proc.pl/): hero → evidence with cited sources → mechanism → signature form → live counter and Poland map → public supporters list → share → FAQ.

> **Status: in development.** Planning is complete; implementation is landing as vertical slices. The codebase is currently the inherited [tstack-on-cf](https://github.com/auditmos/tstack-on-cf) base — see [Current state](#current-state) before running anything.

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
| [#2](https://github.com/auditmos/petition-on-cf/issues/2) | D1 walking skeleton (Neon → D1, demo cleanup, `signatures` schema) | planned |
| [#3](https://github.com/auditmos/petition-on-cf/issues/3) | Legal text capture from 150proc.pl (verbatim fixtures) — HITL | planned |
| [#4](https://github.com/auditmos/petition-on-cf/issues/4) | Minimal sign path | planned |
| [#5](https://github.com/auditmos/petition-on-cf/issues/5) | Content module + PL/EN routing | planned |
| [#6](https://github.com/auditmos/petition-on-cf/issues/6) | Trust pipeline: Turnstile, rate limit, geo | planned |
| [#7](https://github.com/auditmos/petition-on-cf/issues/7) | Live counter DO + floating bar | planned |
| [#8](https://github.com/auditmos/petition-on-cf/issues/8) | Voivodeship map | planned |
| [#9](https://github.com/auditmos/petition-on-cf/issues/9) | Full legal layer | planned |
| [#10](https://github.com/auditmos/petition-on-cf/issues/10) | Supporters list | planned |
| [#11](https://github.com/auditmos/petition-on-cf/issues/11) | Full page anatomy + mobile pass | planned |
| [#12](https://github.com/auditmos/petition-on-cf/issues/12) | init-project extension | planned |
| [#13](https://github.com/auditmos/petition-on-cf/issues/13) | Deploy to Cloudflare button + acceptance run — HITL | planned |

## Current state

The repo was generated from [tstack-on-cf](https://github.com/auditmos/tstack-on-cf) (TanStack Start + Hono on Workers, Drizzle, Zod, Shadcn/UI, Biome + Vitest + knip) and the code is still that base:

- The database is still **Neon Postgres** — issue [#2](https://github.com/auditmos/petition-on-cf/issues/2) swaps it to **Cloudflare D1** and removes the demo `clients` domain. Until then, the dev loop (`db:*` scripts, `.dev.vars`) expects Neon credentials exactly as documented in the [upstream README](https://github.com/auditmos/tstack-on-cf#readme).
- No petition feature exists yet; the roadmap above is the build order.

### Working on this repo

```bash
pnpm install
pnpm cf-typegen
pnpm dev            # port 3000 — upstream base app until slices land
```

Before declaring any change done: `pnpm lint && pnpm types && pnpm test && pnpm knip`.

Base-stack documentation (scripts, testing projects, deploy runbook, error handling, secrets) lives in the [upstream README](https://github.com/auditmos/tstack-on-cf#readme) and stays accurate until the corresponding slices rewrite this repo — this README will grow the template's own quick start as features land (issue #13 finalizes it).

## Planning artifacts

- **[PRD — issue #1](https://github.com/auditmos/petition-on-cf/issues/1)**: problem, 38 user stories, implementation decisions, assumptions, tradeoffs, validation strategy
- **[`plans/petition-template.md`](plans/petition-template.md)**: durable architectural decisions + 11 phased slices with acceptance criteria
- **[Issues #2–#13](https://github.com/auditmos/petition-on-cf/issues)**: dependency-ordered work items, labeled `AFK` (agent-implementable end-to-end) or `HITL` (named human checkpoint)

## Credits

- UX and legal-layer reference: [150proc.pl](https://150proc.pl/). Only the legal texts are copied (verbatim, tokenized); campaign content is not.
- Base stack: [tstack-on-cf](https://github.com/auditmos/tstack-on-cf).

## License

Open source under the [MIT License](LICENSE).

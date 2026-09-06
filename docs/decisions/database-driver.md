# Decision: Cloudflare D1 as the single source of truth

**Status:** accepted · **Applies to:** `src/db/setup.ts`, `wrangler.jsonc`
· **Supersedes:** the fetch-based Neon Postgres driver, removed in issue #2

## Decision

Signatures live in Cloudflare D1, reached through Drizzle's `d1` driver. The
binding is passed to `getDb(binding)` in `src/db/setup.ts`; nothing outside that
module knows which driver it got. No external Postgres, no Hyperdrive, no
connection credentials anywhere in the repository.

## Why

The previous version of this record chose a fetch-based Postgres driver over
Hyperdrive, and it chose it on one axis: how many things a cloner must provision
between `git clone` and a working development server. That axis was right; the
answer has simply improved. D1 removes the remaining prerequisite. There is no
database to sign up for, no connection string to paste, and no secret to set —
`pnpm run db:migrate:dev` creates a local SQLite database on the spot, and the
same schema applies to a real D1 later with one Wrangler command.

Two properties follow from D1 being a *binding* rather than a host, and both
matter more here than raw query throughput:

- **No connection to manage.** There is no handshake to amortise, no pool to
  keep warm, and therefore no singleton — which is why `getDb()` takes the
  binding as a parameter instead of caching one in a module variable. A test can
  hand a query its own isolated database, which is what makes
  `src/db/signatures/queries.worker.test.ts` an integration test against the
  migration that actually ships rather than against a mock.
- **The data stays on the organizer's own account.** A petition collects names,
  e-mail addresses and consents. Every external database is one more party
  holding them and one more agreement to explain in the privacy notice. D1 is
  inside the same Cloudflare account the Worker already runs in.

The cost is real and accepted: D1 is SQLite, so there is no `JSONB`, no
extensions, and no cross-region primary. This template stores one flat table and
counts rows.

## Decide differently when

- **Signatures are not the only data, and the queries stop being flat.** D1 is
  fine at one table and one aggregate. Reporting across several entities is
  where Postgres starts paying for itself.
- **You need a database outside Cloudflare** — an existing corporate Postgres,
  say. Then it is Hyperdrive plus a TCP driver, and the prerequisite count goes
  back up. That is a fair trade when the database already exists.
- **Write volume outgrows one D1 primary.** A petition that expects sustained
  concurrent writes at a rate a single SQLite writer cannot absorb needs a
  different store, not a bigger D1.

## How to switch

1. Provision the replacement and add its binding to `wrangler.jsonc` — in the
   top-level block *and* in each `env` block, since bindings are not inherited.
2. Change the driver import inside `src/db/setup.ts`, keeping the `getDb`
   signature. `src/db/driver-boundary.test.ts` fails if the import spreads.
3. Regenerate migrations with the new dialect in the `drizzle-*.config.ts` files.
4. Run `pnpm cf-typegen` so `Env` picks up the new binding.

Every call site keeps working; that is what the module boundary is for.

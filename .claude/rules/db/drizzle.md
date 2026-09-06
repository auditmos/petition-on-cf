---
paths:
  - "src/db/**/*.ts"
---

# Drizzle ORM Rules

## Schema Definition

- Use `sqliteTable()` with explicit column types — the database is D1, which is
  SQLite. `pgTable()` will type-check against a Postgres driver this project
  does not have.
- Define tables in `{domain}/table.ts`, and export them from `src/db/schema.ts`
  so `drizzle-kit generate` sees them.
- Never edit auto-generated files.

```ts
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})
```

SQLite has no UUID, boolean, or timestamp type. The conventions above are the
ones `src/db/signatures/table.ts` documents and the rest of the schema follows:
UUID text ids, integer booleans defaulted to `0`, Unix-seconds timestamps
defaulted by the database rather than by the Worker's clock.

## Type Inference

- Use `InferSelectModel<typeof table>` for select types
- Use `InferInsertModel<typeof table>` for insert types
- Export types alongside tables

```ts
export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
```

## Query Patterns

- Use SQL-like API for complex queries with joins
- Use relational API (`db.query.*`) for nested data
- Always use `eq()`, `and()`, `or()` helpers
- Drizzle outputs exactly 1 SQL query—leverage for serverless

```ts
// SQL-like
const result = await db.select().from(users)
  .leftJoin(posts, eq(posts.authorId, users.id))
  .where(eq(users.id, userId))

// Relational
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { posts: true }
})
```

## Migrations

- Never manually edit generated migration files
- Per-environment configs: `drizzle-dev.config.ts`, `drizzle-staging.config.ts`, `drizzle-production.config.ts`
- Per-environment migration dirs: `src/db/migrations/{dev,staging,production}/`
- Generation needs no credentials; application goes through Wrangler. See
  `.claude/rules/db/d1.md`.

## Domain Module Pattern

Place queries in `{domain}/queries.ts`, export from `{domain}/index.ts`:

```
src/db/{domain}/
├── table.ts      # sqliteTable definition
├── schema.ts     # Zod validation schemas
├── queries.ts    # All DB operations
└── index.ts      # Public API (re-exports)
```

## Query Layer

- Every query takes the `D1Database` binding and passes it to `getDb()` — see
  `.claude/rules/db/d1.md` for why the binding is a parameter rather than a
  module singleton
- Return typed results

---
paths:
  - "src/hono/**/*.ts"
---

# Hono Framework Rules

## App Setup

- Type bindings via `Hono<{ Bindings: Env }>`
- Access env via `c.env`, not `process.env`
- Export `app.fetch` for Workers

```ts
import { Hono } from 'hono'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

export default {
  fetch: app.fetch,
}
```

## Middleware Chain

Apply in order: requestId → errorHandler → cors → auth → rateLimiter → validator

```ts
app.use('*', requestId())
app.use('*', errorHandler())
app.use('*', cors())
app.use('/api/*', authMiddleware())
app.use('/api/*', rateLimiter())
```

## Route Structure

- Handlers: thin wrappers, call query functions from `@/db/{domain}`
- Keep handlers focused on HTTP concerns (validation, status codes, response shape)

## Request Validation

Always a named schema, never an inline `z.object()` in the handler.

**Where the schema lives depends on who else reads it.** A schema the browser
also validates against — anything a form submits — belongs in `@/core/`, not in
`@/db/{domain}`: the database barrels re-export query functions, so importing
one from a component pulls Drizzle and the D1 driver into the client bundle.
`src/core/signature-input.ts` is the worked example. A schema only the server
ever sees can live with its domain.

```ts
// Shared with a form — core, so the component can import it too
import { signatureInputSchema } from '@/core/signature-input'

const parsed = signatureInputSchema.safeParse(await c.req.json())
if (!parsed.success) {
  return c.json({ error: 'Validation failed', details: fieldErrors(parsed.error) }, 400)
}
```

Report which field failed, not just that something did — the form renders the
message beside the input. Write the messages yourself: the library's defaults
are English and this template's pages are not.

`@hono/zod-validator` is not installed. `safeParse` in the handler is the
pattern here; add the middleware only if a slice needs it across several
endpoints.

## Error Handling

- Use `AppError` from `@/core/errors` for known errors
- Use `isUniqueViolation` for constraint conflicts
- Centralize via error middleware
- Return consistent error shapes

```ts
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Internal error' }, 500)
})
```

## Response Patterns

```ts
// Success
return c.json({ data: entity })
return c.json({ data: entities, meta: { total, page } })

// Error
return c.json({ error: 'Not found' }, 404)
return c.json({ error: 'Validation failed', details: errors }, 400)
```

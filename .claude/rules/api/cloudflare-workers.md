---
paths:
  - "src/server.ts"
  - "src/hono/**/*.ts"
---

# Cloudflare Workers Rules

## Worker Entry

- ES module syntax with default export
- Dispatch only — bindings reach handlers through `c.env`, so the entry point
  has nothing to initialise
- Route `/api/*` → Hono, rest → TanStack Start

```ts
// src/server.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (isApiRequest(url.pathname)) {
      return honoApp.fetch(request, env)
    }
    return tanstackHandler(request)
  }
}
```

`startsWith('/api')` would swallow `/apidocs` and `/apinotmine`. Use an explicit
predicate — `src/server.worker.test.ts` covers exactly those paths.

## Env Bindings

- Run `pnpm cf-typegen` to generate types from wrangler.jsonc
- Generates `Env` interface in `worker-configuration.d.ts`
- Access via `c.env` (Hono) — never `process.env`

## Secrets Management

- Never hardcode secrets
- Use `.dev.vars` for local dev (gitignored)
- Use Cloudflare dashboard for remote secrets
- Access same as env vars: `env.SECRET_NAME`

## Request Handling

- Workers are stateless — no global mutable state
- Use `waitUntil()` for async work after response
- Respect CPU time limits (50ms free, 30s paid)

```ts
ctx.waitUntil(logAnalytics(request)) // non-blocking
return response
```

## Deployment

- Deploy via `pnpm deploy`
- Configure environments in `wrangler.jsonc`

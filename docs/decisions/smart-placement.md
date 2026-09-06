# Decision: Smart Placement ships off

**Status:** accepted · **Applies to:** `wrangler.jsonc`

## Decision

Smart Placement is present in `wrangler.jsonc` as a commented block and is not
enabled. Turning it on is a deliberate act by the person cloning this template,
taken after measuring, not a default they inherit.

## Why

Smart Placement moves a Worker's execution away from the data centre nearest the
user and towards its back-end, when Cloudflare's measurements say the round
trips to that back-end dominate the request. It is the right setting for an
application that is chatty with a database pinned to one region.

This template is not that application. D1 is a Cloudflare binding, the read path
is one aggregate query per page, and the Worker's remaining time goes into
server-rendering React — work that belongs near the user. Enabling Smart
Placement here would move execution away from the reader to save a round trip
that is not the bottleneck.

It stays present rather than deleted because a cloner's Worker may become that
application: a sign path with several sequential statements, or an integration
with a region-pinned service. In those cases the setting earns its keep — but
only after measuring. The failure mode of an inherited default is that nobody
remembers choosing it, and a regression from misplaced execution is invisible
until someone looks for it. Commented-out configuration with the reasoning
attached asks for a decision; an enabled default pretends one was already made
on the cloner's behalf, with information the template does not have.

## Enable when

All three, together, describe your Worker:

- A single request makes **multiple sequential round trips** to the same
  back-end — several queries, or a query whose result drives the next one.
- That back-end lives in **one place**: a region-pinned database, a legacy
  service, a single-homed API. Anycasted or multi-region back-ends have nothing
  to move towards.
- The Worker is **not** doing heavy user-proximate work whose latency would grow
  by the same amount placement saves.

If you have one round trip per request, this setting has nothing to optimise.

## How to enable

Uncomment the block in `wrangler.jsonc`:

```jsonc
"placement": { "mode": "smart" }
```

If you already know where your back-end is, an explicit hint beats inference —
`"placement": { "region": "aws:us-east-1" }` for a cloud region, or
`"placement": { "host": "db.example.com:5432" }` for infrastructure elsewhere.

Enable it in **one environment first** — staging — not everywhere at once.

## How to measure the result

Cloudflare holds back roughly 1% of requests from Smart Placement as a control
group, and the **Request duration** chart in the Worker's metrics plots placed
requests against that control. The chart only appears once Smart Placement is
enabled, so there is no before-and-after to collect by hand: enable it, let a
representative period of real traffic through, then read the two distributions
off the same chart.

Judge it on the tail, not the median — p95 and p99 are where round-trip cost
shows up. If the placed distribution is not clearly better, turn it back off.
Neutral is not a reason to keep configuration.

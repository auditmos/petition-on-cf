# Atomic Edits

The PostToolUse hook runs `biome check --write --unsafe` on every file you touch.
`--unsafe` applies fixes that change meaning, and they fire on code that is only
*momentarily* incomplete — the state your file is in between two sequential Edit
calls.

**Always combine a declaration with its first usage in a single Edit call.**

If the change is too large for one call:

1. Add the **usage** first, even though it references something not yet declared
2. Add the **declaration** second — it is used the instant it exists, so nothing rewrites it

Never add a declaration in one Edit and its usage in a separate Edit.

## Local constants and variables

This is the one that bites. `correctness/noUnusedVariables` is enabled, and its
unsafe fix does not delete an unused local — it **renames it with an underscore**:

```ts
// You write this first, intending to use it in the next Edit:
const home = toLanguagePath("/", language)

// The hook runs before your next Edit and rewrites it:
const _home = toLanguagePath("/", language)

// Your next Edit adds `to={home}` — which now refers to nothing.
```

`pnpm types` catches it, but that is rarely the symptom you meet first. In a
component the undeclared name throws at render, React and TanStack Router
swallow it into an error boundary, and what you actually see is a test failing
with *"Unable to find an element"* over an empty `<body>` — a mystery that costs
a debugging round before anyone thinks to look at the constant they just wrote.

**When a component test suddenly renders nothing, grep the file for `_` prefixes
you did not write.** Two separate cases in one session (2026-09-07): a test
fixture became `_SOCIALS`, and a component's `home` became `_home`.

The same fix applies to a function, a type alias, or a destructured value — anything
`noUnusedVariables` can see.

## Imports

The hook passes `--skip=correctness/noUnusedImports`, so an import left briefly
unused survives today — unlike a local, which gets renamed. Keep the ordering
habit anyway: that skip is one flag in `.claude/settings.json` away from
changing, and writing the usage first costs nothing either way.

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

Every rewrite below comes from `--unsafe` specifically — verified by running the
hook's own command with and without the flag. The safe pass leaves all of them
alone. So none of this shows up in `pnpm lint`, which does not write: the file on
disk was changed by the hook, and the change is invisible until something fails.

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
`noUnusedVariables` can see. A `useState` pair counts as two: `const [arrivals,
setArrivals] = useState([])` written before its first read becomes `const
[_arrivals, setArrivals]`, and the component then renders with `arrivals is not
defined` (2026-09-07, twice: `_arrivals` in `use-live-counts.ts` and `_setLoaded`
in `supporters-section.tsx`).

## Private class members — deleted, not renamed

`correctness/noUnusedPrivateClassMembers` is the same hazard with a worse
outcome. An unused `#field` is not renamed, it is **removed**:

```ts
// You add the field, intending to use it in the next Edit:
class LiveCounter {
  #latest: Promise<LiveUpdate> | null = null   // ← gone before your next Edit
  #pushedAt = 0
}

// Your next Edit writes `this.#latest = …` and the file no longer parses:
//   Private name "#latest" must be declared in an enclosing class
```

The failure is at least loud — esbuild refuses the file, so every test in it
fails at once rather than one test failing strangely. Both `#latest` and
`#published` were deleted this way while implementing #15 (2026-09-07).

## `useEffect` dependencies — silently narrowed

The one with no symptom at all. `correctness/useExhaustiveDependencies` also
removes dependencies it considers unnecessary, and "unnecessary" means *not read
inside the callback body*:

```tsx
useEffect(() => {
  setDrift(0)                       // resets when the measurement changes
  const from = Date.now()
  const tick = setInterval(() => setDrift(…), TICK_MS)
  return () => clearInterval(tick)
}, [base])                          // ← rewritten to [] — `base` is never read
```

> This hook specifies more dependencies than necessary: base.

Which is true of the *body* and false of the *intent*: the dependency was there
to re-run the effect, not to be read by it. Nothing breaks — the code compiles,
the lint passes, and a test that mounts the component once still passes, because
the effect does run the first time. What breaks is the second time, which only a
test that re-renders with new props can see. In #15 this shipped a tempo label
that never restarted its clock, and it was found by hand against `pnpm dev`
rather than by the suite.

**Do not fight this rule by adding a fake read.** An unused local inside the
callback is just the first hazard again. When state has to reset because a prop
now describes something different, use React's own mechanism and give the child a
`key` — `src/components/landing/counter-section.tsx` is the worked example, and
`counter-section.test.tsx` pins it by re-rendering. An effect whose dependencies
it genuinely reads is unaffected.

## Imports

The hook passes `--skip=correctness/noUnusedImports`, so an import left briefly
unused survives today — unlike a local, which gets renamed. Keep the ordering
habit anyway: that skip is one flag in `.claude/settings.json` away from
changing, and writing the usage first costs nothing either way.

## What each rewrite looks like from the outside

| You wrote | The hook wrote | What you see first |
|---|---|---|
| `const home = …` | `const _home = …` | *"Unable to find an element"* over an empty `<body>` |
| `#latest = null` | *(deleted)* | `Private name "#latest" must be declared in an enclosing class` |
| `}, [base])` | `}, [])` | **Nothing.** Passing tests, passing lint, wrong page |

When a change behaves as though an edit never landed, read the file rather than
the diff you intended — `git diff` shows the hook's version, and so does every
tool that re-reads from disk.

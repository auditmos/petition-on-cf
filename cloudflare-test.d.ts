/// <reference types="@cloudflare/vitest-pool-workers/types" />

// The pool types `env` as `Cloudflare.Env`, so a `*.worker.test.ts` reaching
// for a binding the Worker does not declare is already a type error and no
// augmentation is needed here. Test-only fixtures are deliberately kept off
// that interface — see `src/db/test-support.ts` for where they are read.
export type {};

/**
 * Lets `node --test` resolve the `@/…` path alias that Next.js provides at build
 * time but Node knows nothing about.
 *
 * Without this, any lib module importing `@/lib/…` is untestable — which is why
 * lib/ops-brief-metrics.ts had no unit tests despite being pure, deterministic
 * logic. The alternative (rewriting source imports to relative paths with a .ts
 * extension) satisfies Node but fails `tsc` with TS5097, so the resolution
 * belongs in the test runner, not in the source.
 */
import { register } from 'node:module'
register('./test-resolver-hooks.mjs', import.meta.url)

-- Lead Engine: allow the `forge` kit.
--
-- ── A production-blocking bug, found by verify-lead-engine.mjs --live ──
-- The Forge kit shipped in code on 2026-08-25 as a seventh theme, and the vertical map was
-- repointed so the 7 trades and 4 rental/hauling verticals resolve to it. The CHECK constraint
-- still listed the original six. So `createSite` did not degrade for those verticals -- it FAILED
-- OUTRIGHT:
--
--   new row for relation "lead_engine_sites" violates check constraint
--   "lead_engine_sites_theme_check"
--
-- Eleven of twenty-seven selectable verticals could not have a site created at all. Nothing in the
-- toolchain connects a TypeScript union to a Postgres CHECK: `THEMES` gained a member, `tsc` was
-- clean, 593 tests passed, and the only thing that could notice was a script that actually inserts
-- a row. It did, on the first live run after the kit shipped.
--
-- A constraint cannot be widened in place, so it is dropped and recreated -- the same shape the
-- original migration already uses for both of these.
--
-- Widening only. Every existing row keeps its theme, and no row anywhere is rewritten.

ALTER TABLE public.lead_engine_sites DROP CONSTRAINT IF EXISTS lead_engine_sites_theme_check;
ALTER TABLE public.lead_engine_sites ADD  CONSTRAINT lead_engine_sites_theme_check
  CHECK (theme IN ('ironclad', 'counsel', 'threshold', 'ledger', 'yard', 'clinic', 'forge'));

comment on constraint lead_engine_sites_theme_check on public.lead_engine_sites is
  'Must match THEMES in lib/lead-engine/theme.ts. Adding a kit there without a migration here does '
  'not degrade a site -- it makes createSite fail for every vertical mapped to the new kit.';

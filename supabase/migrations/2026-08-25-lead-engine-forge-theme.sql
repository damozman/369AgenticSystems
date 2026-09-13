-- Lead Engine: widen the theme constraint to allow 'forge'.
--
-- `lib/lead-engine/theme.ts` added `forge` as a seventh kit (commit e10d96b, 2026-08-25) and split
-- 11 verticals onto it — all 7 trades plus all 4 rental/hauling verticals. The database's own
-- CHECK constraint was never widened to match, because the session that shipped the theme was a
-- cloud container with no Supabase credentials and could not run `verify-lead-engine.mjs --live`
-- against production. Running it locally, with real credentials, caught this immediately:
-- `createSite()` for any of those 11 verticals fails outright —
-- "new row for relation lead_engine_sites violates check constraint lead_engine_sites_theme_check"
-- — because the code now writes 'forge' and the constraint does not yet allow it. This is not a
-- cosmetic gap: it is the same class of bug this project has hit before (arming a gate before
-- every producer can satisfy it) — here inverted, a producer shipped before the gate was widened.
--
-- Ironclad and Yard stay in the list even though no vertical maps to them anymore (see
-- `theme.ts`'s own note: they remain operator-selectable, and any live row carrying one must keep
-- rendering as it did). Removing a kit from this list is a distinct, later decision.

ALTER TABLE public.lead_engine_sites DROP CONSTRAINT IF EXISTS lead_engine_sites_theme_check;
ALTER TABLE public.lead_engine_sites ADD  CONSTRAINT lead_engine_sites_theme_check
  CHECK (theme IN ('ironclad', 'forge', 'counsel', 'threshold', 'ledger', 'yard', 'clinic'));

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- ALTER TABLE public.lead_engine_sites DROP CONSTRAINT IF EXISTS lead_engine_sites_theme_check;
-- ALTER TABLE public.lead_engine_sites ADD  CONSTRAINT lead_engine_sites_theme_check
--   CHECK (theme IN ('ironclad', 'counsel', 'threshold', 'ledger', 'yard', 'clinic'));
-- -- Only safe if no row has been written with theme = 'forge' since this migration applied.

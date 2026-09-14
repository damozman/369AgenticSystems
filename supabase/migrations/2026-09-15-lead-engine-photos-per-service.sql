-- Lead Engine: let a service hold SEVERAL photos, not one.
--
-- ── Why the old constraint was right and is now wrong ──
-- `lead_engine_photos_one_per_service` (2026-09-14) allowed exactly one photo per service, and its
-- own comment explains why: a service was a TILE on the home page, one tile takes one photograph,
-- and a second photo claiming "Drain cleaning" was a mistake rather than an intent.
--
-- A service now has its own PAGE — a lead photograph across the top and a strip of three below it.
-- Four destinations, and the constraint permits one. Chris, reading two finished service pages:
-- "I definitely don't want them to match. So I'll need to specific tag in the photo uploader
-- section for these individual placements. The same goes for the three across the bottom there,
-- because they will likely need to cater to the specific service."
--
-- Without this, a second photo tagged to a service fails on a unique violation, and the only way
-- to differentiate two service pages is the automatic rotation — which picks photos that are
-- merely DIFFERENT, not photos that are RIGHT. A roofer's storm-damage page wants storm damage on
-- it; nothing in the system can know which photograph that is except the person who took it.
--
-- ── What is NOT relaxed ──
-- One hero and one band per site stay unique. Those are genuinely single slots on the page, and a
-- second claim on either really is a mistake. `lead_engine_photos_one_per_singleton_slot` is
-- untouched.
--
-- ── Ordering ──
-- Several photos on one service need an order, and `sort_order` already carries one for every row.
-- The first tagged photo leads the page; the rest fill the strip, in that order. No new column.
--
-- Widening-only: dropping a unique index cannot fail on existing data, and every row that
-- satisfied the old index still satisfies everything that remains. Safe to apply before or after
-- the code ships — with the index still in place the app simply cannot save a second tag, which is
-- today's behaviour.

DROP INDEX IF EXISTS public.lead_engine_photos_one_per_service;

COMMENT ON COLUMN public.lead_engine_photos.slot_key IS
  'Only meaningful when slot = ''service'': the service NAME this photo belongs to, matched against '
  'the site content''s services. Name rather than index so reordering services cannot reshuffle '
  'photos; a rename makes the photo fall back to automatic rather than vanish. SEVERAL photos may '
  'name the same service — the first by sort_order leads that service''s page, the rest fill its '
  'strip.';

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- Only safe while no service holds more than one photo; delete or retag the extras first.
-- CREATE UNIQUE INDEX lead_engine_photos_one_per_service
--   ON public.lead_engine_photos (site_id, slot_key)
--   WHERE slot = 'service' AND slot_key IS NOT NULL;

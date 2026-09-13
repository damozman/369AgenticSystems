-- Lead Engine: let a photo be assigned to a specific place on the page.
--
-- ── Why ──
-- Found the first time a real person used the photo tool. Three photos were uploaded to a plumbing
-- site and the "Drain cleaning" service tile rendered a photograph of a bedroom. Nothing was
-- broken: `allocatePhotos` pairs service tiles with photos BY POSITION -- photo 1 onto service 1,
-- photo 2 onto service 2 -- and it has no idea what any of them depicts. No amount of automatic
-- allocation can fix that, because the information does not exist anywhere in the system.
--
-- `is_primary` already solves exactly this for ONE slot: the customer says "this is my best photo"
-- and the hero honours it. These two columns generalise that to the rest of the page.
--
-- ── Two columns, because "which service" is a different question from "which slot" ──
-- `slot` says where. `slot_key` says which one, and is only meaningful for `service` -- it holds
-- the service NAME as it appears in the site's content.
--
-- Matching by NAME rather than by index is deliberate: a service list gets reordered and edited
-- constantly during review, and an index-based link would silently reshuffle every service
-- photograph the first time someone moved a row. A name survives reordering.
--
-- ── A renamed service degrades, it does not vanish ──
-- Rename "Drain cleaning" and its photo's `slot_key` no longer matches anything. The photo then
-- falls back to automatic placement rather than disappearing from the page. That is the same
-- degrade-don't-disappear rule the resolution and aspect preferences already follow, and it is
-- the honest behaviour: the operator's intent is stale, not wrong, and a missing photo is a worse
-- answer than a differently-placed one.
--
-- NULL `slot` means automatic, which is every existing row and remains the common case.

ALTER TABLE public.lead_engine_photos
  ADD COLUMN IF NOT EXISTS slot     text,
  ADD COLUMN IF NOT EXISTS slot_key text;

-- Widening-safe: the constraint permits NULL, so every existing row already satisfies it.
ALTER TABLE public.lead_engine_photos DROP CONSTRAINT IF EXISTS lead_engine_photos_slot_check;
ALTER TABLE public.lead_engine_photos ADD  CONSTRAINT lead_engine_photos_slot_check
  CHECK (slot IS NULL OR slot IN ('hero', 'band', 'service', 'gallery'));

COMMENT ON COLUMN public.lead_engine_photos.slot IS
  'Where this photo goes: hero, band, service, gallery. NULL means allocate automatically. '
  'Must match SLOTS in lib/lead-engine/photos.ts.';

COMMENT ON COLUMN public.lead_engine_photos.slot_key IS
  'Only meaningful when slot = ''service'': the service NAME this photo belongs to, matched against '
  'the site content''s services. Name rather than index so reordering services cannot reshuffle '
  'photos; a rename makes the photo fall back to automatic rather than vanish.';

-- One photo per service, the same shape as the existing one-primary-per-site index. A second photo
-- claiming "Drain cleaning" is a mistake rather than an intent, and the database is the only place
-- that can refuse it under a race.
CREATE UNIQUE INDEX IF NOT EXISTS lead_engine_photos_one_per_service
  ON public.lead_engine_photos (site_id, slot_key)
  WHERE slot = 'service' AND slot_key IS NOT NULL;

-- Likewise one hero and one band per site. `is_primary` already has its own partial unique index
-- and is kept working alongside this -- see allocatePhotos.
CREATE UNIQUE INDEX IF NOT EXISTS lead_engine_photos_one_per_singleton_slot
  ON public.lead_engine_photos (site_id, slot)
  WHERE slot IN ('hero', 'band');

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.lead_engine_photos_one_per_singleton_slot;
-- DROP INDEX IF EXISTS public.lead_engine_photos_one_per_service;
-- ALTER TABLE public.lead_engine_photos DROP CONSTRAINT IF EXISTS lead_engine_photos_slot_check;
-- ALTER TABLE public.lead_engine_photos DROP COLUMN IF EXISTS slot_key, DROP COLUMN IF EXISTS slot;

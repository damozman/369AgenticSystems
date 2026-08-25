-- Lead Engine — Photo pipeline (docs/PHOTO-REQUIREMENTS.md Part B).
--
-- The original lead_engine_photos row (2026-08-23-lead-engine.sql) assumed one file per photo:
-- storage_path pointed at a single object. Part B stores four resized variants in two encodings
-- each, so the row needs to describe a photo's DIMENSIONS (for the allocator's aspect-ratio
-- preference and for layout-shift-free <img width height>) and its VARIANTS (for srcset), neither
-- of which existed before.
--
-- Idempotent and re-runnable, same discipline as 2026-08-23-lead-engine.sql's own "design layer
-- upgrade" section — schema and code go live separately in this project (no DATABASE_URL, no pg
-- package, so DDL cannot run from a script here), so this file must be safe to apply on either a
-- fresh install or one that already has the table.

ALTER TABLE public.lead_engine_photos ADD COLUMN IF NOT EXISTS width         int;
ALTER TABLE public.lead_engine_photos ADD COLUMN IF NOT EXISTS height        int;
ALTER TABLE public.lead_engine_photos ADD COLUMN IF NOT EXISTS aspect_ratio  numeric;
ALTER TABLE public.lead_engine_photos ADD COLUMN IF NOT EXISTS dominant_hex  text;
ALTER TABLE public.lead_engine_photos ADD COLUMN IF NOT EXISTS variants      jsonb;
ALTER TABLE public.lead_engine_photos ADD COLUMN IF NOT EXISTS is_primary    boolean NOT NULL DEFAULT false;

-- At most one primary photo per site — the customer's stated "best photo" is a single choice, and
-- a second upload marked primary must replace it rather than leave two. Enforced here rather than
-- only in the route, same reasoning as every other limit in this product: a rule enforced only in
-- application code is not a rule the next writer is bound by.
CREATE UNIQUE INDEX IF NOT EXISTS lead_engine_photos_one_primary_per_site
  ON public.lead_engine_photos (site_id) WHERE is_primary;

COMMENT ON COLUMN public.lead_engine_photos.variants IS
  'Every generated size, both encodings: [{"width":480,"webp":"<public URL>","jpg":"<public URL>"}, ...], ascending by width. storage_path stays the largest variant''s webp path, so a pre-Part-B reader that only knows storage_path still gets something to render.';
COMMENT ON COLUMN public.lead_engine_photos.aspect_ratio IS
  'width / height, measured AFTER EXIF rotation is applied — never the source file''s claimed dimensions, which orientation can have swapped. Read by lib/lead-engine/photos.ts to prefer the widest photo for the band and the least-wide for the hero.';
COMMENT ON COLUMN public.lead_engine_photos.is_primary IS
  'The customer''s stated best photo. Overrides sort_order for the hero slot only — see allocatePhotos() in lib/lead-engine/photos.ts.';

-- ── Storage ───────────────────────────────────────────────────────────────────
-- A SECOND bucket, needed only once Part B's routes shipped (2026-08-24): `lead-engine-photos-
-- incoming`, PRIVATE (service-role only, no public read), created by hand in the Supabase
-- dashboard exactly like the original public `lead-engine-photos` bucket — buckets are not DDL.
--
-- Why a second bucket rather than a "private" prefix in the existing one: Vercel Functions cap
-- request/response bodies at 4.5MB (confirmed against Vercel's own docs 2026-08-24), so the raw
-- up-to-20MB original a browser uploads cannot pass through our own route — it goes straight to
-- Storage via a signed URL instead (POST /api/lead-engine/photos/sign). That raw file still
-- carries whatever EXIF/GPS it arrived with; stripping happens in the pipeline AFTER this bucket,
-- not before. Landing it in the public bucket even briefly would be the exact privacy leak
-- docs/PHOTO-REQUIREMENTS.md Part B §5 exists to prevent — a customer's job-site photo is the GPS
-- coordinates of someone's home. See lib/lead-engine/photo-storage.ts for the full path design.

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop index if exists public.lead_engine_photos_one_primary_per_site;
-- alter table public.lead_engine_photos drop column if exists is_primary;
-- alter table public.lead_engine_photos drop column if exists variants;
-- alter table public.lead_engine_photos drop column if exists dominant_hex;
-- alter table public.lead_engine_photos drop column if exists aspect_ratio;
-- alter table public.lead_engine_photos drop column if exists height;
-- alter table public.lead_engine_photos drop column if exists width;

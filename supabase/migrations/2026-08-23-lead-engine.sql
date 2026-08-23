-- Lead Engine — Phase 1. The mini-site product's own tables.
--
-- Lead Engine is a second product line: a fixed-scope mini-site + lead form + light customer
-- dashboard, sold separately from the voice agent and fully useful without it. So it gets its own
-- tenant record rather than an `agent_subscriptions` row.
--
-- WHY NOT agent_subscriptions: that table is voice-shaped. `vertical` and `monthly_cost` are NOT
-- NULL, `tier` is CHECKed against ('Starter','Pro','Elite'), and `lib/onboard-client.ts` BUYS A
-- RETELL PHONE NUMBER before the row is written. A $69/month customer who may never speak to Ava
-- fits none of that, and widening the constraints would mean re-auditing every call site that
-- currently reads "has a subscription row" as "has a provisioned phone agent".
--
-- WHY NOT the `leads` table: it is call-shaped — `call_id REFERENCES calls(id)` and
-- `caller_phone NOT NULL`. A web form submission has neither. Overloading it would repeat this
-- project's most expensive schema mistake, where twelve forms posted one `industry_specific_field`
-- into a column named `service_area` and the database confidently held a prospect's service area
-- as "400".
--
-- The Ava seam is `lead_engine_sites.client_domain`: NULL for every Lead Engine customer until
-- they buy the voice product, at which point the existing provisioning runs unchanged and its
-- `client_domain` is written here. Activating Ava is then a link, not a migration.

-- Defined by supabase/schema.sql, but repeated idempotently so this migration stands alone rather
-- than failing on a project where the trigger below is the first thing to want it.
CREATE OR REPLACE FUNCTION public._set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── lead_engine_sites ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_engine_sites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- The tenant boundary. Matched against the Supabase JWT email, exactly as
  -- `agent_subscriptions.user_email` is — the portal has no user_id concept to reuse.
  owner_email   text NOT NULL,

  -- The public URL segment: /sites/<slug>. Lowercase kebab, validated in lib/lead-engine/slug.ts.
  slug          text NOT NULL UNIQUE,

  business_name text NOT NULL,

  status        text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'awaiting_answers', 'in_build', 'live', 'suspended', 'cancelled')),

  -- Section order, chosen by the customer's buying question rather than by their trade — which is
  -- why roofing and plumbing share one. See lib/lead-engine/theme.ts.
  --
  -- The default is the SAFEST pair, not the commonest: Service Clean carries a page with no photos
  -- at all, so a row created before anyone knows the vertical renders acceptably rather than
  -- broken. NOT NULL for the same reason — a null template is a page with no layout.
  template      text NOT NULL DEFAULT 'service_clean'
    CHECK (template IN ('trade_classic', 'service_clean', 'showcase_grid', 'practice', 'supply')),

  -- Visual identity: palette, type, radius, motion. Independent of template, so a roofer with no
  -- photos gets Service Clean's structure in Ironclad's identity and still reads as a roofer.
  theme         text NOT NULL DEFAULT 'counsel'
    CHECK (theme IN ('ironclad', 'counsel', 'threshold', 'ledger', 'yard', 'clinic')),

  -- The customer's own accent, display face and logo, applied WITHIN a theme. Validated by
  -- lib/lead-engine/theme.ts before it is stored — a logo colour is routinely unusable as an
  -- interface colour, and equipment yellow is a real answer a rental yard will give us.
  --
  -- Deliberately NOT inside `content`: content is customer data, design is not. Keeping them apart
  -- is what lets an operator re-theme a live site with no content diff, and stops a re-submitted
  -- questionnaire from changing how a site looks.
  brand         jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The Ava seam. NULL means "no voice product", which is the normal case and must stay
  -- first-class — same discipline as getProviderForClient() returning null for a client with no
  -- calendar. Deliberately NOT a foreign key: agent_subscriptions.client_domain is a UNIQUE text
  -- column, and an FK would make deleting a churned voice client cascade into a Lead Engine site
  -- that is still paying and still serving traffic.
  client_domain text,

  -- TWO JSONB COLUMNS, AND THE SPLIT IS LOAD-BEARING.
  --
  -- `questionnaire` is what the customer typed. `content` is what actually renders. An operator
  -- edit lands in `content`; a re-submitted questionnaire updates `questionnaire` and flags the
  -- site for review — it never rewrites `content`, so it can never silently change a page that is
  -- already live.
  --
  -- This repo has paid for the opposite twice: the onboarding questionnaire deactivated inventory
  -- rows it had never been shown, and mergePromptWithContext discarded prompt text it had not
  -- written. Both were correct in isolation and both became destructive the moment a second writer
  -- existed. Two writers, one of which thinks it is alone, is a data-loss bug waiting for a date.
  questionnaire jsonb,
  content       jsonb,

  -- Set when `questionnaire` changes under a `content` an operator has already edited.
  needs_review  boolean NOT NULL DEFAULT false,

  -- Where new lead notifications go. Separate from owner_email: the person who pays is often not
  -- the person who chases leads, and sending to the billing address loses the lead quietly.
  notify_email  text,

  -- Revision accounting. 2 included within 30 days of launch; see lib/lead-engine/limits.ts, which
  -- owns the arithmetic. Stored rather than counted from lead_engine_change_requests so that
  -- declining a request, or raising one on the customer's behalf, does not silently move the quota.
  revisions_used int NOT NULL DEFAULT 0,

  launched_at   timestamptz,
  cancelled_at  timestamptz
);

CREATE INDEX IF NOT EXISTS lead_engine_sites_owner_idx  ON public.lead_engine_sites (owner_email);
-- The public renderer's only query. Partial: nothing else ever looks up a non-live site by slug.
CREATE INDEX IF NOT EXISTS lead_engine_sites_live_idx   ON public.lead_engine_sites (slug)
  WHERE status = 'live';

-- Dropped first so the whole file is re-runnable; CREATE TRIGGER has no IF NOT EXISTS.
DROP TRIGGER IF EXISTS lead_engine_sites_updated_at ON public.lead_engine_sites;
CREATE TRIGGER lead_engine_sites_updated_at
  BEFORE UPDATE ON public.lead_engine_sites
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();


-- ── Design layer upgrade, for a database where this file already ran ──────────
--
-- The block above is `CREATE TABLE IF NOT EXISTS`, so on a database that already has the table it
-- is a no-op — including for the three columns just added to it. This section is what actually
-- upgrades an existing install, and it is why the file stays re-runnable rather than becoming a
-- second migration: schema and code go live separately in this project, in whichever order
-- happens, and one file that is safe to run twice is easier to reason about than two that must run
-- in order.
--
-- Applied 2026-08-23 alongside the design layer (five templates instead of three, plus theme and
-- brand). Every statement here is a no-op on a fresh database.

ALTER TABLE public.lead_engine_sites ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE public.lead_engine_sites ADD COLUMN IF NOT EXISTS brand jsonb;

-- Backfill before tightening, or the NOT NULL fails on existing rows.
UPDATE public.lead_engine_sites SET template = 'service_clean' WHERE template IS NULL;
UPDATE public.lead_engine_sites SET theme    = 'counsel'       WHERE theme    IS NULL;
UPDATE public.lead_engine_sites SET brand    = '{}'::jsonb     WHERE brand    IS NULL;

ALTER TABLE public.lead_engine_sites ALTER COLUMN template SET DEFAULT 'service_clean';
ALTER TABLE public.lead_engine_sites ALTER COLUMN template SET NOT NULL;
ALTER TABLE public.lead_engine_sites ALTER COLUMN theme    SET DEFAULT 'counsel';
ALTER TABLE public.lead_engine_sites ALTER COLUMN theme    SET NOT NULL;
ALTER TABLE public.lead_engine_sites ALTER COLUMN brand    SET DEFAULT '{}'::jsonb;
ALTER TABLE public.lead_engine_sites ALTER COLUMN brand    SET NOT NULL;

-- The original CHECK admitted three templates and a NULL. Dropped by its auto-generated name and
-- recreated, because a constraint cannot be widened in place.
ALTER TABLE public.lead_engine_sites DROP CONSTRAINT IF EXISTS lead_engine_sites_template_check;
ALTER TABLE public.lead_engine_sites ADD  CONSTRAINT lead_engine_sites_template_check
  CHECK (template IN ('trade_classic', 'service_clean', 'showcase_grid', 'practice', 'supply'));

ALTER TABLE public.lead_engine_sites DROP CONSTRAINT IF EXISTS lead_engine_sites_theme_check;
ALTER TABLE public.lead_engine_sites ADD  CONSTRAINT lead_engine_sites_theme_check
  CHECK (theme IN ('ironclad', 'counsel', 'threshold', 'ledger', 'yard', 'clinic'));


-- ── lead_engine_submissions ───────────────────────────────────────────────────
-- What the product exists to produce. Everything scopes through site_id; there is no
-- client_domain here, because a Lead Engine customer may never have one.
CREATE TABLE IF NOT EXISTS public.lead_engine_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  site_id      uuid NOT NULL REFERENCES public.lead_engine_sites(id) ON DELETE CASCADE,

  name             text,
  email            text,
  phone            text,
  message          text,
  service_interest text,

  status       text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'won', 'lost', 'spam')),

  -- Whether the business was actually told. A notification failure that reaches no human is
  -- indistinguishable from a lost lead — nine days of submissions vanished in 2026-07 exactly that
  -- way, and the defect was never the pipeline, it was the silence.
  notified_at  timestamptz,
  notify_error text
);

CREATE INDEX IF NOT EXISTS lead_engine_submissions_site_idx ON public.lead_engine_submissions (site_id, created_at DESC);
-- The repair query: delivered rows are the common case, so index only the failures.
CREATE INDEX IF NOT EXISTS lead_engine_submissions_unnotified_idx ON public.lead_engine_submissions (created_at)
  WHERE notified_at IS NULL;


-- ── lead_engine_photos ────────────────────────────────────────────────────────
-- Files live in the `lead-engine-photos` Storage bucket; this table is the ordering and the
-- captions. 12 per site, 5MB each, enforced server-side in the upload route — a limit enforced
-- only in the browser is not a limit.
CREATE TABLE IF NOT EXISTS public.lead_engine_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  site_id      uuid NOT NULL REFERENCES public.lead_engine_sites(id) ON DELETE CASCADE,

  storage_path text NOT NULL UNIQUE,
  caption      text,
  sort_order   int  NOT NULL DEFAULT 0,
  bytes        int,
  content_type text
);

CREATE INDEX IF NOT EXISTS lead_engine_photos_site_idx ON public.lead_engine_photos (site_id, sort_order);


-- ── lead_engine_change_requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_engine_change_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  site_id     uuid NOT NULL REFERENCES public.lead_engine_sites(id) ON DELETE CASCADE,

  body        text NOT NULL,
  status      text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'declined')),

  -- Beyond the included allowance. Recorded rather than refused: a request we decline to do for
  -- free is still a request the customer made, and losing it loses the conversation.
  billable    boolean NOT NULL DEFAULT false,
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS lead_engine_change_requests_site_idx ON public.lead_engine_change_requests (site_id, created_at DESC);


-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Real per-tenant policies, unlike the existing portal tables whose policies are `USING (true)`
-- for any authenticated user. These tables are new and have no browser consumers yet, so there is
-- nothing to black out — this is the safe place to start doing it properly. Existing tables are
-- deliberately untouched; hardening those is its own job with its own staging run.
--
-- Server routes use the service-role key and BYPASS all of this. The policies are the backstop for
-- a forgotten .eq(), not the only gate.

ALTER TABLE public.lead_engine_sites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_engine_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_engine_photos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_engine_change_requests ENABLE ROW LEVEL SECURITY;

-- is_369_admin() is created by 2026-07-24-rls-tenant-isolation-PROPOSED.sql, which is NOT applied.
-- Defined here idempotently so these policies do not depend on that migration ever running.
-- MUST stay in sync with lib/admin.ts ADMIN_EMAILS.
CREATE OR REPLACE FUNCTION public.is_369_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY[
    'chris@369agenticsystems.com'
  ]);
$$;

-- Dropped first for the same reason as the trigger: CREATE POLICY has no IF NOT EXISTS, and this
-- file will be re-run by hand.
DROP POLICY IF EXISTS "lead_engine_sites: owner read"           ON public.lead_engine_sites;
DROP POLICY IF EXISTS "lead_engine_submissions: owner read"     ON public.lead_engine_submissions;
DROP POLICY IF EXISTS "lead_engine_photos: owner read"          ON public.lead_engine_photos;
DROP POLICY IF EXISTS "lead_engine_change_requests: owner read" ON public.lead_engine_change_requests;

-- Owns the site, or is us.
CREATE POLICY "lead_engine_sites: owner read" ON public.lead_engine_sites
  FOR SELECT TO authenticated
  USING (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR public.is_369_admin());

-- No owner UPDATE policy: every write goes through a server route under the service-role key, so
-- granting the browser direct UPDATE would only widen the surface. A customer changing their site
-- raises a change request; that is the product.

-- Children scope through their parent rather than carrying owner_email themselves, so there is
-- exactly one definition of who owns what.
CREATE POLICY "lead_engine_submissions: owner read" ON public.lead_engine_submissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lead_engine_sites s
    WHERE s.id = site_id
      AND (lower(s.owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR public.is_369_admin())
  ));

CREATE POLICY "lead_engine_photos: owner read" ON public.lead_engine_photos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lead_engine_sites s
    WHERE s.id = site_id
      AND (lower(s.owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR public.is_369_admin())
  ));

CREATE POLICY "lead_engine_change_requests: owner read" ON public.lead_engine_change_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lead_engine_sites s
    WHERE s.id = site_id
      AND (lower(s.owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR public.is_369_admin())
  ));

-- Note there is deliberately NO anonymous INSERT policy on lead_engine_submissions. The public
-- form posts to a server route, never to PostgREST — so the visitor's browser never holds a
-- credential that can write to this table, and rate limiting and the honeypot live somewhere they
-- cannot be skipped by posting directly.


-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE  public.lead_engine_sites IS
  'One row per Lead Engine mini-site. Its own tenant record, keyed by owner_email — NOT an agent_subscriptions row, which is voice-shaped and provisions a phone number.';
COMMENT ON COLUMN public.lead_engine_sites.client_domain IS
  'The Ava seam. NULL until this customer also buys the voice product, at which point existing provisioning runs unchanged and its client_domain is written here. Not an FK on purpose: a churned voice client must not cascade-delete a paying mini-site.';
COMMENT ON COLUMN public.lead_engine_sites.questionnaire IS
  'What the customer typed. Never rendered directly — see the `content` column.';
COMMENT ON COLUMN public.lead_engine_sites.template IS
  'Section order, resolved from the vertical at createSite() time. Holds STATED INTENT — the no-photo degrade to service_clean is computed at render and never written back, so a photo uploaded later restores the intended layout with no admin action.';
COMMENT ON COLUMN public.lead_engine_sites.theme IS
  'Visual identity. Independent of template: a roofer with no photos gets Service Clean structure in Ironclad identity, and still reads as a roofer.';
COMMENT ON COLUMN public.lead_engine_sites.brand IS
  'Customer accent, display face and logo, applied within a theme. accent is validated for contrast before storage and accent_mode records which branch fired, so an operator can see that a colour was corrected and why.';
COMMENT ON COLUMN public.lead_engine_sites.content IS
  'What actually renders. An operator edit lands here; a re-submitted questionnaire sets needs_review instead of overwriting it, so a live page can never change under the customer without a human seeing it.';
COMMENT ON COLUMN public.lead_engine_submissions.notify_error IS
  'Why the business was not told. A notification that fails silently is the same as a lost lead.';

-- ── Storage ───────────────────────────────────────────────────────────────────
-- Phase 6 needs a PUBLIC bucket named `lead-engine-photos`, created by hand in the Supabase
-- dashboard (Storage → New bucket → Public). Buckets are not DDL and cannot be created from this
-- file. Uploads go through a server route under the service-role key; public read is what lets a
-- visitor's browser load the images without a signed URL on every request.

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop table if exists public.lead_engine_change_requests;
-- drop table if exists public.lead_engine_photos;
-- drop table if exists public.lead_engine_submissions;
-- drop table if exists public.lead_engine_sites;

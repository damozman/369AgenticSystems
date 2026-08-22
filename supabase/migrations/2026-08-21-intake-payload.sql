-- Persist the intake payload. Dossier build order step 0 — everything else depends on it.
--
-- /api/intake receives company, pain point, service area and website on every submission and
-- stores NONE of them: they ride in the owner-notification email and are then gone. The route's
-- own comment says so ("system_audits has no column for company / pain / service area either").
-- So a dossier generator reading this table today has a domain, an email and a name — nothing to
-- reflect back to a prospect and nothing to do arithmetic with.
--
-- monthly_volume and avg_job_value are added here but are NOT yet collected: the intake form does
-- not ask for them (the ROI calculator does). Adding them now means the form change in step 2 is
-- a form change only, rather than another migration against a live table. They stay null until
-- then, which is honest — null means "never asked", and the dossier must omit a section it has no
-- number for rather than estimate one. That distinction is the whole lesson of the Gumloop
-- dossier this replaces, which invented a security score of 41 for every business it ever saw.
--
-- Purely additive, safe to run anytime.

ALTER TABLE system_audits
  ADD COLUMN IF NOT EXISTS client_company TEXT,
  ADD COLUMN IF NOT EXISTS pain_point     TEXT,
  ADD COLUMN IF NOT EXISTS service_area   TEXT,
  ADD COLUMN IF NOT EXISTS website_url    TEXT,
  ADD COLUMN IF NOT EXISTS monthly_volume INTEGER,
  ADD COLUMN IF NOT EXISTS avg_job_value  NUMERIC(12,2);

-- The dossier looks a prospect up by the address they submitted with, and email-ingest already
-- does the same lookup when a reply arrives. Neither is a primary key — a prospect may submit
-- more than once — so this is an ordinary index, not a unique constraint.
CREATE INDEX IF NOT EXISTS system_audits_client_email_idx
  ON system_audits (client_email);

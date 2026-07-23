-- Adds prospect-context columns to system_audits so /api/email-ingest can look up
-- a replying prospect's prior audit. These fields were already being received in
-- the update-dossier webhook payload but never persisted — the reply-drafter's
-- context lookup has been silently failing for every vertical as a result.
-- Purely additive, safe to run anytime.

ALTER TABLE system_audits
  ADD COLUMN IF NOT EXISTS client_email    TEXT,
  ADD COLUMN IF NOT EXISTS client_name     TEXT,
  ADD COLUMN IF NOT EXISTS client_industry TEXT,
  ADD COLUMN IF NOT EXISTS revenue_leakage TEXT;

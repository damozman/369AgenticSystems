-- Catch-up migration: production Supabase has drifted significantly from
-- schema.sql. Confirmed via a full column-by-column diff against production
-- on 2026-07-12 (every other table matched; these did not). Purely additive —
-- ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS — cannot touch or
-- drop existing data. Safe to run anytime.
--
-- Real impact of the drift before this migration:
--  - calls.recording_url missing        -> every call_ended webhook 500s;
--    duration_seconds/transcript/call_outcome never get saved for live calls.
--  - agent_subscriptions missing 6 cols -> onboard-client.ts throws on every
--    real signup AFTER a live Retell agent + phone number is already created,
--    so the customer gets no welcome email and the Retell resource is orphaned.
--  - client_questionnaires table missing entirely -> the "5-minute business
--    questionnaire" advertised as live on all 9 cold-email pages has been
--    failing on every submission (app/api/questionnaire/submit/route.ts) and
--    the KB-sync cron (app/api/cron/sync-questionnaire-kb) has nothing to read.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS recording_url TEXT;

CREATE INDEX IF NOT EXISTS idx_calls_transcript
  ON calls USING GIN(to_tsvector('english', transcript))
  WHERE transcript IS NOT NULL;

ALTER TABLE agent_subscriptions
  ADD COLUMN IF NOT EXISTS retell_agent_id     TEXT,
  ADD COLUMN IF NOT EXISTS retell_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS preferred_area_code TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone         TEXT,
  ADD COLUMN IF NOT EXISTS sms_phone_number    TEXT,
  ADD COLUMN IF NOT EXISTS followup_method     TEXT DEFAULT 'email';

-- Needed for the in-progress hardcoded-domain fix (agent_id -> client_domain lookup)
CREATE INDEX IF NOT EXISTS idx_subscriptions_retell_agent
  ON agent_subscriptions(retell_agent_id);

CREATE TABLE IF NOT EXISTS client_questionnaires (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  client_domain         TEXT        NOT NULL UNIQUE REFERENCES agent_subscriptions(client_domain) ON DELETE CASCADE,

  respondent_role       TEXT,
  pain_point            TEXT,
  service_types         TEXT,
  avg_job_value         TEXT,
  has_emergency_service BOOLEAN,
  emergency_contact     TEXT,
  response_time         TEXT,
  common_objections     TEXT,
  jargon                TEXT,
  other_notes           TEXT,

  completed_at          TIMESTAMPTZ,
  kb_uploaded_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_questionnaires_domain ON client_questionnaires(client_domain);

ALTER TABLE client_questionnaires ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "client_questionnaires: owner access" ON client_questionnaires FOR SELECT TO authenticated USING (
    client_domain IN (SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "client_questionnaires: owner write" ON client_questionnaires FOR UPDATE TO authenticated USING (
    client_domain IN (SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "client_questionnaires: owner insert" ON client_questionnaires FOR INSERT TO authenticated WITH CHECK (
    client_domain IN (SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

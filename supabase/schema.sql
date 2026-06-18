-- ─────────────────────────────────────────────────────────────────────────────
-- 369 Agentic Systems — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New Query)
-- ─────────────────────────────────────────────────────────────────────────────

-- Phase 2 dependency: pgvector for Business Memory embeddings
CREATE EXTENSION IF NOT EXISTS vector;


-- ── clients ──────────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        UNIQUE NOT NULL,
  company_name TEXT,
  industry     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- auto-bump updated_at
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();


-- ── specialists ──────────────────────────────────────────────────────────────
CREATE TABLE specialists (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID        REFERENCES clients(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  industry      TEXT        NOT NULL,
  status        TEXT        DEFAULT 'active'
                            CHECK (status IN ('active', 'processing', 'idle')),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  tasks_today   INT         DEFAULT 0,
  accent_color  TEXT        DEFAULT '#D4AF37',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ── dossier_logs ─────────────────────────────────────────────────────────────
-- Populated by /api/update-dossier (Gumloop webhook receiver)
CREATE TABLE dossier_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID        REFERENCES clients(id) ON DELETE CASCADE,
  specialist_id UUID        REFERENCES specialists(id),
  source_tag    TEXT        NOT NULL,                  -- e.g. 369AS_ROOFING_INTAKE
  payload       JSONB       NOT NULL DEFAULT '{}',     -- full intake payload
  output        TEXT,                                  -- Gumloop-generated dossier text
  status        TEXT        DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ── business_memory ──────────────────────────────────────────────────────────
-- Phase 2: vectorized client context for RAG queries in Gumloop
CREATE TABLE business_memory (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID        REFERENCES clients(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL
             CHECK (category IN ('pain_point', 'roi_data', 'lead_pattern', 'agent_insight')),
  content    TEXT        NOT NULL,
  embedding  VECTOR(1536),            -- OpenAI text-embedding-3-small / ada-002
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for cosine similarity search (Phase 2 queries)
CREATE INDEX business_memory_embedding_idx
  ON business_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossier_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_memory ENABLE ROW LEVEL SECURITY;

-- Clients see only their own record (matched by JWT email claim)
CREATE POLICY "clients: own record"
  ON clients FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- Specialists, logs, and memory are scoped to the authenticated client
CREATE POLICY "specialists: own client"
  ON specialists FOR SELECT
  USING (client_id IN (
    SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY "dossier_logs: own client"
  ON dossier_logs FOR SELECT
  USING (client_id IN (
    SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY "business_memory: own client"
  ON business_memory FOR SELECT
  USING (client_id IN (
    SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
  ));

-- Service-role key (used by /api/update-dossier) bypasses RLS automatically.
-- No additional policies are needed for server-side writes.


-- ── Receptionist Wedge Tables ─────────────────────────────────────────────────
-- Added for the Speed-to-Lead AOS: Retell → Vercel → Supabase → dashboard

-- CALLS: every inbound call from Retell
CREATE TABLE IF NOT EXISTS calls (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  client_domain    TEXT        NOT NULL,
  call_id          TEXT        UNIQUE NOT NULL,  -- Retell's call ID string
  caller_phone     TEXT        NOT NULL,
  caller_name      TEXT,
  duration_seconds INT,
  transcript       TEXT,
  call_outcome     TEXT,  -- 'in_progress' | 'booked' | 'captured_lead' | 'no_answer' | 'spam'
  captured_at      TIMESTAMPTZ
);

CREATE INDEX idx_calls_client  ON calls(client_domain);
CREATE INDEX idx_calls_outcome ON calls(call_outcome);
CREATE INDEX idx_calls_created ON calls(created_at DESC);


-- LEADS: caller info captured during a call
CREATE TABLE IF NOT EXISTS leads (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ DEFAULT now(),
  client_domain      TEXT        NOT NULL,
  call_id            UUID        REFERENCES calls(id) ON DELETE CASCADE,
  caller_phone       TEXT        NOT NULL,
  caller_name        TEXT,
  caller_address     TEXT,
  caller_email       TEXT,
  issue_description  TEXT,
  urgency            TEXT        DEFAULT 'normal',  -- 'low' | 'normal' | 'high' | 'emergency'
  follow_up_sent     BOOLEAN     DEFAULT FALSE,
  follow_up_sent_at  TIMESTAMPTZ,
  status             TEXT        DEFAULT 'open'    -- 'open' | 'contacted' | 'converted' | 'spam'
);

CREATE INDEX idx_leads_client  ON leads(client_domain);
CREATE INDEX idx_leads_status  ON leads(status);
CREATE INDEX idx_leads_phone   ON leads(caller_phone);


-- BOOKINGS: appointments booked during a call
CREATE TABLE IF NOT EXISTS bookings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  client_domain         TEXT        NOT NULL,
  call_id               UUID        REFERENCES calls(id) ON DELETE CASCADE,
  lead_id               UUID        REFERENCES leads(id) ON DELETE CASCADE,
  appointment_date      TIMESTAMP   NOT NULL,
  appointment_time      TEXT        NOT NULL,
  service_type          TEXT,
  location              TEXT,
  confirmation_sent     BOOLEAN     DEFAULT FALSE,
  confirmation_sent_at  TIMESTAMPTZ,
  status                TEXT        DEFAULT 'scheduled'  -- 'scheduled' | 'completed' | 'cancelled'
);

CREATE INDEX idx_bookings_client ON bookings(client_domain);
CREATE INDEX idx_bookings_date   ON bookings(appointment_date);
CREATE INDEX idx_bookings_status ON bookings(status);


-- RLS: enable + authenticated read for admin portal
ALTER TABLE calls    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls: authenticated read"    ON calls    FOR SELECT TO authenticated USING (true);
CREATE POLICY "leads: authenticated read"    ON leads    FOR SELECT TO authenticated USING (true);
CREATE POLICY "bookings: authenticated read" ON bookings FOR SELECT TO authenticated USING (true);
-- Service-role key (used by API routes) bypasses RLS for writes automatically.


-- ── Phase 2: Client Subscription & Auto-Activation Tables ────────────────────
-- Run in Supabase SQL Editor after the receptionist wedge tables above.

-- AGENT_SUBSCRIPTIONS: one row per paying client — tier, vertical, active agents
CREATE TABLE IF NOT EXISTS agent_subscriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ DEFAULT now(),
  client_domain  TEXT        NOT NULL UNIQUE,
  user_email     TEXT        NOT NULL,
  vertical       TEXT        NOT NULL,  -- 'roofing' | 'hvac' | 'plumbing' | 'dental'
  tier           TEXT        NOT NULL CHECK (tier IN ('Starter', 'Pro', 'Elite')),
  active_agents  TEXT[]      NOT NULL DEFAULT '{}',
  monthly_cost   INT         NOT NULL,
  setup_paid     BOOLEAN     DEFAULT FALSE,
  activated_at   TIMESTAMPTZ
);

CREATE INDEX idx_subscriptions_email  ON agent_subscriptions(user_email);
CREATE INDEX idx_subscriptions_domain ON agent_subscriptions(client_domain);

-- AGENT_CONFIGURATIONS: system prompts + settings per agent per client
CREATE TABLE IF NOT EXISTS agent_configurations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ DEFAULT now(),
  client_domain     TEXT        NOT NULL REFERENCES agent_subscriptions(client_domain) ON DELETE CASCADE,
  agent_type        TEXT        NOT NULL,  -- 'receptionist' | 'followup' | 'reviews'
  vertical          TEXT        NOT NULL,
  system_prompt     TEXT,
  email_sequences   JSONB,
  triggered_metrics JSONB,
  activated_at      TIMESTAMPTZ
);

CREATE INDEX idx_agent_configs_domain ON agent_configurations(client_domain);

-- NOTIFICATIONS: auto-activation upgrade suggestions surfaced on client dashboard
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  client_domain TEXT        NOT NULL,
  type          TEXT        NOT NULL,  -- 'upgrade_suggestion' | 'milestone' | 'alert'
  title         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  action        TEXT,
  dismissed     BOOLEAN     DEFAULT FALSE
);

CREATE INDEX idx_notifications_domain    ON notifications(client_domain);
CREATE INDEX idx_notifications_dismissed ON notifications(dismissed);

-- RLS: enable + authenticated read for admin portal
ALTER TABLE agent_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_subscriptions: authenticated read"  ON agent_subscriptions  FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent_configurations: authenticated read" ON agent_configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications: authenticated read"        ON notifications        FOR SELECT TO authenticated USING (true);
-- Service-role key (used by API routes) bypasses RLS for writes automatically.


-- ── system_audits ─────────────────────────────────────────────────────────────
-- Populated by /api/update-dossier (Gumloop webhook receiver).
-- Rows have no user_id — this is an admin-wide view; all authenticated portal
-- users can read all audits.  The server component uses the service-role client
-- as a belt-and-suspenders guard, but the policy below is the canonical fix.
CREATE TABLE IF NOT EXISTS system_audits (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  client_domain  TEXT        NOT NULL,
  security_score NUMERIC,
  seo_visibility NUMERIC,
  lead_velocity  NUMERIC,
  leak_detected  BOOLEAN,
  roi_multiplier NUMERIC,
  payload_status TEXT        DEFAULT 'pending'
);

ALTER TABLE system_audits ENABLE ROW LEVEL SECURITY;

-- Authenticated portal users can read all audit rows.
CREATE POLICY "system_audits: authenticated read"
  ON system_audits FOR SELECT
  TO authenticated
  USING (true);

-- Service-role INSERT from /api/update-dossier bypasses RLS — no policy needed.


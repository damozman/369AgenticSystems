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

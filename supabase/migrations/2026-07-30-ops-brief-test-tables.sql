-- Ops-Brief Parsing Engine v1 (wholesale test harness, internal admin tool only).
-- Not a client-facing feature — see docs/next-opportunities.md and the OPS-BRIEF-PARSING-BLUEPRINT
-- this was built from. Purely additive, safe to run anytime.

-- OPS_UPLOADS: one row per uploaded test file. parsed_rows stores the cleaned rows
-- directly (no Supabase Storage bucket exists yet, and this is throwaway test data —
-- raw file bytes are discarded after parsing, not persisted).
CREATE TABLE IF NOT EXISTS ops_uploads (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ DEFAULT now(),
  client_label         TEXT        NOT NULL,  -- free text, not a clients FK — no real client yet
  vertical             TEXT        NOT NULL DEFAULT 'wholesale',
  original_filename    TEXT        NOT NULL,
  row_count            INT,
  detected_header_row  INT,
  headers              TEXT[],
  parsed_rows          JSONB,
  parse_status         TEXT        NOT NULL DEFAULT 'parsed',  -- 'parsed' | 'failed'
  error_message         TEXT
);

CREATE INDEX idx_ops_uploads_client ON ops_uploads(client_label, vertical);


-- OPS_COLUMN_MAPPINGS: confirmed field->column mapping, keyed by (client_label, vertical)
-- so a repeat upload from the same test "client" reuses the mapping AND the header-row
-- position and skips the Claude proposal step entirely (same export format, same header
-- row, almost always, for a repeat upload from the same source system).
CREATE TABLE IF NOT EXISTS ops_column_mappings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  client_label        TEXT        NOT NULL,
  vertical            TEXT        NOT NULL DEFAULT 'wholesale',
  header_row_index    INT         NOT NULL,
  mapping             JSONB       NOT NULL,
  confidence          JSONB,
  UNIQUE (client_label, vertical)
);


-- OPS_METRIC_SNAPSHOTS: computed metrics for a given upload.
CREATE TABLE IF NOT EXISTS ops_metric_snapshots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  upload_id     UUID        REFERENCES ops_uploads(id) ON DELETE CASCADE,
  client_label  TEXT        NOT NULL,
  vertical      TEXT        NOT NULL DEFAULT 'wholesale',
  metrics       JSONB       NOT NULL
);

CREATE INDEX idx_ops_metric_snapshots_upload ON ops_metric_snapshots(upload_id);


-- RLS: enable + authenticated read (admin-only tool; writes go through the
-- service-role key in the API routes, same convention as the rest of schema.sql).
ALTER TABLE ops_uploads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_column_mappings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_uploads: authenticated read"          ON ops_uploads          FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_column_mappings: authenticated read"  ON ops_column_mappings  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_metric_snapshots: authenticated read" ON ops_metric_snapshots FOR SELECT TO authenticated USING (true);

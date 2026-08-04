-- Audit calls: the "we called your line" artifact (plan Phase 2b).
--
-- Deliberately a separate table from `calls`. `calls` holds inbound calls a paying client's
-- agent answered, and every dashboard metric, ROI figure and weekly digest reads from it.
-- Outbound audit calls we place at prospects are the opposite direction and belong to no
-- client, so filing them there would silently inflate a client's own numbers.
--
-- NOTE: schema.sql is not guaranteed to match production. Probe the live database before
-- assuming this applied cleanly — three tables were found drifted on 2026-07-12.

create table if not exists public.audit_calls (
  id            uuid primary key default gen_random_uuid(),

  -- Who we called.
  target_phone  text        not null,
  business_name text,
  domain        text,
  vertical      text,

  -- Retell's handle on the call. Null only if the create request itself failed.
  call_id       text unique,

  -- Lifecycle: 'placed' until Retell's call_ended webhook resolves it.
  status        text        not null default 'placed'
    check (status in ('placed', 'resolved', 'failed')),

  -- Resolved outcome, from lib/audit-call.ts. Null while status = 'placed'.
  --   reportable = false means the call failed on OUR side (dial failure, invalid
  --   number, carrier block) and establishes nothing about the business. Those rows
  --   MUST be excluded from any published percentage — see unreachedShare().
  reportable    boolean,
  outcome       text
    check (outcome is null or outcome in
      ('answered_human', 'voicemail', 'ivr', 'no_answer', 'busy')),
  unreportable  text
    check (unreportable is null or unreportable in
      ('our_infrastructure', 'invalid_number', 'blocked', 'inconclusive')),

  -- The exact sentence shown to the prospect. Stored rather than regenerated so what
  -- we told someone is auditable later, even if the wording changes.
  sentence      text,
  detail        text,
  raw_reason    text,

  called_at     timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists audit_calls_status_idx   on public.audit_calls (status);
create index if not exists audit_calls_called_at_idx on public.audit_calls (called_at desc);
-- The bulk statistic only ever counts reportable rows; index the filter it uses.
create index if not exists audit_calls_reportable_idx on public.audit_calls (reportable)
  where reportable is true;

-- Service-role only. No client ever reads this table, and nothing here is tenant-scoped,
-- so there is no legitimate anon/authenticated access path to open up.
alter table public.audit_calls enable row level security;

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop table if exists public.audit_calls;

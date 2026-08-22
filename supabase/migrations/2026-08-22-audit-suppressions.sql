-- "Stop calling me." Dossier step 5.
--
-- Ava cannot honestly offer an opt-out on the callback line until refusing is a thing the system
-- can actually do. Without this table she would say "tell me and I'll stop it" and then nothing
-- would stop — the exact class of promise this repo has already had to strip out twice (the SMS
-- that could not send, the quote that did not exist).
--
-- Keyed on the PHONE NUMBER, not the audit row. A person saying "don't call me again" is talking
-- about their phone, and the same number can appear on several submissions — a prospect who fills
-- the form twice must not be dialled again because the second row never heard the refusal.
--
-- E.164 only. toE164() normalises before both writing and reading, so "(817) 555-1212" and
-- "+18175551212" cannot become two different rows, one of which is not honoured.

CREATE TABLE IF NOT EXISTS public.audit_suppressions (
  phone      text primary key,

  -- Why we stopped. 'requested' is someone asking; the rest are ours to be careful about.
  reason     text not null default 'requested'
    CHECK (reason IN ('requested', 'complaint', 'wrong_number', 'manual')),

  -- Where the refusal came from, so a disputed suppression can be traced.
  source     text,
  note       text,
  created_at timestamptz not null default now()
);

-- Service-role only. Nothing tenant-scoped here and no client ever reads it.
ALTER TABLE public.audit_suppressions ENABLE ROW LEVEL SECURITY;

-- A call that was planned and then called off. Distinct from 'failed', which is OUR fault and
-- means something went wrong; a cancelled call is the system behaving correctly.
ALTER TABLE public.audit_calls DROP CONSTRAINT IF EXISTS audit_calls_status_check;
ALTER TABLE public.audit_calls ADD CONSTRAINT audit_calls_status_check
  CHECK (status IN ('scheduled', 'placed', 'resolved', 'failed', 'cancelled'));

COMMENT ON TABLE public.audit_suppressions IS
  'Numbers that must never be dialled by the audit caller. Checked at dispatch time, keyed on the E.164 number rather than on a submission.';

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- alter table public.audit_calls drop constraint if exists audit_calls_status_check;
-- alter table public.audit_calls add constraint audit_calls_status_check
--   check (status in ('scheduled','placed','resolved','failed'));
-- drop table if exists public.audit_suppressions;

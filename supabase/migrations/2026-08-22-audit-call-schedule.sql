-- The two-call audit schedule. Dossier step 5.
--
-- `audit_calls` was built for a single call placed immediately: a row appears in 'placed' and the
-- Retell webhook resolves it. The dossier needs two calls per prospect — one in business hours,
-- one late evening — planned in advance and dialled later by a cron, because the comparison
-- between them is the entire artifact:
--
--   "We called at 10:32 AM and someone picked up. We called again at 8:41 PM and it went to
--    voicemail. Same number, same day. The difference was the hour."
--
-- Three columns carry that, and a fourth lifecycle state for a call that exists but has not been
-- dialled yet.
--
-- Purely additive. Existing rows keep working: they have no audit_id and no slot, and the
-- single-call path never reads these.

ALTER TABLE public.audit_calls
  -- The intake submission this call belongs to. Not a foreign key: system_audits rows are swept
  -- by verification scripts and a cascade would silently delete call history that is evidence of
  -- what we told someone. Null for the Phase 2b single-call path, which had no submission.
  ADD COLUMN IF NOT EXISTS audit_id      uuid,

  -- Which half of the pair. Null for legacy single calls.
  ADD COLUMN IF NOT EXISTS slot          text,

  -- When the cron should dial. Null means "dial immediately", the old behaviour.
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- 'scheduled' is a call that has been planned but NOT yet dialled — it has no call_id and has
-- cost nothing. The existing check constraint has to be replaced rather than added to.
ALTER TABLE public.audit_calls DROP CONSTRAINT IF EXISTS audit_calls_status_check;
ALTER TABLE public.audit_calls ADD CONSTRAINT audit_calls_status_check
  CHECK (status IN ('scheduled', 'placed', 'resolved', 'failed'));

ALTER TABLE public.audit_calls DROP CONSTRAINT IF EXISTS audit_calls_slot_check;
ALTER TABLE public.audit_calls ADD CONSTRAINT audit_calls_slot_check
  CHECK (slot IS NULL OR slot IN ('business', 'evening'));

-- One call per slot per submission. This is the guard that stops a cron running twice — or two
-- crons overlapping — from dialling a prospect's phone twice for the same slot. A duplicate call
-- to a stranger is worse than a missed one, and it costs money each time.
CREATE UNIQUE INDEX IF NOT EXISTS audit_calls_audit_slot_idx
  ON public.audit_calls (audit_id, slot)
  WHERE audit_id IS NOT NULL AND slot IS NOT NULL;

-- The cron's own query: everything due, oldest first.
CREATE INDEX IF NOT EXISTS audit_calls_due_idx
  ON public.audit_calls (scheduled_for)
  WHERE status = 'scheduled';

COMMENT ON COLUMN public.audit_calls.audit_id IS
  'The system_audits row this call was placed for. Deliberately not a FK — verification scripts sweep system_audits and a cascade would delete evidence of what we told a prospect.';
COMMENT ON COLUMN public.audit_calls.slot IS
  'business = the in-hours call, evening = the after-hours call. The pair is the artifact; neither alone is a rate.';
COMMENT ON COLUMN public.audit_calls.scheduled_for IS
  'When the cron should dial. A row in status=scheduled has not been dialled and has cost nothing.';

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop index if exists audit_calls_due_idx;
-- drop index if exists audit_calls_audit_slot_idx;
-- alter table public.audit_calls drop constraint if exists audit_calls_slot_check;
-- alter table public.audit_calls drop column if exists scheduled_for, drop column if exists slot, drop column if exists audit_id;

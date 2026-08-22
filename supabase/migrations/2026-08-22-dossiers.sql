-- The dossier queue. Step 6 — the approval gate and the send.
--
-- Chris's decision, 2026-08-20: the approval gate is ON. Every dossier is read by a human before a
-- prospect sees it, until there is enough of a track record to trust it unread. His own warning is
-- recorded with it and matters more than the table: **an approval queue nobody clears is where
-- this dies.** Hence `dossier_nudge`, and hence the pending count in it.
--
-- The RENDERED HTML is stored, not regenerated at send time. Same reasoning as
-- `audit_calls.sentence`: what we actually told someone has to be auditable later, even after the
-- template changes underneath. A dossier regenerated six months on would answer "what did we send
-- them?" with today's wording, which is a different question.

CREATE TABLE IF NOT EXISTS public.dossiers (
  id          uuid primary key default gen_random_uuid(),

  -- The submission this was built for. One dossier per submission — the unique index below is what
  -- stops a cron running twice from queueing two, and later mailing a prospect the same thing
  -- twice.
  audit_id    uuid not null,

  -- Where it goes. Copied at build time rather than joined at send time, so a later edit to the
  -- audit row cannot silently redirect an already-approved dossier to a different address.
  to_email    text not null,

  status      text not null default 'pending'
    CHECK (status IN ('pending', 'approved', 'sent', 'declined', 'failed')),

  subject     text not null,
  html        text not null,

  -- What the builder chose to leave out, and why. Operator-facing: it is how Chris can see that a
  -- thin dossier is thin because the evidence was thin, not because something broke.
  omitted     jsonb,

  decline_reason text,
  send_error     text,

  built_at    timestamptz not null default now(),
  approved_at timestamptz,
  sent_at     timestamptz
);

-- One dossier per submission. The real guard against double-sending.
CREATE UNIQUE INDEX IF NOT EXISTS dossiers_audit_id_idx ON public.dossiers (audit_id);

-- The queue's own query, and the nudge's count.
CREATE INDEX IF NOT EXISTS dossiers_pending_idx ON public.dossiers (built_at)
  WHERE status = 'pending';

-- Service-role only. Approval happens through a signed link, not a logged-in client.
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.dossiers IS
  'Built dossiers awaiting owner approval. The rendered HTML is stored rather than regenerated so what we told a prospect stays auditable after the template changes.';
COMMENT ON COLUMN public.dossiers.status IS
  'pending -> approved -> sent. declined is a human saying no; failed is the send itself erroring, which is ours to fix and retry.';

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop table if exists public.dossiers;

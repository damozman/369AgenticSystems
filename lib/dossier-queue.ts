/**
 * When a dossier is ready to build, and whether it may be sent. Step 6.
 *
 * Pure — rows and a clock in, decisions out. The cron and the approval route are thin wrappers.
 *
 * **The dossier is never held for the second call.** The design settled this: a prospect who
 * submits at 10 AM and hears nothing until the next morning has already moved on. It is built once
 * the FIRST call resolves, and the second call becomes the morning follow-up carrying the
 * comparison. So "ready" does not mean "everything has arrived" — it means "waiting longer stops
 * being worth what it costs".
 */

export type CallState = { status: string; slot: string | null }

export interface QueueCandidate {
  auditId: string
  /** When the prospect submitted. */
  submittedAt: string
  email: string | null
  /** Every audit call row for this submission. Empty when calling is switched off. */
  calls: CallState[]
  /** True when a dossier row already exists for this submission. */
  alreadyQueued: boolean
}

export type NotReadyReason =
  | 'already_queued'
  | 'no_email'
  | 'awaiting_first_call'
  | 'too_soon'

export interface ReadinessDecision {
  auditId: string
  ready: boolean
  reason?: NotReadyReason
}

/**
 * How long to wait for a call before building without one.
 *
 * Calling may be switched off, a number may be undialable, or both calls may have failed on our
 * side. None of those should mean the prospect gets nothing — the dossier still has what they told
 * us, their website and the arithmetic, and section 2 is simply omitted.
 *
 * Two hours is comfortably past the point where the first scheduled call would have resolved, and
 * well inside the 24-hour reply the intake page already promises.
 */
export const BUILD_WITHOUT_CALLS_AFTER_MS = 2 * 60 * 60 * 1000

/** A call that will never tell us anything more. */
const SETTLED = new Set(['resolved', 'failed', 'cancelled'])

export function decideReadiness(c: QueueCandidate, now: Date): ReadinessDecision {
  if (c.alreadyQueued) return { auditId: c.auditId, ready: false, reason: 'already_queued' }

  // No address, no dossier. Building one we cannot deliver just fills the queue Chris has to clear.
  if (!c.email?.includes('@')) return { auditId: c.auditId, ready: false, reason: 'no_email' }

  const settled = c.calls.filter(k => SETTLED.has(k.status))
  if (settled.length > 0) return { auditId: c.auditId, ready: true }

  // Nothing settled yet. Wait — but not forever, and not if there was never going to be a call.
  const age = now.getTime() - new Date(c.submittedAt).getTime()
  if (Number.isNaN(age)) return { auditId: c.auditId, ready: false, reason: 'too_soon' }
  if (age >= BUILD_WITHOUT_CALLS_AFTER_MS) return { auditId: c.auditId, ready: true }

  return {
    auditId: c.auditId,
    ready: false,
    reason: c.calls.length ? 'awaiting_first_call' : 'too_soon',
  }
}

export function readyToBuild(candidates: QueueCandidate[], now: Date): QueueCandidate[] {
  return candidates.filter(c => decideReadiness(c, now).ready)
}

// ── The approval gate ───────────────────────────────────────────────────────

export type SendRefusal =
  | 'not_pending'      // already approved, sent, or declined
  | 'already_sent'
  | 'no_recipient'
  | 'empty'

/**
 * Whether an approved dossier may actually be mailed.
 *
 * Deliberately separate from readiness: approval is a human saying "this is true and worth
 * sending", and this is the machine's last check that nothing changed underneath. Both have to
 * pass.
 */
export function canSend(row: {
  status: string
  to_email: string | null
  html: string | null
  sent_at?: string | null
}): { ok: true } | { ok: false; reason: SendRefusal } {
  if (row.sent_at) return { ok: false, reason: 'already_sent' }
  if (row.status === 'sent') return { ok: false, reason: 'already_sent' }
  if (row.status !== 'pending' && row.status !== 'approved') {
    return { ok: false, reason: 'not_pending' }
  }
  if (!row.to_email?.includes('@')) return { ok: false, reason: 'no_recipient' }
  if (!row.html?.trim()) return { ok: false, reason: 'empty' }
  return { ok: true }
}

/**
 * The nudge's own message.
 *
 * Chris's warning, recorded when the gate was agreed: *an approval queue nobody clears is where
 * this dies.* So the nudge states the count and the age of the oldest, because "3 waiting" is
 * ignorable and "3 waiting, oldest 4 days" is not.
 */
export function nudgeSummary(pending: Array<{ built_at: string }>, now: Date): string | null {
  if (!pending.length) return null
  const oldest = pending.reduce((a, b) => (a.built_at < b.built_at ? a : b))
  const days = Math.floor((now.getTime() - new Date(oldest.built_at).getTime()) / 86_400_000)
  const n = pending.length
  const noun = n === 1 ? 'dossier is' : 'dossiers are'
  const age = days <= 0 ? 'the oldest arrived today'
    : days === 1 ? 'the oldest has been waiting a day'
    : `the oldest has been waiting ${days} days`
  return `${n} ${noun} waiting for you, and ${age}.`
}

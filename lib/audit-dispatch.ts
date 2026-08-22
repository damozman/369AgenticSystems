/**
 * Decides which audit calls may be placed, and when. Dossier step 5.
 *
 * Pure. Every function takes rows and a clock and returns a decision, so the rules below are
 * testable without Retell, a database, or waiting for an evening. The cron route is the thin part
 * that fetches, calls these, and writes.
 *
 * **The switch is off, and that is not caution — it is a correctness requirement.**
 *
 * The intake form does NOT yet carry the line *"as part of your audit we place a test call to your
 * published number."* It was deliberately held back at step 2 because there was no audit agent, and
 * telling every submitter we would call when nobody would have been a promise the system could not
 * keep. The inverse is worse: **calling someone who was never told is the version that costs a
 * customer**, and it is the one thing this whole pipeline is supposed to be incapable of.
 *
 * So `AUDIT_CALLS_ENABLED` must be exactly `'true'`, and it flips in the same change that puts the
 * disclosure on the form. Copy and capability ship together — this repo has already shipped that
 * mistake once, advertising minutes ahead of a working meter.
 */

import type { CallSlot } from '@/lib/audit-schedule'

/** A scheduled call as stored. Only the fields the decisions need. */
export interface ScheduledCall {
  id: string
  audit_id: string | null
  slot: CallSlot | null
  scheduled_for: string | null
  status: string
  target_phone: string
  call_id: string | null
  /** Carried through to Retell's call metadata. Not used by any decision here. */
  business_name?: string | null
  domain?: string | null
  vertical?: string | null
}

export type SkipReason =
  | 'disabled'          // the master switch is off
  | 'not_due'           // its time has not arrived
  | 'already_placed'    // it has a call_id, or is past 'scheduled'
  | 'no_phone'          // nothing dialable on the row
  | 'no_slot'           // not part of a pair; the single-call path owns it
  | 'too_late'          // its window passed while we were not looking

export interface DispatchDecision {
  call: ScheduledCall
  place: boolean
  reason?: SkipReason
}

/**
 * The master switch. Exactly `'true'`, nothing else.
 *
 * Not `Boolean(process.env.X)` and not a truthy check: `'false'`, `'0'` and `'no'` are all truthy
 * strings, and a switch that turns itself on when someone writes `AUDIT_CALLS_ENABLED=false` is
 * worse than no switch. Same shape as `USAGE_BILLING_ENABLED`, for the same reason.
 */
export function auditCallsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUDIT_CALLS_ENABLED === 'true'
}

/**
 * How long after its scheduled time a call may still be placed.
 *
 * A cron that was down for a day must not wake up and dial someone at 3 AM because a row from
 * yesterday evening is "due". Past this, the call is abandoned rather than placed late — a missed
 * audit call costs us one section of one dossier; a call at the wrong hour costs the relationship.
 */
export const MAX_LATENESS_MS = 90 * 60_000

/** Decides one call. */
export function decideOne(
  call: ScheduledCall,
  now: Date,
  env: NodeJS.ProcessEnv = process.env,
): DispatchDecision {
  if (!auditCallsEnabled(env)) return { call, place: false, reason: 'disabled' }
  if (call.status !== 'scheduled' || call.call_id) {
    return { call, place: false, reason: 'already_placed' }
  }
  if (!call.slot) return { call, place: false, reason: 'no_slot' }
  if (!call.target_phone?.trim()) return { call, place: false, reason: 'no_phone' }
  if (!call.scheduled_for) return { call, place: false, reason: 'not_due' }

  const due = new Date(call.scheduled_for).getTime()
  if (Number.isNaN(due)) return { call, place: false, reason: 'not_due' }

  const delta = now.getTime() - due
  if (delta < 0) return { call, place: false, reason: 'not_due' }
  if (delta > MAX_LATENESS_MS) return { call, place: false, reason: 'too_late' }

  return { call, place: true }
}

/**
 * Decides a batch, and enforces the one rule a per-row decision cannot see.
 *
 * **At most one call per prospect per run.** Two rows for the same `audit_id` can both come due
 * after an outage, and dialling a stranger's phone twice inside a minute is not an audit — it is a
 * nuisance call, and it destroys the very thing the second call is meant to measure. The other one
 * either waits for the next run or ages out.
 */
export function decideBatch(
  calls: ScheduledCall[],
  now: Date,
  env: NodeJS.ProcessEnv = process.env,
): DispatchDecision[] {
  const seen = new Set<string>()
  const decisions: DispatchDecision[] = []

  // Oldest first, so the call that has waited longest wins its prospect's slot this run.
  const ordered = [...calls].sort((a, b) =>
    (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? ''))

  for (const call of ordered) {
    const d = decideOne(call, now, env)
    if (d.place && call.audit_id) {
      if (seen.has(call.audit_id)) {
        decisions.push({ call, place: false, reason: 'not_due' })
        continue
      }
      seen.add(call.audit_id)
    }
    decisions.push(d)
  }
  return decisions
}

/** The rows to actually dial. */
export function toPlace(decisions: DispatchDecision[]): ScheduledCall[] {
  return decisions.filter(d => d.place).map(d => d.call)
}

/** A one-line summary for the cron log, so a run that did nothing says why. */
export function summarise(decisions: DispatchDecision[]): string {
  if (!decisions.length) return 'no scheduled audit calls'
  const counts = new Map<string, number>()
  for (const d of decisions) {
    const key = d.place ? 'placing' : (d.reason ?? 'skipped')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([k, v]) => `${k}=${v}`).join(' ')
}

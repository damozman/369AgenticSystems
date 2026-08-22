/**
 * Enrols a fresh intake submission into the two-call audit sequence. Dossier step 5.
 *
 * Called from `/api/intake` **after** the lead row is committed, and it never throws. Capture is
 * the one thing that route exists to guarantee; scheduling a call is best-effort on top of it, and
 * a failure here must cost a phone call rather than a prospect.
 *
 * **Nothing is written while `AUDIT_CALLS_ENABLED` is off.** Rows written now would only age out
 * before anyone could use them, and more importantly the intake form does not yet tell submitters
 * that we call. The switch, the disclosure and these rows all arrive together.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { planAuditCalls } from '@/lib/audit-schedule'
import { auditCallsEnabled } from '@/lib/audit-dispatch'
import { toE164 } from '@/lib/audit-call'

export interface EnrolInput {
  auditId: string
  phone: string
  businessName?: string
  domain?: string
  vertical?: string
  submittedAt: Date
}

/**
 * Writes the two `scheduled` rows. Returns what happened, for the log only.
 *
 * The unique index on `(audit_id, slot)` is what actually guarantees one call per slot — a
 * prospect who submits the form twice in a minute must not be dialled twice. Conflicts are
 * expected and are not errors.
 */
export async function enrolAuditCalls(
  db: SupabaseClient,
  input: EnrolInput,
): Promise<{ scheduled: number; skipped?: string }> {
  try {
    if (!auditCallsEnabled()) return { scheduled: 0, skipped: 'audit calls disabled' }

    const to = toE164(input.phone ?? '')
    // A number we cannot dial is not a finding about them — there is simply nothing to place.
    if (!to) return { scheduled: 0, skipped: 'no dialable phone number' }

    /**
     * Someone who has asked not to be called does not get re-enrolled by submitting the form
     * again. The dispatcher checks this too — that is the gate that actually protects the phone —
     * but scheduling rows we would refuse to dial leaves the table looking like we intend to call
     * a person who told us not to.
     */
    const { data: sup } = await db
      .from('audit_suppressions')
      .select('phone')
      .eq('phone', to)
      .limit(1)
    if (sup?.length) return { scheduled: 0, skipped: 'number is suppressed' }

    const plan = planAuditCalls(input.submittedAt, input.auditId)

    const rows = [plan.first, plan.second].map(call => ({
      audit_id:      input.auditId,
      slot:          call.slot,
      scheduled_for: call.at.toISOString(),
      status:        'scheduled',
      target_phone:  to,
      business_name: input.businessName ?? null,
      domain:        input.domain ?? null,
      vertical:      input.vertical ?? null,
    }))

    const { data, error } = await db
      .from('audit_calls')
      .upsert(rows, { onConflict: 'audit_id,slot', ignoreDuplicates: true })
      .select('id')

    if (error) return { scheduled: 0, skipped: error.message }
    return { scheduled: data?.length ?? 0 }
  } catch (e) {
    // Never throws. The lead is already captured and that is what matters.
    return { scheduled: 0, skipped: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * May we text this person?
 *
 * A2P 10DLC campaign registration is rejected on proof of opt-in more than on anything else, and
 * "they called us" is not consent to send someone a text message. Ava has to ask on the call, the
 * answer has to be stored, and nothing may send without it.
 *
 * The decision is pure and tested; the database read is a thin function at the bottom. Same split
 * as lib/inventory.ts and for the same reason — this is the rule a regulator would ask us to
 * demonstrate, so it should be readable in one screen and provable by a test.
 *
 * **The enforcement point is `sendSms`, not the call sites.** Every caller inherits it there. A
 * check each caller has to remember is a check that will be missed exactly once, which is all it
 * takes — the repo's own lesson is that one-sided adoption always leaves a window.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ConsentRow {
  id?:                  string | null
  sms_consent?:         boolean | null
  sms_consent_at?:      string | null
  sms_consent_source?:  string | null
}

export interface SmsConsent {
  granted:   boolean
  leadId:    string | null
  grantedAt: string | null
  /** Why not, when not. Logged on refusal so a silent non-send is never mistaken for a send. */
  reason:    string
}

export const NO_CONSENT_REASON = 'no recorded opt-in for this recipient'

/**
 * Consent from a lead row.
 *
 * Requires the flag **and** a timestamp. A `true` with no time is not evidence — it cannot answer
 * "when did they agree", which is precisely the question asked when a carrier or a regulator
 * follows up on a complaint. Treating it as consent would mean the one record we produce under
 * scrutiny is the one that proves we were not keeping records.
 */
export function evaluateConsent(row: ConsentRow | null | undefined): SmsConsent {
  if (!row) {
    return { granted: false, leadId: null, grantedAt: null, reason: 'no lead on file' }
  }

  const leadId = row.id ?? null

  if (row.sms_consent !== true) {
    return { granted: false, leadId, grantedAt: null, reason: NO_CONSENT_REASON }
  }

  if (!row.sms_consent_at) {
    return { granted: false, leadId, grantedAt: null, reason: 'opt-in recorded without a timestamp — not provable' }
  }

  return { granted: true, leadId, grantedAt: row.sms_consent_at, reason: 'opt-in on file' }
}

/** A consent object that always refuses, for callers with no lead context at all. */
export function noConsent(reason = 'no lead context'): SmsConsent {
  return { granted: false, leadId: null, grantedAt: null, reason }
}

/** Look up a lead's consent. A failed read refuses — "cannot tell" is not "allowed". */
export async function consentForLead(
  supabase: SupabaseClient,
  leadId: string | null | undefined,
): Promise<SmsConsent> {
  if (!leadId) return noConsent('no lead id supplied')

  const { data, error } = await supabase
    .from('leads')
    .select('id, sms_consent, sms_consent_at, sms_consent_source')
    .eq('id', leadId)
    .maybeSingle<ConsentRow>()

  if (error) {
    console.error(`[SMS CONSENT] Could not read consent for lead ${leadId}: ${error.message}`)
    return noConsent(`consent unreadable: ${error.message}`)
  }

  return evaluateConsent(data)
}

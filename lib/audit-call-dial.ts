/**
 * Places the outbound test call behind the "we called your line" audit (plan Phase 2b).
 *
 * Kept separate from `lib/audit-call.ts` on purpose. That module is pure and SDK-free so
 * its rules about what may and may not be claimed are testable without a network, an API
 * key, or spending money. This module is the part that cannot be — importing the Retell
 * SDK throws at module load when `RETELL_API_KEY` is unset.
 *
 * Retell resolves calls asynchronously: `createPhoneCall` returns a call id immediately and
 * the outcome arrives later on the `call_ended` webhook. So a row is written here in the
 * `placed` state and completed by `/api/call-received`.
 *
 * Every call is tagged `metadata.purpose = AUDIT_CALL_PURPOSE`. That tag is load-bearing —
 * without it the webhook would file an outbound audit call as an inbound customer call and
 * inflate some client's dashboard, ROI figure and weekly digest with calls their agent
 * never took.
 */

import { Retell } from 'retell-sdk'
import { AUDIT_CALL_PURPOSE, toE164 } from './audit-call'

export { AUDIT_CALL_PURPOSE, toE164 }

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''

if (!RETELL_API_KEY) {
  throw new Error('RETELL_API_KEY is not configured')
}

const client = new Retell({ apiKey: RETELL_API_KEY })

/**
 * How long to let the line ring before giving up.
 *
 * **Retell's default is 30 seconds, and that demonstrably races a carrier's voicemail.** Proven on
 * two real calls to the same phone, ignored both times: at the default it came back
 * `dial_no_answer` at 0ms, and at 60s the same phone returned `voicemail_reached` after 28s. The
 * difference was entirely the ring window.
 *
 * That matters because the two outcomes are not equally useful. "It rang out" is weak and, as the
 * first attempt showed, easy to overstate. "It went to voicemail" is the stronger finding, it is
 * what the dossier's comparison is built on, and it is the one that lets Ava leave a message —
 * a second touch at no extra cost. Ringing is not billed as connected time, so the longer window
 * costs nothing.
 */
export const AUDIT_RING_MS = 60_000

export interface AuditCallTarget {
  phone:        string
  businessName?: string
  domain?:      string
  vertical?:    string
}

export interface PlacedAuditCall {
  callId: string
}

/**
 * Dials one target. Throws on a create failure — the caller decides whether that is fatal.
 *
 * `fromNumber` must be a Retell-owned number on the account. Uses the audit agent when
 * `RETELL_AUDIT_AGENT_ID` is set, otherwise the shared demo agent, so this is deployable
 * before a dedicated agent exists.
 */
export async function placeAuditCall(target: AuditCallTarget): Promise<PlacedAuditCall> {
  const to = toE164(target.phone)
  if (!to) throw new Error(`Not a dialable US number: ${target.phone}`)

  const fromNumber = process.env.RETELL_AUDIT_FROM_NUMBER || process.env.RETELL_PHONE_NUMBER
  if (!fromNumber) throw new Error('No outbound number configured (RETELL_AUDIT_FROM_NUMBER)')

  const agentId = process.env.RETELL_AUDIT_AGENT_ID || process.env.RETELL_AGENT_ID
  if (!agentId) throw new Error('No audit agent configured (RETELL_AUDIT_AGENT_ID)')

  const call = await client.call.createPhoneCall({
    from_number: fromNumber,
    to_number:   to,
    override_agent_id: agentId,
    agent_override: { agent: { ring_duration_ms: AUDIT_RING_MS } },
    metadata: {
      purpose:       AUDIT_CALL_PURPOSE,
      business_name: target.businessName ?? '',
      domain:        target.domain ?? '',
      vertical:      target.vertical ?? '',
    },
  })

  return { callId: call.call_id }
}

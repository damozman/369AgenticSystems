/**
 * Can a Rex follow-up step reach this lead at all?
 *
 * A lead with an email address has a channel. A phone-only lead has one only if SMS can actually
 * go out — which needs BOTH Twilio configured AND a recorded opt-in. Checking configuration alone
 * left a hole: once Twilio exists, a phone-only lead who never consented is refused by `sendSms`
 * every day, and the step retries forever with nobody told. Same failure, one layer down.
 *
 * Pure, so the rule is provable without Twilio, Resend or a database.
 */

export interface RexChannelInput {
  hasEmail:       boolean
  hasPhone:       boolean
  smsConfigured:  boolean
  smsConsented:   boolean
}

export type NoChannelReason = 'sms_not_configured' | 'no_sms_consent'

/**
 * Why this lead cannot be reached by any channel, or null when one exists (or when there is no
 * contact info at all — that case is handled separately by the caller and is not an alert).
 */
export function noFollowUpChannelReason(i: RexChannelInput): NoChannelReason | null {
  if (i.hasEmail || !i.hasPhone) return null
  if (!i.smsConfigured) return 'sms_not_configured'
  if (!i.smsConsented) return 'no_sms_consent'
  return null
}

export const NO_CHANNEL_EXPLANATION: Record<NoChannelReason, string> = {
  sms_not_configured: 'SMS is not configured on this deployment',
  no_sms_consent:     'this lead has no recorded, timestamped opt-in to be texted',
}

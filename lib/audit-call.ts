/**
 * Turns a real outbound test call into a statement that is exactly true.
 *
 * This is the honest replacement for the Gumloop "audit" that Phase 2 deletes. That
 * pipeline invented a `security_score` and gave 41/100 to nine different businesses —
 * Delta Dental and a solo dentist scored identically — so the number said nothing about
 * anyone. The fix is not a better score. It is to stop scoring and report an artifact:
 * we called their published line, and here is what happened.
 *
 * Two rules govern everything below.
 *
 * **1. Only describe what the call actually establishes.** "It rang six times and went to
 * voicemail" is a fact we witnessed. "They have poor call handling" is an inference we did
 * not earn from one call, at one time of day, to one number.
 *
 * **2. Our own failures are never findings about them.** If Retell could not place the
 * call, or the number was invalid, or we hit a concurrency limit, that is a fact about our
 * infrastructure. Presenting it as "we called and nobody picked up" would be fabrication of
 * exactly the kind this replaces. Those outcomes are `reportable: false` and — critically —
 * are excluded from the denominator when the bulk run computes a statistic.
 */

/** What a single audit call established about the business we dialled. */
export type AuditOutcome =
  | 'answered_human'    // a person picked up
  | 'voicemail'         // rang out to voicemail
  | 'ivr'               // an automated menu answered
  | 'no_answer'         // rang, nobody picked up, no voicemail
  | 'busy'              // line was busy

/** Why a call told us nothing about the business. Never shown as a finding. */
export type UnreportableReason =
  | 'our_infrastructure' // Retell/telephony failed on our side
  | 'invalid_number'     // the number we held was not dialable
  | 'blocked'            // flagged as spam / declined before ringing
  | 'inconclusive'       // completed but the outcome cannot be classified

export interface AuditCallResult {
  /** False means this call is evidence of nothing and must not reach a prospect or a statistic. */
  reportable: boolean
  outcome?: AuditOutcome
  unreportable?: UnreportableReason
  /** A sentence stating only what happened. Empty when not reportable. */
  sentence: string
  /** Operator-facing explanation. Always present. */
  detail: string
}

/** The subset of a Retell call record this needs. Keeps the module testable and SDK-agnostic. */
export interface RetellCallRecord {
  disconnection_reason?: string
  start_timestamp?: number
  end_timestamp?: number
  duration_ms?: number
}

/**
 * Retell's disconnection reasons, sorted by what they prove.
 *
 * Anything absent from both maps is treated as inconclusive rather than guessed at — a new
 * SDK value must not silently become a claim about a business.
 */
const OUTCOME_BY_REASON: Record<string, AuditOutcome> = {
  voicemail_reached: 'voicemail',
  ivr_reached:       'ivr',
  dial_no_answer:    'no_answer',
  dial_busy:         'busy',
  // A human picked up and one side hung up. Either way, someone answered.
  user_hangup:       'answered_human',
  agent_hangup:      'answered_human',
  call_transfer:     'answered_human',
  transfer_bridged:  'answered_human',
}

const UNREPORTABLE_BY_REASON: Record<string, UnreportableReason> = {
  invalid_destination:                  'invalid_number',
  dial_failed:                          'our_infrastructure',
  telephony_provider_unavailable:       'our_infrastructure',
  telephony_provider_permission_denied: 'our_infrastructure',
  sip_routing_error:                    'our_infrastructure',
  concurrency_limit_reached:            'our_infrastructure',
  no_concurrency_fallback:              'our_infrastructure',
  no_valid_payment:                     'our_infrastructure',
  registered_call_timeout:              'our_infrastructure',
  manual_stopped:                       'our_infrastructure',
  error_llm_websocket_open:             'our_infrastructure',
  error_llm_websocket_lost_connection:  'our_infrastructure',
  error_llm_websocket_runtime:          'our_infrastructure',
  error_llm_websocket_corrupt_payload:  'our_infrastructure',
  error_no_audio_received:              'our_infrastructure',
  error_asr:                            'our_infrastructure',
  error_retell:                         'our_infrastructure',
  error_unknown:                        'our_infrastructure',
  error_user_not_joined:                'our_infrastructure',
  marked_as_spam:                       'blocked',
  scam_detected:                        'blocked',
  user_declined:                        'blocked',
}

/**
 * "Tuesday at 7:14pm" in DFW local time — the buyer's own clock.
 *
 * The time of day is load-bearing: "nobody answered" means something different at 2pm than
 * at 7pm, and stating it lets the reader judge the finding instead of taking our word.
 */
export function formatCallTime(timestampMs: number): string {
  const d = new Date(timestampMs)
  const day = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' })
  const time = d
    .toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
    })
    .replace(/\s?([AP])M$/i, (_, p: string) => p.toLowerCase() + 'm')
  return `${day} at ${time}`
}

/**
 * Describes what one audit call established.
 *
 * `businessLabel` is only used to address the reader ("your main line"); it never changes
 * the claim. Pass the time the call started so the sentence can carry it.
 */
export function describeAuditCall(
  call: RetellCallRecord,
  opts: { lineLabel?: string } = {},
): AuditCallResult {
  const line   = opts.lineLabel ?? 'your main line'
  const reason = call.disconnection_reason ?? ''

  const unreportable = UNREPORTABLE_BY_REASON[reason]
  if (unreportable) {
    return {
      reportable: false,
      unreportable,
      sentence: '',
      detail:
        unreportable === 'invalid_number'
          ? `The number on file was not dialable (${reason}). This says nothing about how they answer calls.`
          : unreportable === 'blocked'
            ? `The call was blocked before it rang (${reason}). Carrier filtering is not a finding about the business.`
            : `The call failed on our side (${reason}). Not evidence about the business — excluded from any statistic.`,
    }
  }

  const outcome = OUTCOME_BY_REASON[reason]
  if (!outcome) {
    return {
      reportable: false,
      unreportable: 'inconclusive',
      sentence: '',
      detail: reason
        ? `Unrecognised disconnection reason "${reason}" — not classified rather than guessed at.`
        : 'The call record carried no disconnection reason, so nothing is established.',
    }
  }

  const when = call.start_timestamp ? formatCallTime(call.start_timestamp) : null
  const at   = when ? ` ${when}` : ''

  // Each sentence states the observation and stops. No inference, no adjectives.
  const sentence = {
    voicemail:      `We called ${line}${at}. It went to voicemail.`,
    no_answer:      `We called ${line}${at}. It rang out — no answer, no voicemail.`,
    busy:           `We called ${line}${at}. The line was busy.`,
    ivr:            `We called ${line}${at}. An automated menu answered.`,
    answered_human: `We called ${line}${at}. Someone picked up.`,
  }[outcome]

  return {
    reportable: true,
    outcome,
    sentence,
    detail: `Retell reported "${reason}".`,
  }
}

// ── Bulk aggregation ──────────────────────────────────────────────────────────

export interface AuditTally {
  /** Calls that established something. The only honest denominator. */
  reportable: number
  /** Calls that failed on our side or were blocked. Excluded from every percentage. */
  excluded: number
  byOutcome: Record<AuditOutcome, number>
}

/**
 * Tallies a bulk run.
 *
 * The denominator is the whole point. A run of 200 numbers where 40 failed to dial is a
 * sample of 160, not 200 — quoting "x% of 200" would inflate the very statistic this
 * exists to make unfakeable. Percentages must be taken against `reportable`.
 */
export function tallyAuditCalls(results: AuditCallResult[]): AuditTally {
  const tally: AuditTally = {
    reportable: 0,
    excluded:   0,
    byOutcome:  { answered_human: 0, voicemail: 0, ivr: 0, no_answer: 0, busy: 0 },
  }

  for (const r of results) {
    if (!r.reportable || !r.outcome) { tally.excluded++; continue }
    tally.reportable++
    tally.byOutcome[r.outcome]++
  }
  return tally
}

/**
 * The headline statistic, stated with its real sample size.
 *
 * Returns null below `minSample` rather than publishing a percentage a handful of calls
 * cannot support — "71% of 7 businesses" is the shape of every borrowed statistic Phase 0
 * deleted, and this exists to replace those, not to reproduce them.
 */
export function unreachedShare(
  tally: AuditTally,
  minSample = 30,
): { percent: number; sample: number; sentence: string } | null {
  if (tally.reportable < minSample) return null

  const unreached =
    tally.byOutcome.voicemail + tally.byOutcome.no_answer + tally.byOutcome.busy
  const percent = Math.round((unreached / tally.reportable) * 100)

  return {
    percent,
    sample: tally.reportable,
    sentence:
      `We called ${tally.reportable} businesses. ` +
      `${percent}% never put us through to a person.`,
  }
}

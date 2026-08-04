import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  describeAuditCall, formatCallTime, tallyAuditCalls, unreachedShare,
  type AuditCallResult,
} from './audit-call.ts'

/**
 * These tests exist because the failure mode here is not a crash — it is a sentence that
 * reads fine and is not true. The Gumloop audit this replaces never threw an error; it
 * just quietly gave nine different businesses the same score.
 *
 * So the assertions are mostly about what must NOT be said.
 */

// A Tuesday evening in DFW: 2026-08-04 19:14 CDT = 2026-08-05 00:14 UTC.
const TUESDAY_EVENING = Date.UTC(2026, 7, 5, 0, 14)

// ── The sentence states only what happened ────────────────────────────────────

test('a voicemail is reported as a voicemail, with the time it happened', () => {
  const r = describeAuditCall({
    disconnection_reason: 'voicemail_reached',
    start_timestamp: TUESDAY_EVENING,
  })
  assert.equal(r.reportable, true)
  assert.equal(r.outcome, 'voicemail')
  assert.equal(r.sentence, 'We called your main line Tuesday at 7:14pm. It went to voicemail.')
})

test('someone picking up is reported plainly, not spun as a negative', () => {
  const r = describeAuditCall({
    disconnection_reason: 'user_hangup',
    start_timestamp: TUESDAY_EVENING,
  })
  assert.equal(r.outcome, 'answered_human')
  assert.match(r.sentence, /Someone picked up/)
  // The pitch must not survive contact with a business that answers its phone.
  assert.doesNotMatch(r.sentence, /missed|lost|voicemail|failed/i)
})

test('an IVR is not passed off as a human, nor as a voicemail', () => {
  const r = describeAuditCall({ disconnection_reason: 'ivr_reached', start_timestamp: TUESDAY_EVENING })
  assert.equal(r.outcome, 'ivr')
  assert.match(r.sentence, /automated menu answered/)
})

test('ringing out is distinguished from reaching voicemail', () => {
  const r = describeAuditCall({ disconnection_reason: 'dial_no_answer', start_timestamp: TUESDAY_EVENING })
  assert.equal(r.outcome, 'no_answer')
  assert.match(r.sentence, /rang out/)
  // It may mention voicemail only to rule it out, never to claim one was reached.
  assert.match(r.sentence, /no voicemail/)
  assert.doesNotMatch(r.sentence, /went to voicemail/)
})

test('no sentence claims a ring count we never counted', () => {
  // An early draft of this pitch said "it rang 6 times" — Retell reports no ring count,
  // so any such number would be invented.
  for (const reason of ['voicemail_reached', 'dial_no_answer', 'dial_busy', 'ivr_reached', 'user_hangup']) {
    const r = describeAuditCall({ disconnection_reason: reason, start_timestamp: TUESDAY_EVENING })
    assert.doesNotMatch(r.sentence, /\d+\s*(times|rings)/, `"${r.sentence}" invents a ring count`)
  }
})

test('a call with no timestamp omits the time rather than inventing one', () => {
  const r = describeAuditCall({ disconnection_reason: 'voicemail_reached' })
  assert.equal(r.sentence, 'We called your main line. It went to voicemail.')
})

// ── Our failures are never findings about them ────────────────────────────────

test('a telephony failure on our side is not reportable', () => {
  for (const reason of ['dial_failed', 'telephony_provider_unavailable', 'error_retell', 'concurrency_limit_reached']) {
    const r = describeAuditCall({ disconnection_reason: reason })
    assert.equal(r.reportable, false, `${reason} must not be reportable`)
    assert.equal(r.unreportable, 'our_infrastructure')
    assert.equal(r.sentence, '', `${reason} produced a claim: "${r.sentence}"`)
  }
})

test('an undialable number says nothing about how they answer calls', () => {
  const r = describeAuditCall({ disconnection_reason: 'invalid_destination' })
  assert.equal(r.reportable, false)
  assert.equal(r.unreportable, 'invalid_number')
  assert.match(r.detail, /says nothing about/)
})

test('carrier spam-blocking is our problem, not their finding', () => {
  for (const reason of ['marked_as_spam', 'scam_detected', 'user_declined']) {
    const r = describeAuditCall({ disconnection_reason: reason })
    assert.equal(r.reportable, false, `${reason} must not be reportable`)
    assert.equal(r.unreportable, 'blocked')
  }
})

test('an unknown disconnection reason is not classified rather than guessed at', () => {
  // A future SDK value must not silently become a claim about somebody's business.
  const r = describeAuditCall({ disconnection_reason: 'some_future_retell_reason' })
  assert.equal(r.reportable, false)
  assert.equal(r.unreportable, 'inconclusive')
  assert.equal(r.sentence, '')
  assert.match(r.detail, /not classified rather than guessed/)
})

test('a call record with no disconnection reason establishes nothing', () => {
  const r = describeAuditCall({})
  assert.equal(r.reportable, false)
  assert.equal(r.sentence, '')
})

// ── Time formatting ───────────────────────────────────────────────────────────

test('call times render on the buyer\'s clock, not UTC', () => {
  // Same instant is Wednesday in UTC and Tuesday evening in DFW. The prospect reads DFW.
  assert.equal(formatCallTime(TUESDAY_EVENING), 'Tuesday at 7:14pm')
})

test('midday and midnight render without an am/pm slip', () => {
  assert.equal(formatCallTime(Date.UTC(2026, 7, 4, 17, 0)), 'Tuesday at 12:00pm')
  assert.equal(formatCallTime(Date.UTC(2026, 7, 4, 5, 30)), 'Tuesday at 12:30am')
})

// ── The statistic and its denominator ─────────────────────────────────────────

function results(spec: Record<string, number>): AuditCallResult[] {
  const out: AuditCallResult[] = []
  for (const [reason, n] of Object.entries(spec)) {
    for (let i = 0; i < n; i++) out.push(describeAuditCall({ disconnection_reason: reason }))
  }
  return out
}

test('failed dials are excluded from the tally, not counted as unreachable', () => {
  const tally = tallyAuditCalls(results({ voicemail_reached: 10, dial_failed: 5, user_hangup: 5 }))
  assert.equal(tally.reportable, 15)
  assert.equal(tally.excluded, 5)
  assert.equal(tally.byOutcome.voicemail, 10)
  assert.equal(tally.byOutcome.answered_human, 5)
})

test('the headline percentage is taken against reachable calls only', () => {
  // 200 dialled, 40 failed on our side. The sample is 160, not 200 — quoting the larger
  // denominator would inflate the exact statistic this is meant to make unfakeable.
  const stat = unreachedShare(tallyAuditCalls(results({
    voicemail_reached: 100,   // unreached
    dial_no_answer:    16,    // unreached
    user_hangup:       44,    // reached a person
    dial_failed:       40,    // excluded entirely
  })))

  assert.ok(stat)
  assert.equal(stat!.sample, 160)
  assert.equal(stat!.percent, 73)          // 116/160, not 116/200 (58%)
  assert.equal(stat!.sentence, 'We called 160 businesses. 73% never put us through to a person.')
})

test('an IVR counts as reached — it answered, even if a human did not', () => {
  const stat = unreachedShare(tallyAuditCalls(results({ ivr_reached: 50, voicemail_reached: 50 })))
  assert.equal(stat!.percent, 50)
})

test('no percentage is published on a sample too small to support one', () => {
  // "71% of 7 businesses" is the shape of every borrowed statistic Phase 0 deleted.
  assert.equal(unreachedShare(tallyAuditCalls(results({ voicemail_reached: 7 }))), null)
  assert.equal(unreachedShare(tallyAuditCalls(results({ voicemail_reached: 29 }))), null)
  assert.ok(unreachedShare(tallyAuditCalls(results({ voicemail_reached: 30 }))))
})

test('a run that is entirely our own failures yields no statistic at all', () => {
  const tally = tallyAuditCalls(results({ dial_failed: 200 }))
  assert.equal(tally.reportable, 0)
  assert.equal(unreachedShare(tally), null)
})

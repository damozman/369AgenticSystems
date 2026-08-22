import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeAuditPair, pairIsReportable } from '@/lib/audit-call-pair'
import type { AuditCallResult } from '@/lib/audit-call'

const answered = (at: string): AuditCallResult => ({
  reportable: true, outcome: 'answered_human',
  sentence: `We called your main line ${at}. Someone picked up.`,
  detail: 'Retell reported "user_hangup".',
})

const voicemail = (at: string): AuditCallResult => ({
  reportable: true, outcome: 'voicemail',
  sentence: `We called your main line ${at}. It went to voicemail.`,
  detail: 'Retell reported "voicemail_reached".',
})

const ourFault: AuditCallResult = {
  reportable: false, unreportable: 'our_infrastructure',
  sentence: '',
  detail: 'The call failed on our side (dial_failed).',
}

const all = (p: ReturnType<typeof describeAuditPair>) =>
  [...p.sentences, p.closing ?? ''].join(' ')

// ── The rule this module exists for ─────────────────────────────────────────

test('two calls never become a percentage', () => {
  // "You miss 50% of calls" would be true of the sample and false about the business. It is the
  // exact shape of the invented statistic this pipeline replaces.
  const combos = [
    describeAuditPair(answered('Tuesday at 10:32am'), voicemail('Tuesday at 8:41pm')),
    describeAuditPair(voicemail('Tuesday at 10:32am'), voicemail('Tuesday at 8:41pm')),
    describeAuditPair(voicemail('Tuesday at 10:32am'), answered('Tuesday at 8:41pm')),
    describeAuditPair(answered('Tuesday at 10:32am'), answered('Tuesday at 8:41pm')),
    describeAuditPair(ourFault, voicemail('Tuesday at 8:41pm')),
  ]
  for (const p of combos) {
    assert.doesNotMatch(all(p), /%|percent|\brate\b|half of|one in two/i, all(p))
  }
})

test('a missed call hands the frequency back to the prospect', () => {
  const p = describeAuditPair(answered('Tuesday at 10:32am'), voicemail('Tuesday at 8:41pm'))
  assert.match(p.closing!, /only you can say/)
})

// ── The comparison, which is the whole artifact ─────────────────────────────

test('answered in hours, voicemail in the evening is the comparison', () => {
  const p = describeAuditPair(answered('Tuesday at 10:32am'), voicemail('Tuesday at 8:41pm'))
  assert.equal(p.verdict, 'business_only')
  assert.match(all(p), /Someone picked up/)
  assert.match(all(p), /went to voicemail/)
  assert.match(all(p), /The difference was the hour/)
})

test('the document can tell a prospect they did well', () => {
  // One that only ever finds fault is a sales script and reads like one.
  const p = describeAuditPair(answered('Tuesday at 10:32am'), answered('Tuesday at 8:41pm'))
  assert.equal(p.verdict, 'both_answered')
  assert.match(all(p), /nothing here for us to fix/)
  // No handback: nothing was missed, so asking how often it happens would be nonsense.
  assert.equal(p.closing, undefined)
})

test('neither answered is stated as two events', () => {
  const p = describeAuditPair(voicemail('Tuesday at 10:32am'), voicemail('Tuesday at 8:41pm'))
  assert.equal(p.verdict, 'neither_answered')
  assert.match(all(p), /Neither call reached a person/)
  assert.ok(p.closing)
})

test('the reverse case is reported as observed, not smoothed away', () => {
  const p = describeAuditPair(voicemail('Tuesday at 10:32am'), answered('Tuesday at 8:41pm'))
  assert.equal(p.verdict, 'evening_only')
  assert.match(all(p), /evening call reached someone and the daytime one did not/)
})

test('no sentence claims anything about businesses we have not measured', () => {
  // The first draft of this module said "better than most of the businesses we call" and "the
  // reverse of what we usually find". Both are population claims with no data behind them —
  // a borrowed statistic wearing prose, which is what this pipeline exists to delete.
  const combos = [
    describeAuditPair(answered('a'), answered('b')),
    describeAuditPair(answered('a'), voicemail('b')),
    describeAuditPair(voicemail('a'), answered('b')),
    describeAuditPair(voicemail('a'), voicemail('b')),
    describeAuditPair(ourFault, voicemail('b')),
  ]
  const populationClaim =
    /most (?:businesses|companies|of the)|we usually|typically|on average|industry|others (?:we|in)|compared (?:to|with)|better than|worse than/i
  for (const p of combos) {
    assert.doesNotMatch(all(p), populationClaim, all(p))
  }
})

// ── Our failures are never findings about them ──────────────────────────────

test('an infrastructure failure drops to a single-call statement', () => {
  const p = describeAuditPair(ourFault, voicemail('Tuesday at 8:41pm'))
  assert.equal(p.verdict, 'single_call')
  assert.equal(p.sentences.length, 1)
  // Never softened into "we could not reach you", which would read as a finding about them.
  assert.doesNotMatch(all(p), /could not reach you|unreachable|failed to connect/i)
})

test('two failures mean the section is omitted entirely', () => {
  const p = describeAuditPair(ourFault, ourFault)
  assert.equal(p.verdict, 'nothing')
  assert.deepEqual(p.sentences, [])
  assert.equal(pairIsReportable(p), false)
})

test('a call that was never placed is not a finding', () => {
  const p = describeAuditPair(null, null)
  assert.equal(p.verdict, 'nothing')
  assert.equal(pairIsReportable(p), false)
})

test('one call only never uses two-call language', () => {
  const p = describeAuditPair(answered('Tuesday at 10:32am'), null)
  assert.equal(p.verdict, 'single_call')
  assert.doesNotMatch(all(p), /both|twice|two calls|again/i)
})

// ── An IVR is not a person ──────────────────────────────────────────────────

test('an automated menu does not count as answering', () => {
  const ivr: AuditCallResult = {
    reportable: true, outcome: 'ivr',
    sentence: 'We called your main line Tuesday at 8:41pm. An automated menu answered.',
    detail: 'Retell reported "ivr_reached".',
  }
  const p = describeAuditPair(answered('Tuesday at 10:32am'), ivr)
  assert.equal(p.verdict, 'business_only')
  assert.ok(p.closing, 'a menu answering still leaves the caller unreached')
})

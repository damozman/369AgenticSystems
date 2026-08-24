import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decideQuestionnaireThrottle, decideSubmitThrottle, honeypotTripped,
  QUESTIONNAIRE_THROTTLE_COOLDOWN_SECONDS, SUBMIT_THROTTLE_MAX, SUBMIT_THROTTLE_WINDOW_SECONDS,
} from '@/lib/lead-engine/rate-limit'

test('a filled honeypot is tripped, an empty or absent one is not', () => {
  assert.equal(honeypotTripped('anything at all'), true)
  assert.equal(honeypotTripped('   '), false)
  assert.equal(honeypotTripped(''), false)
  assert.equal(honeypotTripped(undefined), false)
  assert.equal(honeypotTripped(null), false)
})

test('the submit throttle allows up to the max, then refuses', () => {
  assert.equal(decideSubmitThrottle(0).allowed, true)
  assert.equal(decideSubmitThrottle(SUBMIT_THROTTLE_MAX - 1).allowed, true)
  const refused = decideSubmitThrottle(SUBMIT_THROTTLE_MAX)
  assert.equal(refused.allowed, false)
  assert.equal(refused.retryAfterSeconds, SUBMIT_THROTTLE_WINDOW_SECONDS)
  assert.equal(decideSubmitThrottle(SUBMIT_THROTTLE_MAX + 4).allowed, false)
})

test('a brand-new site with no prior write is never throttled', () => {
  assert.equal(decideQuestionnaireThrottle(null).allowed, true)
})

test('an invalid timestamp fails open rather than refusing everyone', () => {
  // A malformed value here must never lock a real customer out of their own questionnaire.
  assert.equal(decideQuestionnaireThrottle('not-a-date').allowed, true)
})

test('a write inside the cooldown window is refused', () => {
  const now = new Date('2026-08-24T12:00:00Z')
  const justNow = new Date(now.getTime() - 1000)
  const result = decideQuestionnaireThrottle(justNow, now)
  assert.equal(result.allowed, false)
  assert.equal(result.retryAfterSeconds, QUESTIONNAIRE_THROTTLE_COOLDOWN_SECONDS - 1)
})

test('a write outside the cooldown window is allowed', () => {
  const now = new Date('2026-08-24T12:00:00Z')
  const wellBefore = new Date(now.getTime() - (QUESTIONNAIRE_THROTTLE_COOLDOWN_SECONDS + 1) * 1000)
  assert.equal(decideQuestionnaireThrottle(wellBefore, now).allowed, true)
})

test('exactly at the cooldown boundary is allowed, not refused', () => {
  const now = new Date('2026-08-24T12:00:00Z')
  const exact = new Date(now.getTime() - QUESTIONNAIRE_THROTTLE_COOLDOWN_SECONDS * 1000)
  assert.equal(decideQuestionnaireThrottle(exact, now).allowed, true)
})

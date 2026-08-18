import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateConsent, noConsent } from './sms-consent.ts'

/**
 * The failure these guard against is sending a text to someone who never agreed to receive one.
 * That is a carrier complaint, a campaign suspension, and — at scale — a TCPA problem. Every
 * ambiguous case therefore resolves to "no".
 */

test('a recorded opt-in with a timestamp is consent', () => {
  const c = evaluateConsent({ id: 'lead-1', sms_consent: true, sms_consent_at: '2026-08-16T10:00:00Z' })
  assert.equal(c.granted, true)
  assert.equal(c.leadId, 'lead-1')
  assert.equal(c.grantedAt, '2026-08-16T10:00:00Z')
})

test('no lead is not consent', () => {
  assert.equal(evaluateConsent(null).granted, false)
  assert.equal(evaluateConsent(undefined).granted, false)
})

test('silence is not consent', () => {
  // The column defaults to false precisely so this is the resting state.
  assert.equal(evaluateConsent({ id: 'l', sms_consent: false }).granted, false)
  assert.equal(evaluateConsent({ id: 'l' }).granted, false)
  assert.equal(evaluateConsent({ id: 'l', sms_consent: null }).granted, false)
})

test('a truthy-but-not-true value is not consent', () => {
  // Guards against a string "false" or a 1 arriving from somewhere loose and reading as yes.
  for (const value of ['true', 1, 'yes', {}] as unknown[]) {
    const c = evaluateConsent({ id: 'l', sms_consent: value as boolean, sms_consent_at: '2026-08-16T10:00:00Z' })
    assert.equal(c.granted, false, `${JSON.stringify(value)} must not read as consent`)
  }
})

test('consent without a timestamp is refused, because it cannot be proven', () => {
  // "When did they agree?" is the exact question asked after a complaint. A flag with no time
  // means the one record produced under scrutiny proves we were not keeping records.
  const c = evaluateConsent({ id: 'l', sms_consent: true, sms_consent_at: null })
  assert.equal(c.granted, false)
  assert.match(c.reason, /timestamp/)
})

test('every refusal carries a reason, so a non-send is never silent', () => {
  for (const row of [null, { id: 'l' }, { id: 'l', sms_consent: true }]) {
    const c = evaluateConsent(row)
    assert.equal(c.granted, false)
    assert.ok(c.reason.length > 0, 'a refusal must say why')
  }
  assert.ok(noConsent().reason.length > 0)
})

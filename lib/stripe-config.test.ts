import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideProvisioning } from './stripe-config.ts'

/**
 * The failure these guard against: a completed checkout that provisions nothing while
 * returning HTTP 200, so Stripe's dashboard reports a successful delivery and the silence
 * looks like success. That is how a zero-dollar (100%-off coupon) signup used to vanish.
 */

test('a paid checkout provisions', () => {
  assert.deepEqual(decideProvisioning('paid'), { provision: true })
})

test('a zero-dollar checkout provisions — this is what a 100%-off coupon produces', () => {
  assert.deepEqual(decideProvisioning('no_payment_required'), { provision: true })
})

test('an unpaid checkout does NOT provision', () => {
  const decision = decideProvisioning('unpaid')
  assert.equal(decision.provision, false)
})

test('an unrecognised status does NOT provision', () => {
  const decision = decideProvisioning('some_future_stripe_status')
  assert.equal(decision.provision, false)
})

test('a missing status does NOT provision', () => {
  assert.equal(decideProvisioning(undefined).provision, false)
  assert.equal(decideProvisioning(null).provision, false)
})

test('every refusal carries a reason, because the caller alerts with it', () => {
  for (const status of ['unpaid', 'some_future_stripe_status', undefined, null]) {
    const decision = decideProvisioning(status)
    assert.equal(decision.provision, false, `expected ${String(status)} to be refused`)
    assert.ok(
      'reason' in decision && decision.reason.length > 0,
      `refusal for ${String(status)} must explain itself`
    )
  }
})

test('the refusal reason names the status, so an alert is actionable without the logs', () => {
  const decision = decideProvisioning('some_future_stripe_status')
  assert.ok('reason' in decision && decision.reason.includes('some_future_stripe_status'))
})

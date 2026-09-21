import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideProvisioning, tierFromSubscriptionItems } from './stripe-config.ts'

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

// ── tierFromSubscriptionItems ────────────────────────────────────────────────
// How an upgrade or downgrade reaches us: a plan change in Stripe's billing portal updates the
// subscription in place and never creates a checkout session, so nothing about it looks like a
// signup. Getting this wrong re-grades a paying client in either direction.

const MAP = { price_starter: 'Starter', price_pro: 'Pro', price_elite: 'Elite' } as const

test('resolves the tier from a known tier price', () => {
  assert.deepEqual(tierFromSubscriptionItems([{ price: { id: 'price_elite' } }], MAP), { tier: 'Elite' })
  assert.deepEqual(tierFromSubscriptionItems([{ price: { id: 'price_starter' } }], MAP), { tier: 'Starter' })
})

test('ignores add-on and metered items alongside the tier price', () => {
  const r = tierFromSubscriptionItems(
    [{ price: { id: 'price_some_addon' } }, { price: { id: 'price_pro' } }],
    MAP,
  )
  assert.deepEqual(r, { tier: 'Pro' })
})

test('an unrecognised price is NOT silently treated as Starter', () => {
  // Guessing here would re-grade a paying client — including stripping Elite from someone who
  // still pays for it — so it refuses and the caller alerts.
  const r = tierFromSubscriptionItems([{ price: { id: 'price_unknown' } }], MAP)
  assert.equal(r.tier, null)
  assert.match(r.reason ?? '', /price_unknown/)
})

test('an empty, null or undefined item list resolves to no tier rather than throwing', () => {
  for (const items of [[], null, undefined]) {
    const r = tierFromSubscriptionItems(items, MAP)
    assert.equal(r.tier, null)
    assert.ok((r.reason ?? '').length > 10)
  }
})

test('items with a missing price object are skipped, not crashed on', () => {
  const r = tierFromSubscriptionItems([{ price: null }, {}, { price: { id: 'price_pro' } }], MAP)
  assert.deepEqual(r, { tier: 'Pro' })
})

test('an empty price map refuses rather than guessing — the env vars may be unset', () => {
  const r = tierFromSubscriptionItems([{ price: { id: 'price_elite' } }], {})
  assert.equal(r.tier, null)
  assert.match(r.reason ?? '', /STRIPE_PRICE_ID/)
})

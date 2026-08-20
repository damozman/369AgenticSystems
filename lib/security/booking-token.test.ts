import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mintBookingToken, verifyBookingToken } from './booking-token.ts'

/**
 * The token exists so a model cannot book the wrong unit by omitting a parameter. Every test here
 * is aimed at the other half of that bargain: a token the model *corrupted* or *invented* must be
 * refused, not parsed into a booking.
 */

process.env.RETELL_WEBHOOK_SECRET = 'test-secret-for-booking-tokens'

const offer = (over: Partial<{ itemKey: string | null; startsAt: Date; endsAt: Date }> = {}) => ({
  itemKey: 'princess_castle_bounce_house',
  startsAt: new Date('2026-09-05T13:00:00Z'),
  endsAt: new Date('2026-09-06T20:00:00Z'),
  ...over,
})

test('a minted token round-trips to the same item and interval', () => {
  const check = verifyBookingToken(mintBookingToken(offer()))
  assert.ok(check.valid, 'freshly minted token did not verify')
  assert.equal(check.offer.itemKey, 'princess_castle_bounce_house')
  assert.equal(check.offer.startsAt.toISOString(), '2026-09-05T13:00:00.000Z')
  assert.equal(check.offer.endsAt.toISOString(), '2026-09-06T20:00:00.000Z')
})

test('a people-time slot round-trips as a null item, not an empty string', () => {
  // The load-bearing case: every existing client books people-time, and an empty-string item key
  // would be looked up as an item nobody stocks.
  const check = verifyBookingToken(mintBookingToken(offer({ itemKey: null })))
  assert.ok(check.valid)
  assert.equal(check.offer.itemKey, null)
})

test('a tampered payload is refused', () => {
  // The whole point: an altered item key must not become a booking.
  const token = mintBookingToken(offer())!
  const [payload, sig] = token.split('.')
  const raw = Buffer.from(payload, 'base64url').toString('utf8').replace('princess', 'medieval')
  const forged = `${Buffer.from(raw, 'utf8').toString('base64url')}.${sig}`

  const check = verifyBookingToken(forged)
  assert.equal(check.valid, false)
  assert.equal(check.valid === false && check.reason, 'bad-signature')
})

test('an invented token is refused rather than parsed', () => {
  // A model that hallucinates a plausible-looking handle must fail closed.
  for (const bogus of ['abc.def', 'not-a-token', '.', 'YWJj.0000000000000000']) {
    const check = verifyBookingToken(bogus)
    assert.equal(check.valid, false, `accepted a fabricated token: ${bogus}`)
  }
})

test('an expired token is refused', () => {
  const check = verifyBookingToken(mintBookingToken(offer(), -10))
  assert.equal(check.valid, false)
  assert.equal(check.valid === false && check.reason, 'expired')
})

test('a backwards interval is refused', () => {
  const bad = mintBookingToken(offer({
    startsAt: new Date('2026-09-06T20:00:00Z'),
    endsAt: new Date('2026-09-05T13:00:00Z'),
  }))
  const check = verifyBookingToken(bad)
  assert.equal(check.valid, false)
  assert.equal(check.valid === false && check.reason, 'malformed')
})

test('an absent token reports missing, not malformed', () => {
  // The route branches on this: missing means "fall back to the prose fields, as before".
  for (const v of [null, undefined, '']) {
    const check = verifyBookingToken(v)
    assert.equal(check.valid === false && check.reason, 'missing')
  }
})

test('with no secret configured, minting returns null and nothing verifies', () => {
  const saved = process.env.RETELL_WEBHOOK_SECRET
  delete process.env.RETELL_WEBHOOK_SECRET
  try {
    assert.equal(mintBookingToken(offer()), null, 'minted a token with no secret')
    const check = verifyBookingToken('anything')
    assert.equal(check.valid === false && check.reason, 'not-configured')
  } finally {
    process.env.RETELL_WEBHOOK_SECRET = saved
  }
})

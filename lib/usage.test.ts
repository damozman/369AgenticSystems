import { test } from 'node:test'
import assert from 'node:assert/strict'
import { billableMinutes, callMinutes, computeUsage, formatCents, summarise } from './usage.ts'

/**
 * Every test here is aimed at a way a bill goes wrong in the customer's disfavour, because that
 * is the direction that costs trust. The rounding rule is the one a customer can check against
 * their own phone records, so it has to be exactly what we say it is.
 */

// ── per-call rounding ─────────────────────────────────────────────────────────

test('a call rounds up to the whole minute', () => {
  assert.equal(callMinutes(1), 1)
  assert.equal(callMinutes(59), 1)
  assert.equal(callMinutes(60), 1)
  assert.equal(callMinutes(61), 2)
  assert.equal(callMinutes(125), 3)
})

test('a zero-second call bills nothing, not one minute', () => {
  // Real data: the demo line logged a 0s call on 2026-08-07. Rounding "up" from nothing is how a
  // meter quietly starts charging for hang-ups.
  assert.equal(callMinutes(0), 0)
})

test('an unknown duration bills nothing rather than guessing upward', () => {
  // One of 55 production rows has a null duration — the call_ended webhook never landed. We do
  // not know how long it was, and guessing in our own favour is not defensible.
  assert.equal(callMinutes(null), 0)
  assert.equal(callMinutes(undefined), 0)
})

test('nonsense durations bill nothing instead of propagating into money', () => {
  assert.equal(callMinutes(-30), 0)
  assert.equal(callMinutes(NaN), 0)
  assert.equal(callMinutes(Infinity), 0)
})

// ── summing ───────────────────────────────────────────────────────────────────

test('each call is rounded individually, then summed', () => {
  // The distinction that defines per-minute billing. 0:42 + 2:05 + 1:58 is 4:45 of talk time,
  // which sums-then-rounds to 5 — but bills 6, because each call rounds up on its own.
  const calls = [{ duration_seconds: 42 }, { duration_seconds: 125 }, { duration_seconds: 118 }]
  assert.equal(billableMinutes(calls), 6)
})

test('no calls is zero, not a crash', () => {
  assert.equal(billableMinutes([]), 0)
  assert.equal(billableMinutes(null as never), 0)
})

test('unusable rows are skipped without poisoning the total', () => {
  const calls = [{ duration_seconds: 60 }, { duration_seconds: null }, { duration_seconds: 0 }, { duration_seconds: 90 }]
  assert.equal(billableMinutes(calls), 3) // 1 + 0 + 0 + 2
})

// ── allowance and overage ─────────────────────────────────────────────────────

test('inside the allowance there is no overage', () => {
  const u = computeUsage('Starter', 250)
  assert.equal(u.includedMinutes, 300)
  assert.equal(u.overageMinutes, 0)
  assert.equal(u.overageCents, 0)
})

test('exactly at the allowance is not over it', () => {
  // The boundary a customer will absolutely notice if we get it wrong.
  const u = computeUsage('Starter', 300)
  assert.equal(u.overageMinutes, 0)
  assert.equal(u.overageCents, 0)
})

test('one minute past the allowance bills exactly one minute', () => {
  const u = computeUsage('Starter', 301)
  assert.equal(u.overageMinutes, 1)
  assert.equal(u.overageCents, 35)
})

test('overage is exact in cents, with no floating-point residue', () => {
  // 112 minutes over on Starter. In dollars this is 112 * 0.35 = 39.199999999999996.
  const u = computeUsage('Starter', 412)
  assert.equal(u.overageMinutes, 112)
  assert.equal(u.overageCents, 3920)
  assert.equal(formatCents(u.overageCents), '$39.20')
  assert.ok(Number.isInteger(u.overageCents), 'cents must never be fractional')
})

test('the rate descends by tier, so upgrading beats overspending', () => {
  // 100 minutes over costs less on a higher tier — the incentive the tiering exists to create.
  assert.equal(computeUsage('Starter', 400).overageCents, 3500)
  assert.equal(computeUsage('Pro',     700).overageCents, 3000)
  assert.equal(computeUsage('Elite', 1100).overageCents, 2500)
})

test('each tier carries its own allowance', () => {
  assert.equal(computeUsage('Starter', 0).includedMinutes, 300)
  assert.equal(computeUsage('Pro',     0).includedMinutes, 600)
  assert.equal(computeUsage('Elite',   0).includedMinutes, 1000)
})

test('an unresolvable tier falls back to Starter rather than billing nothing', () => {
  // A tier that does not resolve is a data fault. Falling back to zero overage would hide it;
  // falling back to Starter surfaces it as a bill that looks wrong to someone.
  const u = computeUsage('Enterprise', 400)
  assert.equal(u.includedMinutes, 300)
  assert.equal(u.overageCents, 3500)
  assert.deepEqual(computeUsage(null, 400), u)
  assert.deepEqual(computeUsage(undefined, 400), u)
})

// ── end to end ────────────────────────────────────────────────────────────────

test('summarise goes from raw calls to a bill', () => {
  // 301 one-minute calls on Starter: one minute over, 35 cents.
  const calls = Array.from({ length: 301 }, () => ({ duration_seconds: 30 }))
  const u = summarise('Starter', calls)
  assert.equal(u.billedMinutes, 301)
  assert.equal(u.overageMinutes, 1)
  assert.equal(formatCents(u.overageCents), '$0.35')
})

test('a real period of mixed calls', () => {
  // Northside's two real calls to date: 275s and 132s → 5 + 3 = 8 minutes, far inside Starter.
  const u = summarise('Starter', [{ duration_seconds: 275 }, { duration_seconds: 132 }])
  assert.equal(u.billedMinutes, 8)
  assert.equal(u.overageMinutes, 0)
})

// ── formatting ────────────────────────────────────────────────────────────────

test('cents format as money, padded', () => {
  assert.equal(formatCents(0), '$0.00')
  assert.equal(formatCents(5), '$0.05')
  assert.equal(formatCents(100), '$1.00')
  assert.equal(formatCents(3920), '$39.20')
  assert.equal(formatCents(123456), '$1234.56')
})

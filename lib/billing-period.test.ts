import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addMonthsUtc,
  billablePeriodFor,
  calendarMonthPeriod,
  displayPeriodFor,
  periodContains,
  periodFromAnchor,
} from './billing-period.ts'

/**
 * Period boundaries are where an off-by-one becomes a customer billed twice for one call, or not
 * at all. The month-end clamping tests are the ones that matter most: a subscription anchored on
 * the 31st has no 31st in February, and getting that wrong slides every subsequent boundary.
 */

const iso = (d: Date) => d.toISOString()

// ── month arithmetic ──────────────────────────────────────────────────────────

test('adding a month keeps the day and the time of day', () => {
  assert.equal(iso(addMonthsUtc(new Date('2026-03-15T09:30:00Z'), 1)), '2026-04-15T09:30:00.000Z')
})

test('a 31st anchor clamps into a 30-day month', () => {
  assert.equal(iso(addMonthsUtc(new Date('2026-01-31T00:00:00Z'), 3)), '2026-04-30T00:00:00.000Z')
})

test('a 31st anchor clamps into February, and does not spill into March', () => {
  // The classic. Naive month addition turns Jan 31 into Mar 3 and every later boundary is wrong.
  assert.equal(iso(addMonthsUtc(new Date('2026-01-31T00:00:00Z'), 1)), '2026-02-28T00:00:00.000Z')
})

test('a 29th anchor survives a leap February', () => {
  // 2028 is a leap year; 2026 is not.
  assert.equal(iso(addMonthsUtc(new Date('2028-01-29T00:00:00Z'), 1)), '2028-02-29T00:00:00.000Z')
  assert.equal(iso(addMonthsUtc(new Date('2026-01-29T00:00:00Z'), 1)), '2026-02-28T00:00:00.000Z')
})

test('adding months rolls the year over', () => {
  assert.equal(iso(addMonthsUtc(new Date('2026-11-15T00:00:00Z'), 3)), '2027-02-15T00:00:00.000Z')
})

// ── period from an anchor ─────────────────────────────────────────────────────

const ANCHOR = new Date('2026-03-15T09:30:00Z')

test('the period containing an instant runs anchor-day to anchor-day', () => {
  const p = periodFromAnchor(ANCHOR, new Date('2026-05-02T12:00:00Z'))
  assert.equal(iso(p.start), '2026-04-15T09:30:00.000Z')
  assert.equal(iso(p.end),   '2026-05-15T09:30:00.000Z')
})

test('an instant exactly on a boundary starts the NEW period, not the old one', () => {
  // Half-open [start, end): the boundary instant belongs to the period beginning at it.
  const p = periodFromAnchor(ANCHOR, new Date('2026-04-15T09:30:00Z'))
  assert.equal(iso(p.start), '2026-04-15T09:30:00.000Z')
})

test('one millisecond before a boundary is still the closing period', () => {
  // The call on the last night of the month — the case that bills twice or never.
  const p = periodFromAnchor(ANCHOR, new Date('2026-04-15T09:29:59.999Z'))
  assert.equal(iso(p.start), '2026-03-15T09:30:00.000Z')
  assert.equal(iso(p.end),   '2026-04-15T09:30:00.000Z')
})

test('an instant before the anchor yields the first period rather than walking backwards', () => {
  // A backfill or clock skew must not spin or produce a negative period.
  const p = periodFromAnchor(ANCHOR, new Date('2026-01-01T00:00:00Z'))
  assert.equal(iso(p.start), '2026-03-15T09:30:00.000Z')
})

test('periods stay anchored a year later, without drift', () => {
  const p = periodFromAnchor(new Date('2026-01-31T00:00:00Z'), new Date('2027-01-15T00:00:00Z'))
  // Clamping must not permanently move the anchor off the 31st.
  assert.equal(iso(p.start), '2026-12-31T00:00:00.000Z')
  assert.equal(iso(p.end),   '2027-01-31T00:00:00.000Z')
})

test('a clamped month does not become the new anchor — the drift bug, pinned', () => {
  // This caught a real bug during the build. Stepping forward from each boundary instead of from
  // the anchor turns 31 Jan into 28 Feb, and then 28 Mar, 28 Apr, 28 May — three days of every
  // later period silently in the wrong one. Every 31-day month must come back to the 31st.
  const anchor = new Date('2026-01-31T00:00:00Z')
  const dayOfMonthAt = (probe: string) => periodFromAnchor(anchor, new Date(probe)).start.getUTCDate()

  assert.equal(dayOfMonthAt('2026-02-10T00:00:00Z'), 31) // in the Jan 31 -> Feb 28 period
  assert.equal(dayOfMonthAt('2026-03-10T00:00:00Z'), 28) // Feb is short, so this one clamps
  assert.equal(dayOfMonthAt('2026-04-10T00:00:00Z'), 31) // and March must return to the 31st
  assert.equal(dayOfMonthAt('2026-05-10T00:00:00Z'), 30) // April has 30 days
  assert.equal(dayOfMonthAt('2026-06-10T00:00:00Z'), 31) // May returns to the 31st
})

// ── billable vs display ───────────────────────────────────────────────────────

const SUBBED = {
  clientDomain: 'www.Northsideroofing.com',
  stripeSubscriptionId: 'sub_123',
  currentPeriodStart: '2026-03-15T09:30:00Z',
}

test('a subscribed client with an anchor has a billable period', () => {
  const p = billablePeriodFor(SUBBED, new Date('2026-05-02T12:00:00Z'))
  assert.ok(p)
  assert.equal(iso(p.start), '2026-04-15T09:30:00.000Z')
})

test('NO subscription id means NOT billable — the demo line', () => {
  // demo.369agenticsystems.com takes calls every week and belongs to nobody. This must be
  // structurally impossible to bill, not merely skipped by a caller who remembers to check.
  assert.equal(billablePeriodFor({ clientDomain: 'demo.369agenticsystems.com' }, new Date()), null)
  assert.equal(billablePeriodFor(null, new Date()), null)
  assert.equal(billablePeriodFor(undefined, new Date()), null)
})

test('a subscription id with no anchor is NOT billable', () => {
  // A client onboarded before subscription capture. Inventing a period for them would bill
  // against a date we made up.
  assert.equal(billablePeriodFor({ clientDomain: 'x.com', stripeSubscriptionId: 'sub_1' }, new Date()), null)
  assert.equal(
    billablePeriodFor({ clientDomain: 'x.com', stripeSubscriptionId: 'sub_1', currentPeriodStart: 'nonsense' }, new Date()),
    null,
  )
})

test('display falls back to the calendar month where billing refuses', () => {
  // A widget reading "0 of 300" for an unbillable client is fine. An invoice is not.
  const at = new Date('2026-05-02T12:00:00Z')
  const p = displayPeriodFor({ clientDomain: 'demo.369agenticsystems.com' }, at)
  assert.equal(iso(p.start), '2026-05-01T00:00:00.000Z')
  assert.equal(iso(p.end),   '2026-06-01T00:00:00.000Z')
})

test('display uses the real billing period when there is one', () => {
  const p = displayPeriodFor(SUBBED, new Date('2026-05-02T12:00:00Z'))
  assert.equal(iso(p.start), '2026-04-15T09:30:00.000Z')
})

// ── containment ───────────────────────────────────────────────────────────────

test('containment is half-open', () => {
  const p = calendarMonthPeriod(new Date('2026-05-10T00:00:00Z'))
  assert.equal(periodContains(p, new Date('2026-05-01T00:00:00.000Z')), true)
  assert.equal(periodContains(p, new Date('2026-05-31T23:59:59.999Z')), true)
  assert.equal(periodContains(p, new Date('2026-06-01T00:00:00.000Z')), false)
  assert.equal(periodContains(p, new Date('2026-04-30T23:59:59.999Z')), false)
})

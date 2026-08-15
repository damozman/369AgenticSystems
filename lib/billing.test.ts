import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MAX_AUTO_BILL_CENTS,
  billingEnabled,
  decideBilling,
  formatPeriodRange,
  idempotencyKeyFor,
  invoiceItemDescription,
  maxAutoBillCents,
  type BillableRow,
} from './billing.ts'

/**
 * These tests are aimed at the two failures that actually cost something: charging a customer who
 * should not have been charged, and charging them twice. Everything else is recoverable with an
 * apology; those two are recoverable with a refund and a lost client.
 */

function row(over: Partial<BillableRow> = {}): BillableRow {
  return {
    id:                     'aaaaaaaa-0000-4000-8000-000000000001',
    client_domain:          'example.com',
    period_start:           '2026-07-14T00:00:00.000Z',
    period_end:             '2026-08-14T00:00:00.000Z',
    tier:                   'Starter',
    included_minutes:       300,
    billed_minutes:         412,
    overage_minutes:        112,
    overage_cents:          3920,
    status:                 'shadow',
    stripe_invoice_item_id: null,
    ...over,
  }
}

// ── the switch ────────────────────────────────────────────────────────────────

test('billing is off unless explicitly switched on', () => {
  // Deploying the billing code must not, by itself, charge anybody.
  assert.equal(billingEnabled({}), false)
  assert.equal(billingEnabled({ USAGE_BILLING_ENABLED: 'false' }), false)
  assert.equal(billingEnabled({ USAGE_BILLING_ENABLED: '1' }), false)
  assert.equal(billingEnabled({ USAGE_BILLING_ENABLED: 'TRUE' }), false)
  assert.equal(billingEnabled({ USAGE_BILLING_ENABLED: 'true' }), true)
})

// ── the period a customer reads on their invoice ──────────────────────────────

test('the printed period ends on the last day actually covered, not the exclusive bound', () => {
  // period_end is exclusive. Printing it would put a date on the invoice the customer was never
  // charged for — a discrepancy they can check, and will.
  const printed = formatPeriodRange('2026-07-14T00:00:00.000Z', '2026-08-14T00:00:00.000Z')
  assert.ok(printed.includes('Aug 13'), `expected the 13th, got: ${printed}`)
  assert.ok(!printed.includes('Aug 14'), `exclusive bound leaked into the invoice: ${printed}`)
  assert.ok(printed.includes('Jul 14'), `expected the start date, got: ${printed}`)
})

test('a period spanning a year boundary still prints the covered year', () => {
  const printed = formatPeriodRange('2026-12-14T00:00:00.000Z', '2027-01-14T00:00:00.000Z')
  assert.ok(printed.includes('Jan 13'), printed)
  assert.ok(printed.includes('2027'), printed)
})

// ── idempotency ───────────────────────────────────────────────────────────────

test('the idempotency key is derived from the row, so a re-run reuses it', () => {
  // A cron that runs twice must not bill twice.
  assert.equal(idempotencyKeyFor('abc-123'), 'usage-period-abc-123')
  assert.equal(idempotencyKeyFor('abc-123'), idempotencyKeyFor('abc-123'))
  assert.notEqual(idempotencyKeyFor('abc-123'), idempotencyKeyFor('abc-124'))
})

test('an already-invoiced period is never charged again', () => {
  const d = decideBilling(row({ stripe_invoice_item_id: 'ii_123' }), { stripeCustomerId: 'cus_1' })
  assert.equal(d.action, 'skip')
})

// ── who must never be charged ─────────────────────────────────────────────────

test('a client with no Stripe customer is skipped, not charged', () => {
  // The demo line and anyone predating customer capture. Unbillable structurally.
  const d = decideBilling(row(), { stripeCustomerId: null })
  assert.equal(d.action, 'skip')
  assert.match((d as { reason: string }).reason, /no Stripe customer/)
})

test('a period inside the allowance is skipped', () => {
  const d = decideBilling(row({ overage_minutes: 0, overage_cents: 0 }), { stripeCustomerId: 'cus_1' })
  assert.equal(d.action, 'skip')
  assert.match((d as { reason: string }).reason, /within allowance/)
})

test('a row that is not shadow is left alone', () => {
  for (const status of ['invoiced', 'skipped', 'failed']) {
    const d = decideBilling(row({ status }), { stripeCustomerId: 'cus_1' })
    assert.equal(d.action, 'skip', `status '${status}' should not be charged`)
  }
})

// ── the blast radius ──────────────────────────────────────────────────────────

test('an overage at or above the ceiling stops for a human instead of charging', () => {
  // Every billed number descends from a duration we COPIED from Retell. A unit mix-up upstream
  // produces arithmetic that is perfectly correct and catastrophically large.
  const d = decideBilling(row({ overage_cents: DEFAULT_MAX_AUTO_BILL_CENTS }), { stripeCustomerId: 'cus_1' })
  assert.equal(d.action, 'hold')
  assert.equal((d as { status: string }).status, 'failed')
})

test('just under the ceiling still charges', () => {
  const d = decideBilling(row({ overage_cents: DEFAULT_MAX_AUTO_BILL_CENTS - 1 }), { stripeCustomerId: 'cus_1' })
  assert.equal(d.action, 'charge')
})

test('cents that are not a whole positive number are held, never charged', () => {
  for (const cents of [39.5, -100, NaN]) {
    const d = decideBilling(row({ overage_cents: cents }), { stripeCustomerId: 'cus_1' })
    assert.notEqual(d.action, 'charge', `${cents} should never reach a card`)
  }
})

test('the ceiling is overridable but ignores nonsense', () => {
  assert.equal(maxAutoBillCents({ USAGE_MAX_AUTO_BILL_CENTS: '90000' }), 90000)
  assert.equal(maxAutoBillCents({ USAGE_MAX_AUTO_BILL_CENTS: 'lots' }), DEFAULT_MAX_AUTO_BILL_CENTS)
  assert.equal(maxAutoBillCents({ USAGE_MAX_AUTO_BILL_CENTS: '0' }),    DEFAULT_MAX_AUTO_BILL_CENTS)
  assert.equal(maxAutoBillCents({ USAGE_MAX_AUTO_BILL_CENTS: '-5' }),   DEFAULT_MAX_AUTO_BILL_CENTS)
  assert.equal(maxAutoBillCents({}),                                     DEFAULT_MAX_AUTO_BILL_CENTS)
})

// ── the happy path, exactly ───────────────────────────────────────────────────

test('a normal overage charges the exact cents the meter computed', () => {
  const d = decideBilling(row(), { stripeCustomerId: 'cus_1' })
  assert.equal(d.action, 'charge')
  // 112 minutes over on Starter at 35c = 3920. Not 39.199999.
  assert.equal((d as { amountCents: number }).amountCents, 3920)
  assert.equal((d as { idempotencyKey: string }).idempotencyKey, 'usage-period-aaaaaaaa-0000-4000-8000-000000000001')
})

test('the invoice line states the tier rate the customer was actually charged', () => {
  assert.match(invoiceItemDescription(row({ tier: 'Starter' })), /\$0\.35\/min/)
  assert.match(invoiceItemDescription(row({ tier: 'Pro' })),     /\$0\.30\/min/)
  assert.match(invoiceItemDescription(row({ tier: 'Elite' })),   /\$0\.25\/min/)
  // An unresolvable tier falls back to Starter's rate, matching computeUsage.
  assert.match(invoiceItemDescription(row({ tier: null })),      /\$0\.35\/min/)
})

test('the invoice line shows both the usage and the allowance it exceeded', () => {
  const line = invoiceItemDescription(row())
  assert.match(line, /412 minutes used of 300 included/)
  assert.match(line, /112 over/)
})

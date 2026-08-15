/**
 * Usage billing — Phase B decisions, guards, and invoice wording.
 *
 * Pure: a `usage_periods` row in, a decision out. No Stripe client, no database, no clock unless
 * injected. Same reasoning as lib/usage.ts and lib/availability.ts — the route that moves money is
 * deliberately thin, and everything that could charge a customer wrong lives here where a test can
 * reach it.
 *
 * Phase A measured for a full cycle and reconciled exactly against Retell (48 calls, 105 minutes,
 * 2026-08-14). That reconciliation was the gate. This file is what it opened.
 */

import { formatCents } from '@/lib/usage'
import { OVERAGE_RATE_CENTS, type TierName } from '@/lib/tier-config'

/** A `usage_periods` row, as the billing pass reads it. */
export interface BillableRow {
  id:                     string
  client_domain:          string
  period_start:           string
  period_end:             string
  tier:                   string | null
  included_minutes:       number
  billed_minutes:         number
  overage_minutes:        number
  overage_cents:          number
  status:                 string
  stripe_invoice_item_id: string | null
}

/**
 * The most any single period may be charged automatically, in integer cents.
 *
 * Not a business rule — a blast radius. Every number this system bills is derived from
 * `calls.duration_seconds`, which we *copy* from Retell's payload; `verify-usage.mjs` already
 * caught one call recorded as null that Retell said ran 234 seconds. A copy that goes wrong in the
 * other direction — a unit mix-up putting milliseconds in a seconds column — turns a $12 overage
 * into a $700 one, and the arithmetic downstream would be perfectly correct the whole way.
 *
 * $500 is roughly 24 hours of conversation beyond an allowance in a single month. A real client
 * can reach it; a bug reaches it faster. Anything at or above stops and asks for a human instead
 * of charging a card. Overridable via `USAGE_MAX_AUTO_BILL_CENTS` for the day a client genuinely
 * outgrows it.
 */
export const DEFAULT_MAX_AUTO_BILL_CENTS = 50_000

export function maxAutoBillCents(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.USAGE_MAX_AUTO_BILL_CENTS)
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_MAX_AUTO_BILL_CENTS
}

/**
 * Billing is off unless explicitly switched on.
 *
 * Deploying this file must not, by itself, charge anybody. The code ships, gets verified against
 * production with the switch off, and only then does the switch flip — the same
 * dormant-until-configured shape the Stripe webhook and Twilio client already use.
 *
 * **The pricing copy flips when this does, not when the code merges.** `TIER_MINUTES` and
 * `OVERAGE_RATE_CENTS` stay unadvertised until then; this repo has already shipped a pricing
 * promise with nothing behind it once (2026-07-11).
 */
export function billingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.USAGE_BILLING_ENABLED === 'true'
}

export type BillingDecision =
  /** Charge it. `amountCents` is what Stripe receives, in integer cents. */
  | { action: 'charge'; amountCents: number; description: string; idempotencyKey: string }
  /** Nothing owed, or nothing chargeable. Terminal, not a fault. */
  | { action: 'skip';   status: 'skipped'; reason: string }
  /** Something a human must look at before money moves. */
  | { action: 'hold';   status: 'failed';  reason: string }

/**
 * Stripe's idempotency key for this period.
 *
 * Derived from the row id so a cron that runs twice within Stripe's 24-hour replay window gets the
 * *same* invoice item back rather than a second one. Beyond that window the key expires, which is
 * why the route also checks Stripe's own pending invoice items by metadata before creating —
 * belt and braces, because the failure this guards against is billing a customer twice.
 */
export function idempotencyKeyFor(usagePeriodId: string): string {
  return `usage-period-${usagePeriodId}`
}

/**
 * The period as a human reads it on an invoice.
 *
 * `period_end` is **exclusive** — the last covered instant is one millisecond earlier. Printing the
 * exclusive bound would put a date on a customer's invoice they were not charged for, and it is
 * the kind of discrepancy that turns into a support email rather than a refund.
 */
export function formatPeriodRange(startIso: string, endIso: string): string {
  const start       = new Date(startIso)
  const lastCovered = new Date(new Date(endIso).getTime() - 1)

  const day  = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  const full = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

  return `${day.format(start)} – ${full.format(lastCovered)}`
}

/** The line a customer actually reads on their invoice. Specific enough to check our work against. */
export function invoiceItemDescription(row: BillableRow): string {
  const rate = OVERAGE_RATE_CENTS[(row.tier ?? '') as TierName] ?? OVERAGE_RATE_CENTS.Starter
  return (
    `Call minutes overage — ${formatPeriodRange(row.period_start, row.period_end)}: ` +
    `${row.billed_minutes} minutes used of ${row.included_minutes} included, ` +
    `${row.overage_minutes} over at ${formatCents(rate)}/min`
  )
}

/**
 * What to do with one closed period.
 *
 * Every branch that declines to charge is deliberate and named. A billing pass that silently does
 * nothing is indistinguishable from one that is broken, and this system has been bitten by exactly
 * that shape before — an armed gate that quietly stopped every producer.
 */
export function decideBilling(
  row: BillableRow,
  opts: { stripeCustomerId?: string | null; maxCents?: number } = {},
): BillingDecision {
  const maxCents = opts.maxCents ?? maxAutoBillCents()

  if (row.stripe_invoice_item_id) {
    return { action: 'skip', status: 'skipped', reason: 'already invoiced' }
  }
  if (row.status !== 'shadow') {
    return { action: 'skip', status: 'skipped', reason: `status is '${row.status}', not 'shadow'` }
  }
  if (row.overage_minutes <= 0 || row.overage_cents <= 0) {
    return { action: 'skip', status: 'skipped', reason: 'within allowance' }
  }

  // No customer means no card. The demo line and anyone predating Stripe-customer capture land
  // here, and they must stay unbillable structurally rather than by a caller remembering to check.
  if (!opts.stripeCustomerId) {
    return { action: 'skip', status: 'skipped', reason: 'no Stripe customer on file' }
  }

  // Non-integer or negative cents means the arithmetic upstream produced something impossible.
  // Refusing is cheap; charging a card from a number we cannot explain is not.
  if (!Number.isInteger(row.overage_cents) || row.overage_cents < 0) {
    return { action: 'hold', status: 'failed', reason: `overage_cents is not a whole positive number: ${row.overage_cents}` }
  }

  if (row.overage_cents >= maxCents) {
    return {
      action: 'hold',
      status: 'failed',
      reason: `${formatCents(row.overage_cents)} is at or above the ${formatCents(maxCents)} auto-bill ceiling — needs review`,
    }
  }

  return {
    action:         'charge',
    amountCents:    row.overage_cents,
    description:    invoiceItemDescription(row),
    idempotencyKey: idempotencyKeyFor(row.id),
  }
}

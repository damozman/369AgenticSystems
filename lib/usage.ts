/**
 * Billable call minutes and overage.
 *
 * Pure — a list of call durations and a tier in, minutes and cents out. No database, no Stripe,
 * no clock. Same reasoning as lib/availability.ts: this is the arithmetic a billing mistake would
 * live in, and the only honest way to trust it is to test it directly.
 *
 * **Money is integer cents everywhere.** `0.35 * 3` is `1.0499999999999998` in floating point,
 * and a bill that is a cent wrong in the customer's disfavour costs more trust than the whole
 * overage earns. Nothing in this file holds a dollar as a float.
 */

import { OVERAGE_RATE_CENTS, TIER_MINUTES, type TierName } from '@/lib/tier-config'

/** A call as the meter sees it. `duration_seconds` is null on rows the webhook never completed. */
export interface MeteredCall {
  duration_seconds: number | null
}

export interface UsageSummary {
  /** What the tier includes for the period. */
  includedMinutes: number
  /** What the caller actually used, after per-call rounding. */
  billedMinutes:   number
  /** Minutes beyond the allowance. Zero when inside it. */
  overageMinutes:  number
  /** Cost of those minutes, in integer cents. */
  overageCents:    number
}

/**
 * Minutes for one call: **rounded up to the whole minute**.
 *
 * Matches how Retell, Twilio and Smith.ai all bill, so it is what a buyer expects and it is one
 * sentence to explain.
 *
 * A call of zero seconds bills **zero**, not one. Rounding "up" from nothing is how a meter
 * quietly starts charging for hang-ups and missed connections — and a 0-second call is a real
 * thing in this data, not a hypothetical (2026-08-07 on the demo line). Null is treated the same:
 * the `call_ended` webhook never landed, so we do not know the duration, and guessing upward in
 * our own favour is not defensible.
 */
export function callMinutes(durationSeconds: number | null | undefined): number {
  if (durationSeconds === null || durationSeconds === undefined) return 0
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  return Math.ceil(durationSeconds / 60)
}

/**
 * Total billable minutes across a period.
 *
 * Each call is rounded **individually** before summing — that is what per-minute billing means,
 * and it is materially different from summing seconds and rounding once. Three calls of 0:42,
 * 2:05 and 1:58 bill 6 minutes, not 5.
 */
export function billableMinutes(calls: MeteredCall[]): number {
  return (calls ?? []).reduce((total, call) => total + callMinutes(call?.duration_seconds), 0)
}

/**
 * The period's usage against a tier's allowance.
 *
 * An unknown tier falls back to Starter's allowance and rate — the least generous included
 * minutes, but also the *highest* overage rate, so it is not automatically the safe default.
 * It is the same fallback `PRICE_BY_TIER` already uses in lib/onboard-client.ts, and a tier that
 * does not resolve is a data fault worth surfacing rather than silently billing something else.
 */
export function computeUsage(tier: TierName | string | null | undefined, minutes: number): UsageSummary {
  const resolved = (tier ?? '') as TierName
  const includedMinutes = TIER_MINUTES[resolved] ?? TIER_MINUTES.Starter
  const rateCents       = OVERAGE_RATE_CENTS[resolved] ?? OVERAGE_RATE_CENTS.Starter

  const billedMinutes  = Math.max(0, Math.trunc(minutes || 0))
  const overageMinutes = Math.max(0, billedMinutes - includedMinutes)

  return {
    includedMinutes,
    billedMinutes,
    overageMinutes,
    // Integer multiplication only — both operands are whole numbers by construction.
    overageCents: overageMinutes * rateCents,
  }
}

/** Convenience: calls straight to a summary, for the dashboard and the rollup cron. */
export function summarise(tier: TierName | string | null | undefined, calls: MeteredCall[]): UsageSummary {
  return computeUsage(tier, billableMinutes(calls))
}

/** Cents → "$39.20", for display and for the Stripe invoice-item description in Phase B. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(cents))
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

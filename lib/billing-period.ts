/**
 * Which billing period a call belongs to.
 *
 * Pure and clock-injectable, like lib/availability.ts — periods are the thing an off-by-one lands
 * in, and "the call on the last night of the month" is not testable against a real clock.
 *
 * A period is **half-open, [start, end)** — the same convention `filterAvailable` uses for slots.
 * A call at 23:59:59 on the last day belongs to the period that is closing; a call at 00:00:00
 * belongs to the next. Getting this wrong bills a customer twice for one call or not at all.
 */

/** UTC throughout. Vercel runs UTC, Stripe reports UTC, and a billing period is not a wall clock. */
export interface BillingPeriod {
  start: Date
  /** Exclusive. */
  end:   Date
}

/**
 * A client's subscription as the meter needs to see it.
 *
 * `stripeSubscriptionId` being absent is the load-bearing case: the shared demo line has no
 * `agent_subscriptions` row at all, and any client who predates subscription capture has no
 * anchor. Neither can be billed, and that must be impossible rather than merely unlikely — see
 * `billablePeriodFor`.
 */
export interface MeteredSubscription {
  clientDomain:          string
  stripeSubscriptionId?: string | null
  /** Stripe's `current_period_start`, as an ISO string or Date. The anchor for every period. */
  currentPeriodStart?:   string | Date | null
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Advance a UTC instant by whole months, clamping the day.
 *
 * A subscription anchored on the 31st has no 31st in February. Stripe clamps to the last day of
 * the month and so must we, or the period silently slides forward and every subsequent boundary
 * is wrong.
 */
export function addMonthsUtc(from: Date, months: number): Date {
  const year = from.getUTCFullYear()
  const month = from.getUTCMonth() + months
  const day = from.getUTCDate()

  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(
    year, month, Math.min(day, lastDayOfTarget),
    from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds(),
  ))
}

/**
 * The period containing `at`, walking forward from the subscription anchor in whole months.
 *
 * Derived from the anchor rather than read from Stripe on every call: the rollup runs daily over
 * every client, and a Stripe round trip per client per day to learn a date we can compute is a
 * cost and a dependency for nothing. Stripe stays the source of the *anchor*; the arithmetic is
 * ours and is tested.
 */
export function periodFromAnchor(anchor: Date, at: Date): BillingPeriod {
  // An `at` before the anchor (a backfill, or clock skew) yields the first period rather than
  // walking backwards forever.
  if (at <= anchor) return { start: anchor, end: addMonthsUtc(anchor, 1) }

  /**
   * Every boundary is computed as `anchor + n months` — never by stepping forward from the
   * previous boundary.
   *
   * Stepping drifts, and the drift is permanent. A subscription anchored on 31 January clamps to
   * 28 February, and a stepping loop then treats *the 28th* as the new anchor: March 28, April
   * 28, forever. Three days of every later period land in the wrong one. Caught by the
   * "stays anchored a year later" test, which is the only reason this comment exists.
   */
  let n = (at.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (at.getUTCMonth() - anchor.getUTCMonth())
  // The month estimate can be one out either way once clamping and time-of-day are involved.
  if (addMonthsUtc(anchor, n) > at) n -= 1
  while (addMonthsUtc(anchor, n + 1) <= at) n += 1

  return { start: addMonthsUtc(anchor, n), end: addMonthsUtc(anchor, n + 1) }
}

/** Calendar-month period, for display where there is no subscription to anchor to. */
export function calendarMonthPeriod(at: Date): BillingPeriod {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1))
  return { start, end: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1)) }
}

/**
 * The period a client may be **billed** for, or `null` when they may not be billed at all.
 *
 * Returning null is the whole point of this function. The demo line takes calls every week and
 * belongs to nobody; a client onboarded before subscription capture has no anchor to bill
 * against. Both must be structurally unbillable, not merely skipped by a caller who remembers to
 * check — the rollup cron branches on this and cannot construct a billable period without an
 * anchor even if it tried.
 */
export function billablePeriodFor(
  subscription: MeteredSubscription | null | undefined,
  at: Date = new Date(),
): BillingPeriod | null {
  if (!subscription?.stripeSubscriptionId) return null
  const anchor = toDate(subscription.currentPeriodStart)
  if (!anchor) return null
  return periodFromAnchor(anchor, at)
}

/**
 * The period to *show* a client, which is a looser question than what to bill them.
 *
 * Falls back to the calendar month so the dashboard has something honest to display before
 * subscription capture is in place. Display is not billing: a widget that reads "0 of 300" for a
 * client we cannot yet bill is fine, and an invoice for the same client is not.
 */
export function displayPeriodFor(
  subscription: MeteredSubscription | null | undefined,
  at: Date = new Date(),
): BillingPeriod {
  return billablePeriodFor(subscription, at) ?? calendarMonthPeriod(at)
}

/** Half-open containment: `[start, end)`. */
export function periodContains(period: BillingPeriod, at: Date): boolean {
  return at >= period.start && at < period.end
}

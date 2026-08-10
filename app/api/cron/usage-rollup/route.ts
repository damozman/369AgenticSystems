import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { billablePeriodFor, periodFromAnchor, type BillingPeriod } from '@/lib/billing-period'
import { summarise } from '@/lib/usage'
import { formatCents } from '@/lib/usage'
import type { TierName } from '@/lib/tier-config'

/**
 * Daily usage rollup — Phase A: measure and record, bill nothing.
 *
 * For every subscribed client, closes any billing period that has ended and writes one
 * `usage_periods` row recording what that period WOULD have cost, with status `'shadow'`.
 *
 * **It creates no Stripe charge and sends no email.** That is the point, not an omission. The
 * meter has never run against real traffic, and the first thing a new meter should do is be
 * wrong somewhere cheap. After a full cycle these rows get reconciled against Retell's own call
 * records (scripts/verify-usage.mjs); that comparison is what gates billing, not a date.
 *
 * Silent when healthy, like every other cron here — a green run every morning trains you to
 * ignore the mail.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface SubscriptionRow {
  client_domain:          string
  tier:                   string | null
  stripe_subscription_id: string | null
  created_at:             string
}

/**
 * The most recent period that has fully ended, or null if none has.
 *
 * Only closed periods are recorded. A period still in progress has more calls coming, and a row
 * written mid-period would be a number that changes after the fact — which is exactly what an
 * invoice must never be.
 */
function lastClosedPeriod(anchor: Date, now: Date): BillingPeriod | null {
  const current = periodFromAnchor(anchor, now)
  if (current.start <= anchor) return null // still inside the very first period
  const previous = periodFromAnchor(anchor, new Date(current.start.getTime() - 1))
  return previous.end <= now ? previous : null
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const { data: subscriptions, error } = await supabase
    .from('agent_subscriptions')
    .select('client_domain, tier, stripe_subscription_id, created_at')

  if (error) {
    console.error('[USAGE ROLLUP] ✗  Could not read subscriptions:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let recorded = 0
  let skipped = 0

  for (const sub of (subscriptions ?? []) as SubscriptionRow[]) {
    /**
     * The anchor. Stripe's `current_period_start` is the real one, but until subscription
     * capture has been running for a cycle most rows will not have it — so the subscription's
     * own `created_at` stands in.
     *
     * This is a *display-grade* anchor, and it is why every row written here is `'shadow'`:
     * good enough to measure and reconcile, not good enough to invoice. Phase B reads the true
     * anchor from Stripe before a single charge.
     */
    const anchor = new Date(sub.created_at)
    const period = lastClosedPeriod(anchor, now)

    if (!period) {
      skipped++
      continue
    }

    // Already recorded — the unique index on (client_domain, period_start) makes this idempotent,
    // but skipping the query work is free.
    const { data: existing } = await supabase
      .from('usage_periods')
      .select('id, status')
      .eq('client_domain', sub.client_domain)
      .eq('period_start', period.start.toISOString())
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    // Half-open [start, end): `lt` on the end, never `lte`. A call at the boundary instant
    // belongs to the next period.
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('duration_seconds')
      .eq('client_domain', sub.client_domain)
      .gte('created_at', period.start.toISOString())
      .lt('created_at', period.end.toISOString())

    if (callsError) {
      // Recording a period as zero because the query failed would understate a real bill and
      // then look settled. Leave it unwritten so the next run picks it up.
      console.error(`[USAGE ROLLUP] ✗  Could not read calls for ${sub.client_domain}: ${callsError.message}`)
      continue
    }

    const usage = summarise(sub.tier as TierName, calls ?? [])

    // A client with no Stripe subscription cannot be billed at all — the demo line, and anyone
    // onboarded before subscription capture. Their usage is still worth recording (it is real
    // traffic, and it is what the dashboard shows), but it is marked so no future billing pass
    // can mistake it for something chargeable.
    const billable = billablePeriodFor(
      { clientDomain: sub.client_domain, stripeSubscriptionId: sub.stripe_subscription_id, currentPeriodStart: sub.created_at },
      now,
    )
    const status = billable && usage.overageMinutes > 0 ? 'shadow' : 'skipped'

    const { error: insertError } = await supabase.from('usage_periods').insert({
      client_domain:    sub.client_domain,
      period_start:     period.start.toISOString(),
      period_end:       period.end.toISOString(),
      tier:             sub.tier ?? 'Starter',
      included_minutes: usage.includedMinutes,
      billed_minutes:   usage.billedMinutes,
      overage_minutes:  usage.overageMinutes,
      overage_cents:    usage.overageCents,
      status,
    })

    if (insertError) {
      // 23505 is the unique-violation code: another run got there first. Not a fault.
      if (insertError.code !== '23505') {
        console.error(`[USAGE ROLLUP] ✗  Could not record ${sub.client_domain}: ${insertError.message}`)
      }
      continue
    }

    recorded++
    console.log(
      `[USAGE ROLLUP] ·  ${sub.client_domain} ${period.start.toISOString().slice(0, 10)}` +
      ` — ${usage.billedMinutes}/${usage.includedMinutes} min` +
      (usage.overageMinutes > 0
        ? `, ${usage.overageMinutes} over = ${formatCents(usage.overageCents)} (NOT billed, ${status})`
        : ', within allowance'),
    )
  }

  console.log(`[USAGE ROLLUP] ✓  ${recorded} period(s) recorded, ${skipped} skipped — nothing billed`)
  return NextResponse.json({ success: true, recorded, skipped, billed: 0 })
}

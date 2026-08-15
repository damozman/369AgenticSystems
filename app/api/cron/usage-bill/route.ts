import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { billingEnabled, decideBilling, type BillableRow } from '@/lib/billing'
import { formatCents } from '@/lib/usage'
import { formatPeriodRange } from '@/lib/billing'
import { escapeHtml } from '@/lib/security/sanitize'
import { resendFrom } from '@/lib/email-from'

/**
 * Usage billing — Phase B. This is the pass that charges money.
 *
 * Reads the `'shadow'` rows the rollup wrote for closed periods and turns the ones with a real
 * overage into Stripe invoice items. Invoice items attach to the subscription's **next** invoice
 * automatically, so this needs no metered price and no restructuring of a live subscription.
 *
 * Three things hold this together, and each exists because of a specific way billing goes wrong:
 *
 * 1. **It is off unless switched on.** `USAGE_BILLING_ENABLED` must be exactly `'true'`. Deploying
 *    this file charges nobody.
 * 2. **A cron that runs twice must not bill twice.** Stripe's idempotency key covers a re-run
 *    inside 24 hours; beyond that the key expires, so we also ask Stripe whether a pending invoice
 *    item already carries this period's id before creating one. If that check cannot be completed,
 *    we do **not** charge — the whole point is that "I could not verify" and "it is safe" are
 *    different answers.
 * 3. **A ceiling.** Every number here descends from a duration copied from Retell's payload. An
 *    upstream unit mix-up yields arithmetic that is flawless and enormous, so anything at or above
 *    the ceiling stops for a human.
 *
 * The rollup stays purely a meter. Measurement and billing are separate crons on purpose: a bug in
 * here must not be able to corrupt the ledger it reads from.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'

interface SubscriptionLite {
  client_domain:      string
  user_email:         string | null
  stripe_customer_id: string | null
}

/**
 * Has Stripe already got an invoice item for this period?
 *
 * Returns the existing id, `null` if there is none, or throws if the question could not be
 * answered. The caller treats a throw as "do not charge" — an unverifiable duplicate check is a
 * reason to stop, not to proceed hopefully.
 */
async function existingInvoiceItemFor(
  stripe: Stripe,
  customerId: string,
  usagePeriodId: string,
): Promise<string | null> {
  const pending = await stripe.invoiceItems.list({ customer: customerId, pending: true, limit: 100 })
  const match = pending.data.find(item => item.metadata?.usage_period_id === usagePeriodId)
  return match?.id ?? null
}

async function notify(subject: string, html: string, to: string[]) {
  if (!process.env.RESEND_API_KEY) return
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({ from: resendFrom('369 Billing'), to, subject, html })
  } catch (e) {
    // A failed notification must never abort a billing run that already succeeded, nor retry the
    // charge. Log and carry on.
    console.error('[USAGE BILL] ✗  Could not send notification:', e instanceof Error ? e.message : e)
  }
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!billingEnabled()) {
    console.log('[USAGE BILL] ·  USAGE_BILLING_ENABLED is not "true" — measuring only, nothing billed')
    return NextResponse.json({ success: true, enabled: false, billed: 0 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[USAGE BILL] ✗  Billing is enabled but STRIPE_SECRET_KEY is not set')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Only closed periods that computed a real overage and have never been invoiced. The index
  // `usage_periods_unbilled_idx` covers exactly this predicate.
  const { data: rows, error } = await supabase
    .from('usage_periods')
    .select('id, client_domain, period_start, period_end, tier, included_minutes, billed_minutes, overage_minutes, overage_cents, status, stripe_invoice_item_id, alerted_at')
    .eq('status', 'shadow')
    .gt('overage_minutes', 0)
    .is('stripe_invoice_item_id', null)
    .order('period_start', { ascending: true })

  if (error) {
    console.error('[USAGE BILL] ✗  Could not read usage periods:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let billed = 0, skipped = 0, held = 0

  for (const row of (rows ?? []) as (BillableRow & { alerted_at: string | null })[]) {
    const { data: sub } = await supabase
      .from('agent_subscriptions')
      .select('client_domain, user_email, stripe_customer_id')
      .eq('client_domain', row.client_domain)
      .maybeSingle<SubscriptionLite>()

    const decision = decideBilling(row, { stripeCustomerId: sub?.stripe_customer_id })

    if (decision.action !== 'charge') {
      await supabase
        .from('usage_periods')
        .update({ status: decision.status, last_error: decision.reason, updated_at: new Date().toISOString() })
        .eq('id', row.id)

      if (decision.action === 'hold') {
        held++
        console.error(`[USAGE BILL] ✗  HELD ${row.client_domain} — ${decision.reason}`)
        await notify(
          `Usage billing held for review — ${row.client_domain}`,
          `<p>A closed period was <strong>not</strong> billed and needs a human.</p>
           <p><strong>${escapeHtml(row.client_domain)}</strong><br>
           ${escapeHtml(formatPeriodRange(row.period_start, row.period_end))}<br>
           ${row.billed_minutes} min used of ${row.included_minutes} included,
           ${row.overage_minutes} over = ${escapeHtml(formatCents(row.overage_cents))}</p>
           <p>Reason: ${escapeHtml(decision.reason)}</p>`,
          [OWNER_EMAIL],
        )
      } else {
        skipped++
      }
      continue
    }

    // Duplicate check that outlives Stripe's 24-hour idempotency window. If this throws we stop
    // rather than risk a second charge.
    let alreadyThere: string | null
    try {
      alreadyThere = await existingInvoiceItemFor(stripe, sub!.stripe_customer_id!, row.id)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[USAGE BILL] ✗  Could not verify existing invoice items for ${row.client_domain}: ${message}`)
      await supabase
        .from('usage_periods')
        .update({ last_error: `duplicate check failed: ${message}`, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      continue
    }

    let invoiceItemId = alreadyThere

    if (!invoiceItemId) {
      try {
        const item = await stripe.invoiceItems.create(
          {
            customer:    sub!.stripe_customer_id!,
            amount:      decision.amountCents,
            currency:    'usd',
            description: decision.description,
            metadata:    { usage_period_id: row.id, client_domain: row.client_domain },
          },
          { idempotencyKey: decision.idempotencyKey },
        )
        invoiceItemId = item.id
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error(`[USAGE BILL] ✗  Stripe rejected ${row.client_domain}: ${message}`)
        await supabase
          .from('usage_periods')
          .update({ status: 'failed', last_error: message, updated_at: new Date().toISOString() })
          .eq('id', row.id)
        held++
        continue
      }
    } else {
      console.log(`[USAGE BILL] ·  ${row.client_domain} already had invoice item ${invoiceItemId} — adopting it, not re-billing`)
    }

    const { error: updateError } = await supabase
      .from('usage_periods')
      .update({
        stripe_invoice_item_id: invoiceItemId,
        status:                 'invoiced',
        last_error:             null,
        updated_at:             new Date().toISOString(),
      })
      .eq('id', row.id)

    if (updateError) {
      // Stripe has the charge; we failed to record it. The next run's metadata lookup finds the
      // same item and adopts it rather than creating a second — which is exactly why that lookup
      // exists and why it is not optional.
      console.error(`[USAGE BILL] ✗  Billed ${row.client_domain} but could not record it: ${updateError.message}`)
      continue
    }

    billed++
    console.log(
      `[USAGE BILL] ✓  ${row.client_domain} ${row.period_start.slice(0, 10)} — ` +
      `${row.overage_minutes} min over = ${formatCents(row.overage_cents)} → ${invoiceItemId}`,
    )

    /**
     * Tell them, once. Guarded by `alerted_at` for the same reason the calendar connection is: a
     * repeated message about a known state gets filtered exactly like a repeated all-clear does.
     *
     * This lands before the invoice does — an invoice item attaches to the *next* invoice — which
     * is the whole point. They hear it from us first.
     */
    if (!row.alerted_at && sub?.user_email) {
      await notify(
        `Your call minutes for ${formatPeriodRange(row.period_start, row.period_end)}`,
        `<p>Your AI receptionist handled <strong>${row.billed_minutes} minutes</strong> of calls
            between ${escapeHtml(formatPeriodRange(row.period_start, row.period_end))}.</p>
         <p>Your ${escapeHtml(row.tier ?? 'plan')} plan includes ${row.included_minutes} minutes, so
            <strong>${row.overage_minutes} minutes</strong> were beyond it. That comes to
            <strong>${escapeHtml(formatCents(row.overage_cents))}</strong>, which will appear as a
            line on your next invoice.</p>
         <p>Nothing has been charged separately — it is added to the invoice you already receive.</p>`,
        [sub.user_email],
      )
      await supabase
        .from('usage_periods')
        .update({ alerted_at: new Date().toISOString() })
        .eq('id', row.id)
    }
  }

  console.log(`[USAGE BILL] ✓  ${billed} billed, ${skipped} skipped, ${held} held for review`)
  return NextResponse.json({ success: true, enabled: true, billed, skipped, held })
}

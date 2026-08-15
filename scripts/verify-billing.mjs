/**
 * Usage billing (Phase B) — a dry run against the REAL ledger. Touches Stripe not at all.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-billing.mjs
 *
 * Answers the only question worth asking before a billing switch is flipped: *given the rows that
 * actually exist right now, who would be charged, how much, and why?* It runs the same
 * `decideBilling` the cron runs, so the answer is not an approximation of the code — it is the
 * code.
 *
 * It also asserts the safety properties directly rather than trusting that they hold:
 * the switch is off, nothing carries a Stripe invoice item, and the demo line is unreachable.
 *
 * Companion to verify-usage.mjs, which proves the *meter* agrees with Retell. This one proves the
 * *biller* agrees with the meter.
 */

import { createClient } from '@supabase/supabase-js'
import { decideBilling, billingEnabled, maxAutoBillCents, invoiceItemDescription } from '../lib/billing.ts'
import { formatCents } from '../lib/usage.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}
const db = createClient(url, key)

let failures = 0
const ok   = (m, d) => console.log(`  ✓ ${m}${d ? `  — ${d}` : ''}`)
const bad  = (m, d) => { failures++; console.log(`  ✗ ${m}${d ? `  — ${d}` : ''}`) }
const note = m => console.log(`  · ${m}`)

// ── 1. The switch ─────────────────────────────────────────────────────────────
console.log('\n1. Billing switch')

if (billingEnabled()) {
  note('USAGE_BILLING_ENABLED is "true" — billing is LIVE. Every charge below is real.')
} else {
  ok('billing is off', 'USAGE_BILLING_ENABLED is not "true", so the cron charges nothing')
}
note(`auto-bill ceiling: ${formatCents(maxAutoBillCents())} per period`)

// ── 2. Nothing has been billed yet ────────────────────────────────────────────
console.log('\n2. Ledger state')

const { data: periods, error: periodsError } = await db
  .from('usage_periods')
  .select('id, client_domain, period_start, period_end, tier, included_minutes, billed_minutes, overage_minutes, overage_cents, status, stripe_invoice_item_id, alerted_at')
  .order('period_start', { ascending: false })

if (periodsError) {
  bad('could not read usage_periods', periodsError.message)
} else if (!periods?.length) {
  note('no periods recorded yet — the rollup writes a row only once a period has fully closed')
} else {
  ok(`${periods.length} period(s) recorded`)
  const invoiced = periods.filter(p => p.stripe_invoice_item_id)
  if (invoiced.length === 0) {
    ok('no period carries a Stripe invoice item')
  } else if (billingEnabled()) {
    ok(`${invoiced.length} period(s) invoiced`, 'expected once billing is live')
  } else {
    bad(`${invoiced.length} period(s) carry a Stripe invoice item`, 'but billing is switched off — investigate')
  }
}

// ── 3. What the cron WOULD do, row by row ─────────────────────────────────────
console.log('\n3. Dry run — the real decision for every recorded period')

const { data: subs } = await db
  .from('agent_subscriptions')
  .select('client_domain, user_email, stripe_customer_id')

const customerByDomain = new Map((subs ?? []).map(s => [s.client_domain, s.stripe_customer_id]))
const emailByDomain    = new Map((subs ?? []).map(s => [s.client_domain, s.user_email]))

let wouldCharge = 0
let wouldChargeCents = 0

for (const p of periods ?? []) {
  const decision = decideBilling(p, { stripeCustomerId: customerByDomain.get(p.client_domain) })
  const window = `${p.period_start.slice(0, 10)}→${p.period_end.slice(0, 10)}`

  if (decision.action === 'charge') {
    wouldCharge++
    wouldChargeCents += decision.amountCents
    console.log(`     CHARGE  ${p.client_domain}  ${window}  ${formatCents(decision.amountCents)}`)
    console.log(`             "${invoiceItemDescription(p)}"`)
    console.log(`             notify: ${emailByDomain.get(p.client_domain) ?? '(no email on file)'}${p.alerted_at ? ' — already alerted' : ''}`)
  } else if (decision.action === 'hold') {
    console.log(`     HOLD    ${p.client_domain}  ${window}  ${decision.reason}`)
  } else {
    console.log(`     skip    ${p.client_domain}  ${window}  ${decision.reason}`)
  }
}

if ((periods ?? []).length === 0) {
  note('nothing to decide')
} else if (wouldCharge === 0) {
  ok('nothing would be charged', 'every recorded period is inside its allowance or unbillable')
} else {
  note(`${wouldCharge} period(s) would be charged, totalling ${formatCents(wouldChargeCents)}`)
}

// ── 4. The demo line must be unreachable ──────────────────────────────────────
console.log('\n4. The demo line')

const { data: demoPeriods } = await db
  .from('usage_periods')
  .select('id')
  .eq('client_domain', 'demo.369agenticsystems.com')

if (demoPeriods?.length) {
  bad('the demo line has usage_periods rows', 'it belongs to nobody and must never be metered for billing')
} else {
  ok('the demo line has no usage rows, so it cannot be billed')
}

console.log('\n' + '─'.repeat(62))
if (failures === 0) {
  console.log('✓ All checks passed.\n')
} else {
  console.log(`✗ ${failures} check(s) failed.\n`)
  process.exit(1)
}

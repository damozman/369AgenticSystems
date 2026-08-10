/**
 * Usage metering — schema, arithmetic, and a REAL reconciliation against Retell.
 *
 *   node --import ./scripts/test-resolver.mjs scripts/verify-usage.mjs
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-usage.mjs
 *
 * The reconciliation is the point. `calls.duration_seconds` is written by our own webhook from
 * Retell's payload, so every number the meter produces is downstream of a value we copied. If the
 * copy is wrong — a missed webhook, a truncated field, a unit mix-up — nothing inside our own
 * database can tell, because everything agrees with everything else. The only way to know is to
 * ask Retell what it thinks the call lasted, and compare.
 *
 * A meter that disagrees with the thing it is measuring is the failure that matters here, and it
 * is invisible from the inside. Phase B (actual billing) should not be turned on until this runs
 * clean over a full period.
 *
 * Needs SUPABASE creds; RETELL_API_KEY unlocks section 4.
 */

import { createClient } from '@supabase/supabase-js'
import { summarise, callMinutes } from '../lib/usage.ts'
import { billablePeriodFor, displayPeriodFor } from '../lib/billing-period.ts'

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

// ── 1. Schema ─────────────────────────────────────────────────────────────────
console.log('\n1. Schema')

const { error: upErr, count: periodCount } = await db
  .from('usage_periods')
  .select('id, client_domain, period_start, period_end, tier, included_minutes, billed_minutes, overage_minutes, overage_cents, status, stripe_invoice_item_id, alerted_at', { count: 'exact' })
  .limit(1)

if (upErr) bad('usage_periods exists with every column', upErr.message)
else ok('usage_periods exists with every column', `${periodCount ?? 0} period(s) recorded`)

const { error: subErr } = await db.from('agent_subscriptions').select('stripe_subscription_id').limit(1)
if (subErr) bad('agent_subscriptions.stripe_subscription_id exists', subErr.message)
else ok('agent_subscriptions.stripe_subscription_id exists')

// ── 2. Who can and cannot be billed ───────────────────────────────────────────
console.log('\n2. Billability')

const { data: subs, error: subsErr } = await db
  .from('agent_subscriptions')
  .select('client_domain, tier, stripe_subscription_id, created_at')

// Without this the section prints nothing and reads like "no problems" — which is how a failed
// query becomes a green run.
if (subsErr) bad('could not read subscriptions', subsErr.message)
else if (!subs?.length) note('no subscriptions on file')

for (const s of subs ?? []) {
  const period = billablePeriodFor({
    clientDomain: s.client_domain,
    stripeSubscriptionId: s.stripe_subscription_id,
    currentPeriodStart: s.created_at,
  })
  if (period) ok(`${s.client_domain} is billable`, `period from ${period.start.toISOString().slice(0, 10)}`)
  else note(`${s.client_domain} is NOT billable — no Stripe subscription anchor yet (correct until capture has run)`)
}

// The demo line has no agent_subscriptions row at all, so it cannot even appear above. Assert it,
// because "the shared demo number is billing someone" is the expensive version of this bug.
const { data: demoSub } = await db
  .from('agent_subscriptions')
  .select('client_domain')
  .eq('client_domain', 'demo.369agenticsystems.com')
  .maybeSingle()

if (demoSub) bad('the demo line has no subscription', 'it has one — it could be metered')
else ok('the demo line has no subscription, so it can never be billed')

// ── 3. Current-period usage, as the dashboard computes it ─────────────────────
console.log('\n3. Current-period usage')

for (const s of subs ?? []) {
  const period = displayPeriodFor({
    clientDomain: s.client_domain,
    stripeSubscriptionId: s.stripe_subscription_id,
    currentPeriodStart: s.created_at,
  })
  const { data: calls } = await db
    .from('calls')
    .select('duration_seconds')
    .eq('client_domain', s.client_domain)
    .gte('created_at', period.start.toISOString())
    .lt('created_at', period.end.toISOString())

  const u = summarise(s.tier, calls ?? [])
  ok(
    `${s.client_domain}`,
    `${u.billedMinutes}/${u.includedMinutes} min from ${(calls ?? []).length} call(s)` +
    (u.overageMinutes > 0 ? `, ${u.overageMinutes} over` : ''),
  )
}

// ── 4. Reconcile against Retell — the check that cannot be faked from inside ───
console.log('\n4. Reconciliation against Retell')

const retellKey = process.env.RETELL_API_KEY
if (!retellKey) {
  note('RETELL_API_KEY not set — skipping. This is the section that actually matters; re-run with it.')
} else {
  const res = await fetch('https://api.retellai.com/v2/list-calls', {
    method: 'POST',
    headers: { authorization: `Bearer ${retellKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ limit: 200 }),
  })

  if (!res.ok) {
    bad('could not list calls from Retell', `HTTP ${res.status}`)
  } else {
    const retellCalls = await res.json()
    const byId = new Map()
    for (const c of Array.isArray(retellCalls) ? retellCalls : []) {
      // Retell reports milliseconds; our column is seconds. A unit mix-up here is exactly the
      // class of error this section exists to catch, so the conversion is explicit.
      const ms = c.duration_ms ?? ((c.end_timestamp ?? 0) - (c.start_timestamp ?? 0))
      byId.set(c.call_id, Math.round(ms / 1000))
    }

    const { data: ourCalls } = await db
      .from('calls')
      .select('call_id, duration_seconds, client_domain, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    let compared = 0, matched = 0, drifted = 0, missing = 0
    let ourMinutes = 0, theirMinutes = 0

    for (const c of ourCalls ?? []) {
      const theirs = byId.get(c.call_id)
      if (theirs === undefined) { missing++; continue }
      compared++
      ourMinutes   += callMinutes(c.duration_seconds)
      theirMinutes += callMinutes(theirs)

      // One second of slack: Retell rounds its own reporting, and a 1s delta cannot change a
      // billed minute unless it straddles a boundary — which the minute comparison below catches.
      if (Math.abs((c.duration_seconds ?? 0) - theirs) <= 1) matched++
      else {
        drifted++
        if (drifted <= 5) {
          console.log(`     ${c.call_id.slice(0, 20)}… ours=${c.duration_seconds}s retell=${theirs}s  (${c.client_domain})`)
        }
      }
    }

    if (compared === 0) note('no overlapping calls to compare')
    else if (drifted === 0) ok(`all ${matched} comparable call durations agree with Retell`)
    else bad(`${drifted} of ${compared} call durations disagree with Retell`, 'the meter is downstream of a bad copy')

    if (compared > 0) {
      if (ourMinutes === theirMinutes) ok(`billable minutes agree exactly`, `${ourMinutes} min across ${compared} call(s)`)
      else bad(`billable minutes disagree`, `ours ${ourMinutes} vs Retell ${theirMinutes} — a real client would be billed wrong`)
    }

    if (missing > 0) {
      note(`${missing} of our calls are not in Retell's most recent 200 — expected if older than that window`)
    }

    /**
     * Calls we have no duration for, but Retell does.
     *
     * A null `duration_seconds` is not "a call of unknown length" — it is a `call_ended` webhook
     * we missed. The meter counts it as zero minutes, so every one of these silently under-bills,
     * and nothing inside our own database can see it: our sum agrees with our rows, and our rows
     * are simply short of the truth.
     *
     * `--repair` backfills them from Retell, matching the convention
     * verify-booking-notifications.mjs already uses.
     */
    const repairable = (ourCalls ?? []).filter(
      c => (c.duration_seconds === null || c.duration_seconds === undefined) && byId.has(c.call_id),
    )

    if (repairable.length === 0) {
      ok('every call we have has a duration')
    } else if (!process.argv.includes('--repair')) {
      bad(
        `${repairable.length} call(s) have no duration but Retell knows it`,
        `missed call_ended webhooks — these under-bill. Re-run with --repair to backfill`,
      )
      for (const c of repairable.slice(0, 5)) {
        console.log(`     ${c.call_id.slice(0, 22)}…  ours=null  retell=${byId.get(c.call_id)}s  (${c.client_domain})`)
      }
    } else {
      let repaired = 0
      for (const c of repairable) {
        const { error } = await db
          .from('calls')
          .update({ duration_seconds: byId.get(c.call_id) })
          .eq('call_id', c.call_id)
        if (error) bad(`could not repair ${c.call_id}`, error.message)
        else repaired++
      }
      ok(`repaired ${repaired} missing duration(s) from Retell`)
    }
  }
}

// ── 5. Recorded periods ───────────────────────────────────────────────────────
console.log('\n5. Recorded periods (shadow ledger)')

const { data: periods } = await db
  .from('usage_periods')
  .select('client_domain, period_start, period_end, billed_minutes, included_minutes, overage_minutes, overage_cents, status, stripe_invoice_item_id')
  .order('period_start', { ascending: false })
  .limit(10)

if (!periods?.length) {
  note('none yet — the rollup writes a row only once a period has fully closed')
} else {
  for (const p of periods) {
    const money = p.overage_cents > 0 ? `$${(p.overage_cents / 100).toFixed(2)}` : '$0.00'
    console.log(`     ${p.period_start.slice(0, 10)} → ${p.period_end.slice(0, 10)}  ${p.client_domain}  ` +
                `${p.billed_minutes}/${p.included_minutes} min  over ${p.overage_minutes} = ${money}  [${p.status}]`)
  }
  const billed = periods.filter(p => p.stripe_invoice_item_id)
  if (billed.length === 0) ok('nothing has been billed', 'correct for Phase A — every row is a shadow record')
  else bad(`${billed.length} period(s) carry a Stripe invoice item`, 'Phase A must not bill')
}

console.log('\n' + '─'.repeat(62))
if (failures === 0) {
  console.log('✓ All checks passed.\n')
} else {
  console.log(`✗ ${failures} check(s) failed.\n`)
  process.exit(1)
}

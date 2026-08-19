/**
 * A throwaway client for reviewing onboarding UI by hand.
 *
 * Exists because reviewing the questionnaire against a real client's domain overwrites that
 * client. On 2026-08-19 a review submit against Northside created a schedule row and five
 * rental inventory rows on a ROOFING client — which flips /api/available-slots onto the
 * per-item rental path — and rewrote its live Retell prompt. All recoverable, none of it
 * should have been possible from a layout review.
 *
 * The row deliberately has **no retell_agent_id and no Stripe ids**:
 *   - syncQuestionnaireToKB looks up retell_agent_id first and returns early without it, so
 *     submitting cannot reach any Retell agent's prompt.
 *   - No stripe_subscription_id means nothing here is billable or meterable.
 * It costs nothing to create and nothing to run.
 *
 *   node --env-file=.env.local scripts/review-sandbox-client.mjs --create
 *   node --env-file=.env.local scripts/review-sandbox-client.mjs --show
 *   node --env-file=.env.local scripts/review-sandbox-client.mjs --delete
 */

import { createClient } from '@supabase/supabase-js'

const DOMAIN = 'review-sandbox.369agenticsystems.com'
const PROTECTED = ['www.northsideroofing.com', 'northsideroofing.com']

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const mode = process.argv.includes('--create') ? 'create'
  : process.argv.includes('--delete') ? 'delete'
  : process.argv.includes('--show') ? 'show' : null

if (!mode) {
  console.error('Pass --create, --show or --delete.')
  process.exit(1)
}

// Belt and braces: this script must never be pointed at a real client.
if (PROTECTED.includes(DOMAIN.toLowerCase())) {
  console.error('REFUSING: DOMAIN is a protected real client.')
  process.exit(1)
}

async function show() {
  const { data: sub } = await supabase
    .from('agent_subscriptions')
    .select('client_domain, business_name, vertical, tier, retell_agent_id, stripe_subscription_id')
    .eq('client_domain', DOMAIN).maybeSingle()
  const { data: sch } = await supabase
    .from('client_schedules')
    .select('business_hours, slot_duration_minutes, max_concurrent_per_slot, lead_time_hours, booking_horizon_days')
    .eq('client_domain', DOMAIN).maybeSingle()
  const { data: inv } = await supabase
    .from('client_inventory').select('item_key, label, quantity, active').eq('client_domain', DOMAIN)

  if (!sub) { console.log('  sandbox client does not exist'); return }
  console.log(`  client:    ${sub.business_name} (${sub.vertical} · ${sub.tier})`)
  console.log(`  retell:    ${sub.retell_agent_id ?? 'none — the KB sync cannot reach any agent'}`)
  console.log(`  stripe:    ${sub.stripe_subscription_id ?? 'none — not billable'}`)
  if (!sch) console.log('  schedule:  no row yet (submit the form to create one)')
  else {
    const days = Object.entries(sch.business_hours ?? {})
      .filter(([, v]) => v).map(([d, v]) => `${d} ${v.open}-${v.close}`).join(', ')
    console.log(`  schedule:  ${days || '(all closed)'}`)
    console.log(`             slot ${sch.slot_duration_minutes}m | concurrent ${sch.max_concurrent_per_slot} | lead ${sch.lead_time_hours}h | horizon ${sch.booking_horizon_days}d`)
  }
  console.log(`  inventory: ${inv?.length ? inv.map(i => `${i.label} x${i.quantity}${i.active ? '' : ' (inactive)'}`).join(', ') : 'none yet'}`)
}

if (mode === 'create') {
  const { error } = await supabase.from('agent_subscriptions').upsert({
    client_domain: DOMAIN,
    user_email:    'chris@369agenticsystems.com',
    business_name: 'REVIEW SANDBOX — safe to submit',
    vertical: 'roofing', tier: 'Starter',
    active_agents: ['receptionist'], monthly_cost: 400,
  }, { onConflict: 'client_domain' })
  if (error) { console.error('create failed:', error.message); process.exit(1) }
  console.log(`Sandbox ready: ${DOMAIN}\n`)
  await show()
  console.log(`
Review at:
  http://localhost:3001/onboarding/questionnaire/${DOMAIN}

Submit as often as you like. Afterwards:
  node --env-file=.env.local scripts/review-sandbox-client.mjs --show
  node --env-file=.env.local scripts/review-sandbox-client.mjs --delete`)
}

if (mode === 'show') await show()

if (mode === 'delete') {
  // Children first: both tables are FK'd to agent_subscriptions with on delete cascade, but
  // deleting explicitly means the counts below are a real check rather than a hope.
  for (const table of ['client_inventory', 'client_schedules', 'client_questionnaires']) {
    const { error } = await supabase.from(table).delete().eq('client_domain', DOMAIN)
    console.log(`  ${table}: ${error ? 'FAILED ' + error.message : 'deleted'}`)
  }
  const { error } = await supabase.from('agent_subscriptions').delete().eq('client_domain', DOMAIN)
  console.log(`  agent_subscriptions: ${error ? 'FAILED ' + error.message : 'deleted'}`)

  const { data: left } = await supabase.from('agent_subscriptions').select('client_domain')
  console.log(`\n  ${left.length} subscription(s) remain: ${left.map(r => r.client_domain).join(', ')}`)
}

/**
 * End-to-end test of the onboarding questionnaire's new answers: booking horizon, lead time,
 * and rental inventory. BUYS NOTHING — it creates a throwaway agent_subscriptions row directly
 * (no Retell, no Stripe), posts the form the way the browser does, and deletes everything after.
 *
 * What it is really checking, in order of how badly each would hurt:
 *   1. booking_horizon_days actually lands. Before 2026-08-19 the form never asked, so every
 *      client silently kept 14 days and Ava refused anything further out.
 *   2. Removing an item DEACTIVATES rather than deletes it. bookings.inventory_item_key is
 *      plain text, so a delete would leave live bookings pointing at an item nobody can resolve.
 *   3. The form and the spreadsheet importer derive the SAME item_key, or the same castle
 *      lands twice under two keys and one of them is invisible to every existing booking.
 *
 * Requires the dev server on :3001.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-questionnaire-inventory.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { deriveItemKey, loadInventory } from '../lib/inventory.ts'
import { loadSchedule } from '../lib/client-schedule.ts'

const DOMAIN = 'questionnaire-test.369agenticsystems.com'
const URL    = 'http://localhost:3001/api/questionnaire/submit'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let failures = 0
const ok  = (m) => console.log(`  [ok]   ${m}`)
const bad = (m) => { failures++; console.log(`  [FAIL] ${m}`) }
const heading = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`)

async function cleanup() {
  await supabase.from('client_inventory').delete().eq('client_domain', DOMAIN)
  await supabase.from('client_schedules').delete().eq('client_domain', DOMAIN)
  await supabase.from('client_questionnaires').delete().eq('client_domain', DOMAIN)
  await supabase.from('agent_subscriptions').delete().eq('client_domain', DOMAIN)
}

function post(body) {
  return fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_domain: DOMAIN, ...body }),
  })
}

const schedule = {
  timezone: 'America/Chicago',
  business_hours: {
    mon: { open: '09:00', close: '18:00' }, tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' }, thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '20:00' }, sat: { open: '08:00', close: '20:00' },
    sun: { open: '10:00', close: '18:00' },
  },
  slot_duration_minutes: 60,
  max_concurrent_per_slot: 2,
  booking_horizon_days: 180,
  lead_time_hours: 48,
}

await cleanup()

// --- Setup: a throwaway client, created directly. No provisioning, no spend. ----------------
heading('0. Throwaway client')
{
  const { error } = await supabase.from('agent_subscriptions').insert({
    client_domain: DOMAIN,
    user_email:    'chris@369agenticsystems.com',
    business_name: 'QUESTIONNAIRE TEST — DELETE ME',
    vertical: 'roofing', tier: 'Starter', active_agents: ['receptionist'], monthly_cost: 400,
  })
  if (error) { bad(`could not create the test client: ${error.message}`); process.exit(1) }
  ok(`${DOMAIN} created (no Retell agent, no Stripe — this row is the only artifact)`)
}

// --- 1. First submission --------------------------------------------------------------------
heading('1. Submitting the form (rents equipment, 3 items)')
{
  const res = await post({
    respondent_role: 'Owner', pain_point: 'Missed weekend calls', service_types: 'Party rentals',
    schedule,
    inventory: [
      { label: 'Princess Castle bounce house', quantity: 1 },
      { label: 'Blackjack table',              quantity: 2 },
      { label: 'DJ package',                   quantity: 1 },
    ],
  })
  if (!res.ok) { bad(`submit returned ${res.status}: ${JSON.stringify(await res.json())}`); await cleanup(); process.exit(1) }
  ok('submit accepted')
}

// --- 2. The schedule answers that never used to be asked -------------------------------------
heading('2. Schedule, through the real loader')
{
  const s = await loadSchedule(supabase, DOMAIN)
  if (s.booking_horizon_days === 180) ok('booking_horizon_days = 180 (was silently stuck at 14)')
  else bad(`booking_horizon_days is ${s.booking_horizon_days}, expected 180`)

  if (s.lead_time_hours === 48) ok('lead_time_hours = 48')
  else bad(`lead_time_hours is ${s.lead_time_hours}, expected 48`)

  if (s.business_hours?.sat) ok(`Saturday open ${s.business_hours.sat.open}-${s.business_hours.sat.close}`)
  else bad('Saturday is closed — the weekend answer did not survive')
}

// --- 3. Inventory, and the keys ---------------------------------------------------------------
heading('3. Inventory, through the real loader')
{
  const { items } = await loadInventory(supabase, DOMAIN)
  if (items.length === 3) ok(`3 active item(s): ${items.map(i => i.label).join(', ')}`)
  else bad(`expected 3 active items, got ${items.length}`)

  // The form and the importer must agree, or the same item lands twice under two keys.
  const expected = deriveItemKey('Princess Castle bounce house')
  if (items.some(i => i.item_key === expected)) ok(`item_key matches deriveItemKey(): ${expected}`)
  else bad(`no item keyed ${expected} — the route and the importer disagree`)

  const bj = items.find(i => i.item_key === 'blackjack_table')
  if (bj?.quantity === 2) ok('quantity preserved (Blackjack table x2)')
  else bad(`Blackjack quantity is ${bj?.quantity}, expected 2`)
}

// --- 4. Re-submitting without an item must DEACTIVATE it, never delete it ----------------------
heading('4. Removing an item')
{
  const res = await post({
    respondent_role: 'Owner', schedule,
    inventory: [
      { label: 'Princess Castle bounce house', quantity: 1 },
      { label: 'Blackjack table',              quantity: 2 },
    ],
  })
  if (!res.ok) bad(`re-submit returned ${res.status}`)

  const { items } = await loadInventory(supabase, DOMAIN)
  if (items.length === 2) ok('loader now returns 2 active item(s) — the DJ package is gone from what Ava offers')
  else bad(`expected 2 active items, got ${items.length}`)

  // The row must still exist, or any booking that referenced it becomes unresolvable.
  const { data: all } = await supabase.from('client_inventory').select('item_key, active').eq('client_domain', DOMAIN)
  const dj = all?.find(r => r.item_key === 'dj_package')
  if (!dj) bad('the DJ package row was DELETED — a booking referencing it would now be unresolvable')
  else if (dj.active === false) ok('the DJ package row still exists with active=false (history intact)')
  else bad('the DJ package is still active after being removed')
}

// --- 5. An absent inventory key must not touch existing stock ----------------------------------
heading('5. Submitting with no inventory answer at all')
{
  const res = await post({ respondent_role: 'Owner', schedule })
  if (!res.ok) bad(`submit returned ${res.status}`)
  const { items } = await loadInventory(supabase, DOMAIN)
  if (items.length === 2) ok('existing stock untouched when the question is not answered')
  else bad(`stock changed to ${items.length} item(s) when inventory was absent — it must be left alone`)
}

await cleanup()
ok('test client and all its rows deleted')

heading('Verdict')
console.log(failures ? `  ${failures} FAILURE(S)` : '  All checks passed. Nothing was purchased.')
process.exit(failures ? 1 : 0)

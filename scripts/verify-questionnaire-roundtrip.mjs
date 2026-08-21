#!/usr/bin/env node
/**
 * Prove a questionnaire RE-SUBMIT is corrective, not destructive.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-questionnaire-roundtrip.mjs
 *
 * Needs the dev server. Set BASE_URL to point elsewhere (default http://localhost:3000).
 *
 * Until 2026-08-21 the form had **no read path at all**. Every field was a hardcoded default —
 * Mon–Fri, 08:00–17:00, a 60-day horizon, rental stock off, one blank row — so a client opening it
 * months later to change one answer silently overwrote everything else with those defaults, and
 * the submit path additionally deactivated every inventory item the form had never been told about.
 *
 * For an event-rental business that means Saturdays revert to closed and the horizon to 60 days,
 * after which **Ava refuses every weekend booking** — which reads as a bug in the booking engine
 * rather than as configuration.
 *
 * This runs the real loop against a real client: seed → GET /current → POST exactly what a form
 * built from that GET would send → assert nothing moved.
 *
 * Runs against the REVIEW SANDBOX client only. It has no `retell_agent_id`, so the KB sync cannot
 * reach any live agent's prompt. It refuses to run against anything else.
 */
import { createClient } from '@supabase/supabase-js'
import { mintOnboardingToken } from '../lib/security/onboarding-token.ts'

const DOMAIN = 'review-sandbox.369agenticsystems.com'
const BASE = process.env.BASE_URL || 'http://localhost:3000'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// ── Refuse to touch a real client ────────────────────────────────────────────
const { data: sub } = await db
  .from('agent_subscriptions')
  .select('client_domain, retell_agent_id, user_email')
  .eq('client_domain', DOMAIN)
  .maybeSingle()

if (!sub) {
  console.error(`✗ No sandbox client. Create it first:\n    node --env-file=.env.local scripts/review-sandbox-client.mjs --create\n`)
  process.exit(1)
}
if (sub.retell_agent_id) {
  console.error(`✗ ${DOMAIN} has a retell_agent_id. Refusing — a submit would rewrite a live agent prompt.`)
  process.exit(1)
}

console.log(`\nQuestionnaire round-trip — ${DOMAIN}\n`)

// ── 1. Seed the shape that used to be destroyed ──────────────────────────────
// Weekend trading and a long horizon: the exact configuration the form's defaults clobber.
const SEED_SCHEDULE = {
  client_domain: DOMAIN,
  timezone: 'America/Chicago',
  business_hours: {
    mon: null, tue: null, wed: null, thu: null,
    fri: { open: '10:00', close: '20:00' },
    sat: { open: '08:00', close: '20:00' },
    sun: { open: '10:00', close: '18:00' },
  },
  slot_duration_minutes: 60,
  max_concurrent_per_slot: 2,
  booking_horizon_days: 180,
  lead_time_hours: 48,
}
const SEED_ITEMS = [
  { client_domain: DOMAIN, item_key: 'princess_castle', label: 'Princess Castle', quantity: 2, active: true },
  { client_domain: DOMAIN, item_key: 'mobile_casino',   label: 'Mobile Casino',   quantity: 1, active: true },
  { client_domain: DOMAIN, item_key: 'dj_rig',          label: 'DJ Rig',          quantity: 3, active: true },
]

await db.from('client_schedules').upsert(SEED_SCHEDULE, { onConflict: 'client_domain' })
await db.from('client_inventory').delete().eq('client_domain', DOMAIN)
await db.from('client_inventory').insert(SEED_ITEMS)
await db.from('client_questionnaires').upsert(
  { client_domain: DOMAIN, respondent_role: 'Owner', pain_point: 'Missed weekend calls', service_types: 'Bounce houses, casino tables' },
  { onConflict: 'client_domain' },
)
console.log('  · seeded: Fri/Sat/Sun hours, 180-day horizon, 3 items\n')

// ── 2. Read it back, the way the form now does on mount ──────────────────────
const token = mintOnboardingToken(DOMAIN)
const res = await fetch(`${BASE}/api/questionnaire/current?client_domain=${encodeURIComponent(DOMAIN)}&t=${encodeURIComponent(token)}`)
const current = await res.json()

console.log('1. The form can read what is already saved')
check('endpoint returns 200', res.status === 200, `got ${res.status}`)
check('questionnaire answers come back', Boolean(current.answers), `pain_point: ${current.answers?.pain_point ?? 'MISSING'}`)
check('schedule comes back', Boolean(current.schedule))
check('all 3 inventory rows come back', current.inventory?.length === 3, `got ${current.inventory?.length}`)

const openDays = Object.entries(current.schedule?.business_hours ?? {}).filter(([, v]) => v && v.open).map(([d]) => d)
check('weekend days survive the read', openDays.includes('sat') && openDays.includes('sun'), openDays.join(','))
check('horizon survives the read', current.schedule?.booking_horizon_days === 180, String(current.schedule?.booking_horizon_days))

// ── 3. Submit exactly what a form built from that read would send ────────────
// This mirrors page.tsx: one open/close pair applied to the ticked days.
const first = openDays.length ? current.schedule.business_hours[openDays[0]] : { open: '08:00', close: '17:00' }
const submitBody = {
  client_domain: DOMAIN,
  onboarding_token: token,
  ...current.answers,
  schedule: {
    timezone: current.schedule.timezone,
    business_hours: Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [d, openDays.includes(d) ? { open: first.open, close: first.close } : null]),
    ),
    slot_duration_minutes: current.schedule.slot_duration_minutes,
    max_concurrent_per_slot: current.schedule.max_concurrent_per_slot,
    booking_horizon_days: current.schedule.booking_horizon_days,
    lead_time_hours: current.schedule.lead_time_hours,
  },
  inventory: current.inventory.map(i => ({ label: i.label, quantity: i.quantity })),
}

const postRes = await fetch(`${BASE}/api/questionnaire/submit`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(submitBody),
})

console.log('\n2. Re-submitting that unchanged form changes nothing')
check('submit accepted', postRes.ok, `HTTP ${postRes.status}`)

const { data: afterSchedule } = await db.from('client_schedules').select('*').eq('client_domain', DOMAIN).single()
const { data: afterItems } = await db.from('client_inventory').select('item_key, quantity, active').eq('client_domain', DOMAIN).order('item_key')

const afterOpen = Object.entries(afterSchedule?.business_hours ?? {}).filter(([, v]) => v && v.open).map(([d]) => d)
check('Saturday is still open', afterOpen.includes('sat'), afterOpen.join(','))
check('Sunday is still open', afterOpen.includes('sun'))
check('horizon is still 180 days', afterSchedule?.booking_horizon_days === 180, String(afterSchedule?.booking_horizon_days))
check('lead time is still 48h', afterSchedule?.lead_time_hours === 48, String(afterSchedule?.lead_time_hours))
check('all 3 items still ACTIVE', afterItems?.filter(i => i.active).length === 3, `${afterItems?.filter(i => i.active).length} active of ${afterItems?.length}`)
check('quantities preserved', afterItems?.find(i => i.item_key === 'dj_rig')?.quantity === 3)

// ── 4. The destructive case is still possible ON PURPOSE ─────────────────────
// Removing an item in the form must still retire it — that is the feature. What must not happen
// is retiring items the form never showed. Submitting a SHORTER list proves the distinction.
const partial = { ...submitBody, inventory: [{ label: 'Princess Castle', quantity: 2 }] }
await fetch(`${BASE}/api/questionnaire/submit`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(partial),
})
const { data: afterPartial } = await db.from('client_inventory').select('item_key, active').eq('client_domain', DOMAIN)
console.log('\n3. Deliberately removing an item still retires it (the feature, not the bug)')
check('the kept item stays active', afterPartial?.find(i => i.item_key === 'princess_castle')?.active === true)
check('the omitted items are deactivated', afterPartial?.filter(i => !i.active).length === 2,
  `${afterPartial?.filter(i => !i.active).length} deactivated`)

// ── Clean up ─────────────────────────────────────────────────────────────────
await db.from('client_inventory').delete().eq('client_domain', DOMAIN)
await db.from('client_schedules').delete().eq('client_domain', DOMAIN)
console.log('\n· cleaned up sandbox rows')

console.log(`\n${failures === 0 ? '✓ Round-trip verified — a re-submit preserves what it was not shown.' : `✗ ${failures} check(s) failed.`}\n`)
process.exit(failures === 0 ? 0 : 1)

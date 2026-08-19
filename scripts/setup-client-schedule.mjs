/**
 * Writes a client's real working hours, and PROVES the effect through the consumer's view.
 *
 * Why this exists: a client with no `client_schedules` row silently inherits DEFAULT_SCHEDULE —
 * **Saturday and Sunday closed, 14-day booking horizon**. For a weekday trade that is fine. For
 * a party-rental or event business it is catastrophic and invisible: Ava refuses every Saturday
 * and anything past a fortnight, and it reads as a broken booking engine rather than as config.
 *
 * The row is FK'd to agent_subscriptions(client_domain), so the client must be onboarded first.
 *
 * It does not stop at "row written". It runs the REAL generateSlots against the schedule the
 * REAL loader returns, before and after, and shows what Ava would actually offer on the next
 * Saturday and at the far end of the horizon. Writing a row is not evidence; offering the slot is.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/setup-client-schedule.mjs <domain>
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/setup-client-schedule.mjs <domain> --apply
 *
 * Edit PROFILES below to add a shape. Keep them named after the business type, not the client.
 */

import { createClient } from '@supabase/supabase-js'
import { loadSchedule } from '../lib/client-schedule.ts'
import { generateSlots, formatSlot, civilDateInZone } from '../lib/availability.ts'

// ---------------------------------------------------------------------------------------
// Profiles. `entertainment` is the shape for mobile casino / DJ / bounce houses: the business
// happens at weekends and is booked months ahead, which is the exact inverse of the defaults.
// ---------------------------------------------------------------------------------------
const PROFILES = {
  entertainment: {
    timezone: 'America/Chicago',
    business_hours: {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '20:00' },
      // The whole point. Long weekend days — parties run all day and into the evening.
      sat: { open: '08:00', close: '20:00' },
      sun: { open: '10:00', close: '18:00' },
    },
    slot_duration_minutes: 60,
    // How many jobs can run at once — crews/rigs, NOT which unit. Which unit is client_inventory.
    max_concurrent_per_slot: 2,
    // A party booked tomorrow is a nuisance; the default 12h is far too tight for a delivery
    // business that has to load a truck.
    lead_time_hours: 48,
    // Events are booked months out. The DB check constraint caps this at 365.
    booking_horizon_days: 180,
  },
}

const domain  = process.argv[2]
const profile = PROFILES[process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : 'entertainment']
const APPLY   = process.argv.includes('--apply')

// The onboarding questionnaire (Section 4) already collects timezone, business_hours,
// slot_duration_minutes and max_concurrent_per_slot, and UPSERTS them. It does NOT collect
// booking_horizon_days or lead_time_hours — those two silently keep the DB defaults of 14
// days and 12 hours, which is exactly what breaks an events business that books months out.
//
// So writing the whole profile AFTER a client has filled the questionnaire would overwrite
// the real hours they typed with this profile's guesses. --gaps-only writes just the two
// columns the questionnaire cannot reach and leaves everything they told us alone.
const GAPS_ONLY = process.argv.includes('--gaps-only')
const QUESTIONNAIRE_OWNS = ['timezone', 'business_hours', 'slot_duration_minutes', 'max_concurrent_per_slot']
const GAP_FIELDS = ['booking_horizon_days', 'lead_time_hours']

if (!domain || domain.startsWith('--')) {
  console.error('Usage: ... scripts/setup-client-schedule.mjs <client_domain> [--profile entertainment] [--apply]')
  console.error('Profiles: ' + Object.keys(PROFILES).join(', '))
  process.exit(1)
}
if (!profile) { console.error('Unknown profile.'); process.exit(1) }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let failures = 0
const ok  = (m) => console.log(`  [ok]   ${m}`)
const bad = (m) => { failures++; console.log(`  [FAIL] ${m}`) }
const warn = (m) => console.log(`  [warn] ${m}`)
const heading = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`)

// --- The client must exist first ---------------------------------------------------------
heading(`1. Client`)
const { data: sub, error: subErr } = await supabase
  .from('agent_subscriptions')
  .select('client_domain, business_name, tier, vertical')
  .eq('client_domain', domain)
  .maybeSingle()

if (subErr) { console.error(subErr.message); process.exit(1) }
if (!sub) {
  bad(`no agent_subscriptions row for ${domain}`)
  console.log(`
  client_schedules.client_domain is a FOREIGN KEY to agent_subscriptions(client_domain), so
  this write cannot succeed until the client is onboarded. Onboard through a real Stripe
  checkout first — that is what produces the stripe_subscription_id billing anchor, which
  cannot be backfilled later.`)
  process.exit(1)
}
ok(`${sub.business_name} (${sub.tier} · ${sub.vertical})`)

// --- What they get today ------------------------------------------------------------------
heading('2. Effective schedule TODAY (what Ava is using right now)')
const before = await loadSchedule(supabase, domain)
const { data: existingRow } = await supabase.from('client_schedules').select('client_domain').eq('client_domain', domain).maybeSingle()
console.log(existingRow ? '  source: their own client_schedules row' : '  source: DEFAULT_SCHEDULE — they have NO row of their own')
printSchedule(before)

// --- What they would get ------------------------------------------------------------------
heading('3. Proposed')
printSchedule(profile)

// --- Prove it through the consumer, not the row -------------------------------------------
heading('4. What Ava would actually OFFER (real generateSlots)')
const now = new Date()
compareDay('next Saturday', nextWeekday(now, 6))
compareDay(`day ${profile.booking_horizon_days - 5} out`, addDays(now, profile.booking_horizon_days - 5))

function compareDay(label, target) {
  const b = slotsOn(before, target)
  const a = slotsOn(profile, target)
  const verdict = b.length === 0 && a.length > 0 ? '  <-- was refused, now offered' : ''
  console.log(`  ${label} (${target.toDateString()}):`)
  console.log(`     before: ${b.length} slot(s)${b.length ? '  e.g. ' + formatSlot(b[0], before.timezone) : ''}`)
  console.log(`     after:  ${a.length} slot(s)${a.length ? '  e.g. ' + formatSlot(a[0], profile.timezone) : ''}${verdict}`)
}

function slotsOn(schedule, target) {
  // generateSlots walks forward from `now` across the horizon; filter to the target day in the
  // client's own timezone, which is the only calendar that matters here.
  const want = civilDateInZone(target, schedule.timezone)
  return generateSlots(schedule, now).filter(s => {
    const d = civilDateInZone(s.startsAt, schedule.timezone)
    return d.year === want.year && d.month === want.month && d.day === want.day
  })
}

function nextWeekday(from, dow) {
  const d = new Date(from)
  do { d.setDate(d.getDate() + 1) } while (d.getDay() !== dow)
  return d
}
function addDays(from, n) { const d = new Date(from); d.setDate(d.getDate() + n); return d }

function printSchedule(s) {
  for (const day of ['mon','tue','wed','thu','fri','sat','sun']) {
    const h = s.business_hours?.[day]
    const flag = (day === 'sat' || day === 'sun') && !h ? '   <-- CLOSED' : ''
    console.log(`     ${day}: ${h ? `${h.open}-${h.close}` : 'closed'}${flag}`)
  }
  console.log(`     tz ${s.timezone} | slot ${s.slot_duration_minutes}m | concurrent ${s.max_concurrent_per_slot} | lead ${s.lead_time_hours}h | horizon ${s.booking_horizon_days}d`)
}

// --- Write --------------------------------------------------------------------------------
heading('5. Write')
if (!APPLY) {
  console.log('  DRY RUN — nothing written. Re-run with --apply.')
  process.exit(failures ? 1 : 0)
}

const payload = GAPS_ONLY
  ? Object.fromEntries(GAP_FIELDS.map(k => [k, profile[k]]))
  : profile

if (GAPS_ONLY) {
  console.log('  --gaps-only: writing ONLY ' + GAP_FIELDS.join(', '))
  console.log('  leaving the questionnaire\'s fields untouched: ' + QUESTIONNAIRE_OWNS.join(', '))
} else if (existingRow) {
  console.log('  WARNING: this client already has a row. If they filled the questionnaire,')
  console.log('  their real hours are about to be replaced by this profile. Use --gaps-only.')
}

const { error: upErr } = await supabase
  .from('client_schedules')
  .upsert({ client_domain: domain, ...payload }, { onConflict: 'client_domain' })

if (upErr) { bad(`write failed: ${upErr.message}`); process.exit(1) }
ok('client_schedules row written')

// Re-read through the REAL loader. A write that the loader does not return is not a change.
const after = await loadSchedule(supabase, domain)
const checked = GAPS_ONLY ? GAP_FIELDS : ['timezone','slot_duration_minutes','max_concurrent_per_slot', ...GAP_FIELDS]
const mismatches = checked.filter(k => after[k] !== profile[k])
if (mismatches.length) bad(`loader disagrees on: ${mismatches.join(', ')}`)
else ok('loader returns the new values for ' + checked.join(', '))

// Whichever mode, say out loud what the loader now reports for the weekend — that is the
// setting most likely to be silently wrong, and the one nobody notices until a Saturday.
for (const day of ['sat','sun']) {
  const h = after.business_hours?.[day]
  const state = h ? h.open + '-' + h.close : 'CLOSED'
  if (h) ok(day + ' per the loader: ' + state)
  else if (GAPS_ONLY) warn(day + ' per the loader: CLOSED — if they take weekend work, they have not said so in the questionnaire')
  else bad(day + ' still closed per the loader')
}

heading('Verdict')
console.log(failures ? `  ${failures} FAILURE(S)` : '  Schedule applied and verified through the loader.')
process.exit(failures ? 1 : 0)

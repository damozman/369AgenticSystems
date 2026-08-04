/**
 * Probes the live database for everything 2026-08-04-booking-availability.sql was supposed to
 * create, then exercises the double-booking guard for real.
 *
 * Run after applying the migration in the Supabase SQL editor:
 *
 *   node scripts/probe-booking-availability.mjs
 *
 * Exists because schema.sql is not production. On 2026-07-12 three tables were found drifted
 * from what the code assumed. A migration that "ran fine" is not evidence; asking the live
 * database is.
 *
 * The book_slot check writes two test bookings far in the future under a probe-only client
 * domain and deletes them again. It does not touch any real client's data, and it is the only
 * way to prove the capacity guard actually holds — the whole point of the migration.
 *
 * Reads credentials from .env.local via Next's own loader. Prints structure only.
 */

import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)
const PROBE_DOMAIN = 'probe.booking-availability.invalid'

let failures = 0
const ok   = m => console.log(`   ✅ ${m}`)
const bad  = m => { console.log(`   ❌ ${m}`); failures++ }

// ── 1. client_schedules ───────────────────────────────────────────────────────
console.log('\nclient_schedules')
const SCHEDULE_COLUMNS = [
  'client_domain', 'timezone', 'business_hours', 'slot_duration_minutes',
  'max_concurrent_per_slot', 'lead_time_hours', 'booking_horizon_days',
]
{
  const { error } = await supabase.from('client_schedules').select(SCHEDULE_COLUMNS.join(', ')).limit(1)
  if (error) bad(`table/columns unavailable — ${error.message}`)
  else ok(`table exists with all ${SCHEDULE_COLUMNS.length} expected columns`)
}

// ── 2. bookings.starts_at / ends_at ───────────────────────────────────────────
console.log('\nbookings')
for (const column of ['starts_at', 'ends_at']) {
  const { error } = await supabase.from('bookings').select(column).limit(1)
  if (error) bad(`${column} missing — ${error.message}`)
  else ok(`${column} present`)
}

// ── 3. book_slot(): does the capacity guard actually hold? ────────────────────
console.log('\nbook_slot()')
// Well clear of any real appointment, and in a year nobody is booking into.
const startsAt = new Date('2099-01-05T15:00:00Z')
const endsAt   = new Date('2099-01-05T16:00:00Z')

const call = (start, end) => supabase.rpc('book_slot', {
  p_client_domain:    PROBE_DOMAIN,
  p_starts_at:        start.toISOString(),
  p_ends_at:          end.toISOString(),
  p_call_id:          null,
  p_lead_id:          null,
  p_appointment_date: '2099-01-05',
  p_appointment_time: '9:00 AM',
  p_service_type:     'probe',
  p_location:         null,
})

const first = await call(startsAt, endsAt)
if (first.error) {
  bad(`function missing or failed — ${first.error.message}`)
} else if (!first.data || first.data.length === 0) {
  bad('first booking returned no row (expected the inserted booking)')
} else {
  ok('first booking accepted')

  // Same slot again. With no client_schedules row, capacity falls back to 1, so this must be
  // refused — this is the exact double-booking the old synthetic route allowed.
  const second = await call(startsAt, endsAt)
  if (second.error)                                   bad(`second booking errored instead of being refused — ${second.error.message}`)
  else if (second.data && second.data.length > 0)     bad('DOUBLE BOOKED — the capacity guard is not holding')
  else                                                ok('duplicate booking refused (zero rows, as designed)')

  // Overlapping but not identical — the case equality-matching would miss.
  const overlap = await call(new Date('2099-01-05T15:30:00Z'), new Date('2099-01-05T16:30:00Z'))
  if (overlap.error)                                  bad(`overlap check errored — ${overlap.error.message}`)
  else if (overlap.data && overlap.data.length > 0)   bad('OVERLAP ACCEPTED — a job starting mid-appointment was allowed')
  else                                                ok('overlapping booking refused')

  // A slot starting exactly when the first ends must still be bookable.
  const adjacent = await call(new Date('2099-01-05T16:00:00Z'), new Date('2099-01-05T17:00:00Z'))
  if (adjacent.error)                                 bad(`back-to-back check errored — ${adjacent.error.message}`)
  else if (!adjacent.data || adjacent.data.length === 0) bad('back-to-back booking refused — a full day would read as half a day')
  else                                                ok('back-to-back booking accepted')
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
const { error: cleanupError, count } = await supabase
  .from('bookings')
  .delete({ count: 'exact' })
  .eq('client_domain', PROBE_DOMAIN)

console.log('\ncleanup')
if (cleanupError) bad(`could not remove probe rows — DELETE FROM bookings WHERE client_domain = '${PROBE_DOMAIN}'`)
else ok(`removed ${count ?? 0} probe booking(s)`)

console.log(`\n${failures === 0 ? '✅ All checks passed.' : `❌ ${failures} check(s) failed.`}\n`)
process.exit(failures === 0 ? 0 : 1)

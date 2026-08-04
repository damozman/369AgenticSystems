/**
 * Verifies that an agent can still book an appointment mid-call.
 *
 *   node scripts/verify-booking.mjs
 *
 * Exists because INTERNAL_API_SECRET was rotated on 2026-08-04, and /api/book-appointment
 * is guarded by it and invoked by the Retell agent as a custom tool. If the agent's tool
 * config carries the old value, booking now fails with a 401 that nobody sees: the caller
 * hears the agent say it booked, and no row is ever written. That is the same shape as the
 * funnel outage — a working-looking flow with nothing behind it.
 *
 * Run it AFTER placing a real call to the demo line and asking the agent to book.
 *
 * Checks the chain rather than one table, because each link fails differently:
 *   calls      → the call reached the webhook at all
 *   bookings   → /api/book-appointment accepted the tool call (the secret matched)
 *   call_outcome='booked' → the booking was stamped back onto the call
 */

import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const WINDOW_HOURS = Number(process.argv[2] ?? 3)
const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString()

console.log(`\nLooking back ${WINDOW_HOURS}h.\n`)

const { data: calls, error: callErr } = await db
  .from('calls')
  .select('id, call_id, client_domain, call_outcome, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: false })

if (callErr) {
  console.error(`✗ Cannot read calls: ${callErr.message}`)
  process.exit(1)
}

if (!calls.length) {
  console.error('✗ No calls at all in that window.')
  console.error('  The agent never reached /api/call-received, so nothing downstream ran.')
  console.error('  Place a real call to the demo line first, then re-run.')
  console.error(`  (Widen the window if the call was older: node scripts/verify-booking.mjs 12)`)
  process.exit(1)
}

console.log(`calls: ${calls.length}`)
for (const c of calls) {
  console.log(`  ${c.created_at}  ${c.client_domain}  outcome=${c.call_outcome}`)
}

const { data: bookings, error: bookErr } = await db
  .from('bookings')
  .select('id, call_id, client_domain, appointment_date, appointment_time, service_type, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: false })

if (bookErr) {
  console.error(`\n✗ Cannot read bookings: ${bookErr.message}`)
  process.exit(1)
}

console.log(`\nbookings: ${bookings.length}`)
for (const b of bookings) {
  console.log(`  ${b.appointment_date} @ ${b.appointment_time}  ${b.client_domain}  ${b.service_type ?? ''}`)
}

// ── Verdict ───────────────────────────────────────────────────────────────────
const booked = calls.filter(c => c.call_outcome === 'booked')

if (bookings.length) {
  console.log('\n✓ Booking written — /api/book-appointment accepted the agent\'s tool call.')
  console.log('  The INTERNAL_API_SECRET rotation did NOT break booking.')
  if (!booked.length) {
    console.log('\n⚠ But no call is stamped call_outcome=\'booked\'. The insert succeeded and')
    console.log('  the follow-up stamp did not — check whether call_id resolved to a row.')
  }
  process.exit(0)
}

console.error('\n✗ No booking row was written.')
console.error('  If you asked the agent to book during one of the calls above, this is the')
console.error('  failure the rotation could have caused: /api/book-appointment is guarded by')
console.error('  INTERNAL_API_SECRET, and the Retell tool config may still send the old value.')
console.error('\n  Confirm in Vercel logs — a 401 on /api/book-appointment proves it. Then')
console.error('  update the secret in the Retell agent\'s custom-tool headers to match.')
console.error('\n  If you did NOT ask it to book, this result means nothing. Call again and ask.')
process.exit(1)

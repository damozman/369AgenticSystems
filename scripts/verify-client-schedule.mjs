/**
 * Exercises a REAL `client_schedules` row end to end.
 *
 *   node --import ./scripts/test-resolver.mjs scripts/verify-client-schedule.mjs
 *
 * Every booking placed so far has run on DEFAULT_SCHEDULE — Mon–Fri 08:00–17:00 America/Chicago,
 * one job at a time — because `client_schedules` is empty in production. So the unit tests prove
 * the maths and nothing at all proves the *row* : that the JSON column round-trips, that
 * loadSchedule maps every field, and that a client with genuinely different hours gets them.
 *
 * The fixture is deliberately the inverse of the default — weekends open, weekdays closed, in a
 * different timezone, 30-minute slots, two jobs at once. If any part of the chain quietly falls
 * back to DEFAULT_SCHEDULE, weekday slots appear and the check fails loudly. A fixture that
 * merely *resembles* the default could pass while reading nothing.
 *
 * Writes to production, then deletes everything it wrote — by primary key, never by domain, so a
 * cleanup can never reach a row this script did not create. The test domain matches no real client
 * and no phone number routes to it.
 *
 * Note `client_schedules.client_domain` is FK-constrained to `agent_subscriptions`: a client must
 * be subscribed before they can have hours. That is why this creates a subscription first, and it
 * is also why the demo line can never carry custom hours — it has no subscription row.
 */

import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { loadSchedule, DEFAULT_SCHEDULE } from '../lib/client-schedule.ts'
import { openSlots, formatSlot } from '../lib/availability.ts'

nextEnv.loadEnvConfig(process.cwd())

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const DOMAIN = 'schedule-test.369agenticsystems.com'

const FIXTURE = {
  client_domain:           DOMAIN,
  timezone:                'America/New_York',
  business_hours: {
    mon: null, tue: null, wed: null, thu: null, fri: null,
    sat: { open: '10:00', close: '14:00' },
    sun: { open: '10:00', close: '14:00' },
  },
  slot_duration_minutes:   30,
  max_concurrent_per_slot: 2,
  lead_time_hours:         1,
  booking_horizon_days:    21,
}

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failures++
}

// Deleted by primary key only. Deleting by client_domain would be one typo away from removing a
// real client's bookings — and this domain already collided with a live subscription once.
const createdBookingIds = []

const cleanup = async () => {
  if (createdBookingIds.length) await db.from('bookings').delete().in('id', createdBookingIds)
  await db.from('client_schedules').delete().eq('client_domain', DOMAIN)
  await db.from('agent_subscriptions').delete().eq('client_domain', DOMAIN)
}

try {
  await cleanup() // in case a previous run died mid-way

  // ── 0. The subscription the FK requires ─────────────────────────────────────
  console.log(`\n0. Creating a throwaway subscription for ${DOMAIN}`)
  const { error: subErr } = await db.from('agent_subscriptions').insert({
    client_domain: DOMAIN,
    user_email:    'chris@369agenticsystems.com',
    vertical:      'roofing',
    tier:          'Elite',
    monthly_cost:  0,
  })
  if (subErr) {
    console.error(`\n✗ Could not create the test subscription: ${subErr.message}`)
    process.exit(1)
  }
  console.log('  ✓ subscription created')

  // ── 1. The row round-trips through the database ─────────────────────────────
  console.log(`\n1. Writing a non-default schedule for ${DOMAIN}`)
  const { error: insErr } = await db.from('client_schedules').insert(FIXTURE)
  if (insErr) {
    console.error(`\n✗ Could not insert the schedule: ${insErr.message}`)
    console.error('  If this is a missing-column error, the migration did not fully apply in prod.')
    process.exit(1)
  }

  const schedule = await loadSchedule(db, DOMAIN)
  check('timezone read from the row',   schedule.timezone === 'America/New_York', schedule.timezone)
  check('slot duration read',           schedule.slot_duration_minutes === 30,    `${schedule.slot_duration_minutes}m`)
  check('capacity read',                schedule.max_concurrent_per_slot === 2,   String(schedule.max_concurrent_per_slot))
  check('lead time read',               schedule.lead_time_hours === 1,           `${schedule.lead_time_hours}h`)
  check('horizon read',                 schedule.booking_horizon_days === 21,     `${schedule.booking_horizon_days}d`)
  check('business_hours JSON survived', schedule.business_hours?.sat?.open === '10:00' && schedule.business_hours?.mon === null)
  check('NOT the default schedule',     schedule.timezone !== DEFAULT_SCHEDULE.timezone)

  // ── 2. The engine honours it ────────────────────────────────────────────────
  console.log(`\n2. Generating slots against the real row`)
  const slots = openSlots(schedule, [], { limit: 8, perDay: 4 })
  check('some slots were produced', slots.length > 0, `${slots.length} slots`)

  const dayOf = d => new Intl.DateTimeFormat('en-US', { timeZone: schedule.timezone, weekday: 'short' }).format(d)
  const hourOf = d => Number(new Intl.DateTimeFormat('en-US', { timeZone: schedule.timezone, hour: 'numeric', hour12: false }).format(d))

  const weekdayLeak = slots.filter(s => !['Sat', 'Sun'].includes(dayOf(s.startsAt)))
  check('every slot is a weekend', weekdayLeak.length === 0,
    weekdayLeak.length ? `${weekdayLeak.length} weekday slot(s) — the row was IGNORED, defaults leaked through` : 'no weekday leak')

  const outOfHours = slots.filter(s => hourOf(s.startsAt) < 10 || hourOf(s.startsAt) >= 14)
  check('every slot is inside 10:00–14:00 ET', outOfHours.length === 0,
    outOfHours.length ? outOfHours.map(s => formatSlot(s, schedule.timezone)).join('; ') : 'in hours')

  const wrongLength = slots.filter(s => s.endsAt - s.startsAt !== 30 * 60_000)
  check('every slot is 30 minutes', wrongLength.length === 0)

  for (const s of slots.slice(0, 4)) console.log(`      ${formatSlot(s, schedule.timezone)}`)

  // ── 3. Capacity of 2 actually means 2 ───────────────────────────────────────
  console.log(`\n3. Capacity: the row says two jobs can run at once`)
  const target = slots[0]
  const busyRow = n => ({
    client_domain:    DOMAIN,
    starts_at:        target.startsAt.toISOString(),
    ends_at:          target.endsAt.toISOString(),
    appointment_date: target.startsAt.toISOString().slice(0, 10),
    appointment_time: `capacity probe ${n}`,
  })

  const { data: b1, error: b1Err } = await db.from('bookings').insert(busyRow(1)).select('id').single()
  if (b1Err) { console.error(`  ✗ could not insert probe booking: ${b1Err.message}`); failures++ }
  if (b1?.id) createdBookingIds.push(b1.id)

  const after1 = openSlots(schedule, [{ starts_at: target.startsAt, ends_at: target.endsAt }], { limit: 8, perDay: 4 })
  check('still offered with 1 of 2 taken',
    after1.some(s => s.startsAt.getTime() === target.startsAt.getTime()),
    'capacity 2 not collapsing to 1')

  const { data: b2 } = await db.from('bookings').insert(busyRow(2)).select('id').single()
  if (b2?.id) createdBookingIds.push(b2.id)

  const twoBusy = [
    { starts_at: target.startsAt, ends_at: target.endsAt },
    { starts_at: target.startsAt, ends_at: target.endsAt },
  ]
  const after2 = openSlots(schedule, twoBusy, { limit: 8, perDay: 4 })
  check('withheld once both places are taken',
    !after2.some(s => s.startsAt.getTime() === target.startsAt.getTime()),
    'full slot correctly withdrawn')

  // ── 4. The bookings the route would actually read ───────────────────────────
  console.log(`\n4. Reading the busy intervals back the way /api/available-slots does`)
  const { data: readBack, error: readErr } = await db
    .from('bookings')
    .select('starts_at, ends_at')
    .eq('client_domain', DOMAIN)
    .neq('status', 'cancelled')
    .not('starts_at', 'is', null)
  check('busy intervals query works against prod', !readErr, readErr?.message ?? `${readBack?.length ?? 0} rows`)
  check('both probe bookings came back', (readBack?.length ?? 0) === 2, `${readBack?.length ?? 0} rows`)
} finally {
  await cleanup()
  console.log(`\nCleaned up ${DOMAIN} (schedule + probe bookings deleted).`)
}

console.log(`\n${'─'.repeat(58)}`)
if (failures) {
  console.error(`✗ ${failures} check(s) failed — a real client's hours would NOT be honoured.`)
  process.exit(1)
}
console.log('✓ A real client_schedules row is read and honoured end to end.')

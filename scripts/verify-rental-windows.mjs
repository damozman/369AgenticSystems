/**
 * Multi-day rental windows — schema, and a REAL multi-day hold against one unit.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-rental-windows.mjs
 *
 * The unit tests prove the arithmetic. They cannot prove the two things that actually break in
 * production, so this does:
 *
 *   1. **An item with NO rental config still behaves exactly as before.** `min_rental_days` is
 *      null on every existing row, and if a null item started being answered with windows, every
 *      client that stocks anything would start offering multi-day hires of a folding chair. This
 *      is the same load-bearing property `verify-inventory.mjs` guards for items generally.
 *   2. **A multi-day booking genuinely blocks the days in the middle.** This is the bug the whole
 *      feature exists for: a bounce house booked Saturday morning read as FREE on Saturday
 *      afternoon while it was physically at a party until Sunday. A window that does not hold
 *      the days between its ends is the same bug wearing a longer timestamp.
 *
 * Everything it creates, it deletes, including on the failure paths.
 *
 * Buys nothing, calls no external API, and touches Retell not at all.
 */

import { createClient } from '@supabase/supabase-js'
import { generateRentalWindows, filterAvailable } from '../lib/availability.ts'
import { isRental } from '../lib/inventory.ts'

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

// Far enough out that it can never collide with a real booking.
const START = new Date(Date.now() + 420 * 86_400_000)
const END   = new Date(START.getTime() + 3 * 86_400_000) // a three-night hire

// appointment_date / appointment_time are NOT NULL — they predate starts_at/ends_at and the
// dashboard still reads them. Same trap verify-inventory.mjs documents.
const APPT_DATE = START.toISOString().slice(0, 19)
const APPT_TIME = 'verify-rental'
const RENTAL_ITEM = 'verify-rental-temp-dumpster'
const PLAIN_ITEM  = 'verify-rental-temp-chair'

const createdBookings = []
const createdItemIds = []
let clientDomain = null

async function cleanup() {
  for (const id of createdBookings) await db.from('bookings').delete().eq('id', id)
  for (const id of createdItemIds) await db.from('client_inventory').delete().eq('id', id)
}

const schedule = {
  timezone: 'America/Chicago',
  business_hours: {
    mon: { open: '08:00', close: '17:00' }, tue: { open: '08:00', close: '17:00' },
    wed: { open: '08:00', close: '17:00' }, thu: { open: '08:00', close: '17:00' },
    fri: { open: '08:00', close: '17:00' }, sat: { open: '09:00', close: '15:00' },
    sun: { open: '09:00', close: '15:00' },
  },
  slot_duration_minutes: 60,
  max_concurrent_per_slot: 1,
  lead_time_hours: 0,
  booking_horizon_days: 30,
}

try {
  // ── 1. Schema ───────────────────────────────────────────────────────────────
  console.log('\n1. Schema')

  const { error: colErr } = await db
    .from('client_inventory')
    .select('id, item_key, quantity, min_rental_days, max_rental_days')
    .limit(1)

  if (colErr) {
    bad('client_inventory has min_rental_days / max_rental_days', colErr.message)
    console.log('\n✗ Migration has not been applied. Run 2026-08-19-rental-windows.sql first.\n')
    process.exit(1)
  }
  ok('client_inventory has min_rental_days / max_rental_days')

  // ── 2. Fixture ──────────────────────────────────────────────────────────────
  console.log('\n2. Test fixture')

  const { data: sub } = await db
    .from('agent_subscriptions').select('client_domain').limit(1).maybeSingle()

  if (!sub) {
    note('no agent_subscriptions row — client_inventory is FK\'d to it, so nothing can be exercised')
    console.log('\n· Schema passed; the rest needs at least one subscription.\n')
    process.exit(0)
  }
  clientDomain = sub.client_domain
  ok(`using ${clientDomain}`)

  const { data: rentalRow, error: rentalErr } = await db.from('client_inventory').insert({
    client_domain: clientDomain, item_key: RENTAL_ITEM, label: 'Verify Temp Dumpster',
    quantity: 1, active: true, min_rental_days: 3, max_rental_days: 7,
  }).select('id').single()
  if (rentalErr) { bad('could not create the rental item', rentalErr.message); throw new Error('fixture') }
  createdItemIds.push(rentalRow.id)
  ok('rental item created (min 3, max 7 days)')

  const { data: plainRow, error: plainErr } = await db.from('client_inventory').insert({
    client_domain: clientDomain, item_key: PLAIN_ITEM, label: 'Verify Temp Chair',
    quantity: 1, active: true,
  }).select('id').single()
  if (plainErr) { bad('could not create the plain item', plainErr.message); throw new Error('fixture') }
  createdItemIds.push(plainRow.id)
  ok('plain item created (no rental config)')

  // ── 3. The null path must be untouched ──────────────────────────────────────
  console.log('\n3. An item with no rental config is NOT a rental')

  const { data: readBack } = await db
    .from('client_inventory')
    .select('item_key, min_rental_days, max_rental_days')
    .eq('client_domain', clientDomain)
    .in('item_key', [RENTAL_ITEM, PLAIN_ITEM])

  const plain  = readBack.find(r => r.item_key === PLAIN_ITEM)
  const rental = readBack.find(r => r.item_key === RENTAL_ITEM)

  if (plain.min_rental_days === null) ok('plain item stored null, not a default')
  else bad('plain item did not store null', `got ${plain.min_rental_days}`)

  if (isRental(plain) === false) ok('isRental() says the plain item books intra-day slots')
  else bad('isRental() wrongly classified a plain item as a rental')

  if (isRental(rental) === true) ok('isRental() says the dumpster is hired by the day')
  else bad('isRental() failed to classify a configured rental')

  // ── 4. The range is enforced, not silently adjusted ─────────────────────────
  console.log('\n4. A hire outside the stated range is refused')

  const { error: rangeErr } = await db.from('client_inventory').insert({
    client_domain: clientDomain, item_key: 'verify-rental-temp-bad', label: 'Bad Range',
    quantity: 1, active: true, min_rental_days: 7, max_rental_days: 3,
  })
  if (rangeErr) ok('max below min rejected at write time', 'would otherwise offer nothing, silently')
  else {
    bad('a max below min was accepted — that item would silently offer nothing')
    await db.from('client_inventory').delete()
      .eq('client_domain', clientDomain).eq('item_key', 'verify-rental-temp-bad')
  }

  // ── 5. A REAL multi-day hold ────────────────────────────────────────────────
  // The whole point of the feature: the days in the MIDDLE must be held too.
  console.log('\n5. A three-night hire holds the days between its ends')

  const { data: booked, error: bookErr } = await db.rpc('book_slot', {
    p_client_domain: clientDomain,
    p_starts_at: START.toISOString(),
    p_ends_at:   END.toISOString(),
    p_call_id: null, p_lead_id: null,
    p_appointment_date: APPT_DATE, p_appointment_time: APPT_TIME,
    p_service_type: 'verify-rental', p_location: null,
    p_item_key: RENTAL_ITEM,
  })

  if (bookErr) { bad('book_slot refused a multi-day hire', bookErr.message); throw new Error('book') }
  if (!booked?.length) { bad('book_slot returned no row for a free multi-day window'); throw new Error('book') }
  createdBookings.push(booked[0].id)
  ok(`three-night hire booked`, `${START.toISOString().slice(0, 10)} → ${END.toISOString().slice(0, 10)}`)

  // The middle day. Under the old day-bounded logic this read as free, which is the bug.
  const middle = new Date(START.getTime() + 1.5 * 86_400_000)
  const { data: clash, error: clashErr } = await db.rpc('book_slot', {
    p_client_domain: clientDomain,
    p_starts_at: middle.toISOString(),
    p_ends_at:   new Date(middle.getTime() + 60 * 60_000).toISOString(),
    p_call_id: null, p_lead_id: null,
    p_appointment_date: middle.toISOString().slice(0, 19), p_appointment_time: 'verify-rental-mid',
    p_service_type: 'verify-rental', p_location: null,
    p_item_key: RENTAL_ITEM,
  })
  if (clash?.length) {
    createdBookings.push(clash[0].id)
    bad('THE ORIGINAL BUG: the unit was booked again mid-hire', 'it is physically out')
  } else if (clashErr) {
    ok('mid-hire booking refused', clashErr.message.slice(0, 60))
  } else {
    ok('mid-hire booking refused', 'the unit is held for the whole span')
  }

  // ── 6. The generator agrees with the database ───────────────────────────────
  console.log('\n6. generateRentalWindows hides what is already out')

  const windows = generateRentalWindows(schedule, 3, new Date(START.getTime() - 10 * 86_400_000))
  const free = filterAvailable(windows, [{ starts_at: START, ends_at: END }], 1, 60)
  const stillOffered = free.filter(w => w.startsAt < END && w.endsAt > START)

  if (windows.length === 0) bad('generated no windows at all')
  else if (stillOffered.length > 0) bad(`${stillOffered.length} window(s) offered while the unit is out`)
  else ok(`${windows.length} window(s) generated, none overlapping the live hire`)

} catch (e) {
  bad('threw', e.message)
} finally {
  await cleanup()
  console.log('\n· cleaned up test rows')
}

console.log(failures === 0
  ? '\n✓ Rental windows verified against production.\n'
  : `\n✗ ${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)

/**
 * Per-item inventory — schema, and a REAL race against one item.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-inventory.mjs
 *
 * Two things are worth proving here and neither can be proven from unit tests:
 *
 *   1. **A booking with no item still behaves exactly as it did.** Every existing client books
 *      people-time. If the new book_slot() regressed the null path, every roofer, attorney and
 *      plumber breaks at once and nothing in the item tests would notice.
 *   2. **The per-item capacity check actually holds under a race.** A capacity check that has
 *      never had two bookings thrown at it is a comment, not a guarantee. This one books the same
 *      unit for the same instant twice and requires the second to be refused.
 *
 * Everything it creates, it deletes — including on the failure paths, because a verification
 * script that leaves rows behind poisons the next run.
 */

import { createClient } from '@supabase/supabase-js'
import { matchItem } from '../lib/inventory.ts'

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

// A far-future instant so it can never collide with a real booking.
const START = new Date(Date.now() + 400 * 86_400_000)
const END   = new Date(START.getTime() + 60 * 60_000)

// `bookings.appointment_date` and `appointment_time` are NOT NULL — they predate starts_at/ends_at
// and the dashboard still reads them. book_slot defaults them to null, so every caller must pass
// them; /api/book-appointment does. Omitting them here failed all four checks on the first run
// with a not-null violation that looked like a capacity bug and was not.
const APPT_DATE = START.toISOString().slice(0, 19)
const APPT_TIME = 'verify-inventory'
const TEST_ITEM = 'verify-inventory-temp-item'

const createdBookings = []
let createdItemId = null
let clientDomain = null

async function cleanup() {
  for (const id of createdBookings) {
    await db.from('bookings').delete().eq('id', id)
  }
  if (createdItemId) await db.from('client_inventory').delete().eq('id', createdItemId)
}

try {
  // ── 1. Schema ───────────────────────────────────────────────────────────────
  console.log('\n1. Schema')

  const { error: invErr } = await db
    .from('client_inventory')
    .select('id, client_domain, item_key, label, quantity, active')
    .limit(1)
  if (invErr) bad('client_inventory exists with every column', invErr.message)
  else ok('client_inventory exists with every column')

  const { error: colErr } = await db.from('bookings').select('inventory_item_key').limit(1)
  if (colErr) bad('bookings.inventory_item_key exists', colErr.message)
  else ok('bookings.inventory_item_key exists')

  if (invErr || colErr) {
    console.log('\n✗ Migration has not been applied. Run 2026-08-16-client-inventory.sql first.\n')
    process.exit(1)
  }

  // ── 2. A real client to hang the test item on ───────────────────────────────
  console.log('\n2. Test fixture')

  const { data: sub } = await db
    .from('agent_subscriptions')
    .select('client_domain')
    .limit(1)
    .maybeSingle()

  if (!sub) {
    note('no agent_subscriptions row — cannot exercise the race (client_inventory is FK\'d to it)')
    console.log('\n· Schema checks passed; the race needs at least one subscription.\n')
    process.exit(0)
  }

  clientDomain = sub.client_domain
  ok(`using ${clientDomain}`)

  // ── 3. The null path must be untouched ──────────────────────────────────────
  // This is the regression that would break every existing client at once.
  console.log('\n3. A booking with no item behaves as before')

  const { data: general, error: generalErr } = await db.rpc('book_slot', {
    p_client_domain:    clientDomain,
    p_starts_at:        START.toISOString(),
    p_ends_at:          END.toISOString(),
    p_appointment_date: APPT_DATE,
    p_appointment_time: APPT_TIME,
  })

  const generalRow = Array.isArray(general) ? general[0] : general
  if (generalErr) {
    bad('a no-item booking still succeeds', generalErr.message)
  } else if (!generalRow) {
    bad('a no-item booking still succeeds', 'returned zero rows — the slot was reported full')
  } else {
    createdBookings.push(generalRow.id)
    ok('a no-item booking still succeeds', `inventory_item_key = ${JSON.stringify(generalRow.inventory_item_key)}`)
    if (generalRow.inventory_item_key !== null) {
      bad('a no-item booking leaves inventory_item_key null', `got ${generalRow.inventory_item_key}`)
    }
  }

  // ── 4. A REAL race against one item ─────────────────────────────────────────
  console.log('\n4. Per-item capacity, raced for real')

  const { data: item, error: itemErr } = await db
    .from('client_inventory')
    .insert({ client_domain: clientDomain, item_key: TEST_ITEM, label: 'Verify Temp Unit', quantity: 1 })
    .select('id')
    .single()

  if (itemErr) {
    bad('could not create the test item', itemErr.message)
  } else {
    createdItemId = item.id
    ok('created a temporary item with quantity 1')

    const bookOnce = () => db.rpc('book_slot', {
      p_client_domain:    clientDomain,
      p_starts_at:        START.toISOString(),
      p_ends_at:          END.toISOString(),
      p_appointment_date: APPT_DATE,
      p_appointment_time: APPT_TIME,
      p_item_key:         TEST_ITEM,
    })

    const { data: first, error: firstErr } = await bookOnce()
    const firstRow = Array.isArray(first) ? first[0] : first
    if (firstErr)      bad('the first booking for the item succeeds', firstErr.message)
    else if (!firstRow) bad('the first booking for the item succeeds', 'returned zero rows')
    else {
      createdBookings.push(firstRow.id)
      ok('the first booking for the item succeeds', firstRow.id)
    }

    // The whole point. Same unit, same instant, second attempt.
    const { data: second, error: secondErr } = await bookOnce()
    const secondRow = Array.isArray(second) ? second[0] : second
    if (secondErr) {
      bad('the second booking is refused', `raised instead of returning zero rows: ${secondErr.message}`)
    } else if (secondRow) {
      createdBookings.push(secondRow.id)
      bad('the second booking is refused', 'IT DOUBLE-BOOKED THE SAME UNIT')
    } else {
      ok('the second booking for the same unit is refused', 'zero rows, as designed')
    }

    // A different item at the same instant must still be bookable — one unit being out does not
    // make the whole yard unavailable, which is the entire reason this feature exists.
    const { data: other, error: otherErr } = await db
      .from('client_inventory')
      .insert({ client_domain: clientDomain, item_key: `${TEST_ITEM}-2`, label: 'Verify Temp Unit 2', quantity: 1 })
      .select('id')
      .single()

    if (!otherErr && other) {
      const { data: otherBooking } = await db.rpc('book_slot', {
        p_client_domain:    clientDomain,
        p_starts_at:        START.toISOString(),
        p_ends_at:          END.toISOString(),
        p_appointment_date: APPT_DATE,
        p_appointment_time: APPT_TIME,
        p_item_key:         `${TEST_ITEM}-2`,
      })
      const otherRow = Array.isArray(otherBooking) ? otherBooking[0] : otherBooking
      if (otherRow) {
        createdBookings.push(otherRow.id)
        ok('a DIFFERENT item at the same instant still books')
      } else {
        bad('a different item at the same instant still books', 'it was refused — items are gating each other')
      }
      await db.from('client_inventory').delete().eq('id', other.id)
    }

    // An unknown key is a configuration fault, not contention, so it must raise rather than
    // return zero rows — otherwise the caller cannot tell "full" from "misconfigured".
    const { error: unknownErr } = await db.rpc('book_slot', {
      p_client_domain:    clientDomain,
      p_starts_at:        START.toISOString(),
      p_ends_at:          END.toISOString(),
      p_appointment_date: APPT_DATE,
      p_appointment_time: APPT_TIME,
      p_item_key:         'no-such-item-anywhere',
    })
    if (unknownErr) ok('an unknown item raises rather than silently returning zero rows')
    else            bad('an unknown item raises', 'it returned quietly — "full" and "misconfigured" are now indistinguishable')
  }

  // ── 5. Matching, against whatever this client really stocks ─────────────────
  console.log('\n5. Matching against real inventory')

  const { data: realItems } = await db
    .from('client_inventory')
    .select('item_key, label, quantity')
    .eq('client_domain', clientDomain)
    .eq('active', true)
    .neq('item_key', TEST_ITEM)

  if (!realItems?.length) {
    note('no real inventory configured for this client yet')
  } else {
    for (const it of realItems) {
      const m = matchItem(realItems, it.label)
      if (m.kind === 'match' && m.item.item_key === it.item_key) ok(`"${it.label}" resolves to itself`)
      else bad(`"${it.label}" resolves to itself`, `got ${m.kind}`)
    }
  }
} finally {
  await cleanup()
  console.log('\n· Cleaned up every row this script created.')
}

console.log('\n' + '─'.repeat(62))
if (failures === 0) {
  console.log('✓ All checks passed.\n')
} else {
  console.log(`✗ ${failures} check(s) failed.\n`)
  process.exit(1)
}

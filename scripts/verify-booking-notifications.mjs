/**
 * Verifies the half of a booking that happens AFTER the row is written: is anyone actually told?
 *
 *   node scripts/verify-booking-notifications.mjs [hours]     report only (default 72)
 *   node scripts/verify-booking-notifications.mjs 72 --repair link orphaned bookings to their leads
 *
 * A booking that lands in the database and notifies nobody looks identical to a working one from
 * the outside — the call sounds right, the row exists, the dashboard count goes up. This checks
 * the three things that have to be true for a human to find out about it.
 *
 * The specific fault this was written for (found 2026-08-04, fixed on this branch): the agent
 * calls book_appointment BEFORE capture_lead, so the booking is written while no lead row exists
 * and `bookings.lead_id` stays null forever. Nova then reads that null, decides there is no caller
 * email, and records `skipped_no_email` — for a caller whose address arrived 27 seconds later.
 * An orphan is therefore a booking whose call HAS a lead that the booking never picked up.
 *
 * --repair fixes the link in the database only. It deliberately does NOT send anything: those
 * appointments are in the past by now, and mailing a stale confirmation to a real customer is
 * worse than the missing row it would be papering over.
 */

import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const args   = process.argv.slice(2)
const REPAIR = args.includes('--repair')
const HOURS  = Number(args.find(a => /^\d+$/.test(a)) ?? 72)
const since  = new Date(Date.now() - HOURS * 3600_000).toISOString()

console.log(`\nBookings in the last ${HOURS}h${REPAIR ? '  (REPAIR MODE)' : ''}\n${'─'.repeat(60)}`)

const { data: bookings, error } = await db
  .from('bookings')
  .select('id, client_domain, call_id, lead_id, appointment_date, appointment_time, confirmation_sent, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: false })

if (error) {
  console.error(`✗ Cannot read bookings: ${error.message}`)
  process.exit(1)
}

if (!bookings.length) {
  console.log('No bookings in that window — nothing to check.')
  console.log('Widen it if the booking was older:  node scripts/verify-booking-notifications.mjs 168')
  process.exit(0)
}

// One subscription lookup per distinct domain rather than per booking.
const domains = [...new Set(bookings.map(b => b.client_domain))]
const { data: subs } = await db
  .from('agent_subscriptions')
  .select('client_domain, user_email')
  .in('client_domain', domains)
const subByDomain = Object.fromEntries((subs ?? []).map(s => [s.client_domain, s.user_email]))

let orphans = 0
let unnotified = 0
let repaired = 0

for (const b of bookings) {
  console.log(`\n${b.appointment_date?.slice(0, 10)} @ ${b.appointment_time}   ${b.client_domain}`)

  // The lead the booking points at, and the lead its call actually has. When the second exists
  // and the first does not, the booking was written before the lead and never caught up.
  const { data: callLeads } = b.call_id
    ? await db.from('leads').select('id, caller_name, caller_phone, caller_email')
        .eq('call_id', b.call_id).order('created_at', { ascending: false }).limit(1)
    : { data: null }
  const callLead = callLeads?.[0] ?? null

  if (b.lead_id) {
    console.log(`  lead:      linked (${b.lead_id.slice(0, 8)})`)
  } else if (callLead) {
    orphans++
    console.log(`  lead:      ✗ ORPHANED — the call has a lead (${callLead.caller_phone}) the booking never picked up`)
    if (REPAIR) {
      const { error: linkErr } = await db.from('bookings').update({ lead_id: callLead.id }).eq('id', b.id)
      if (linkErr) console.log(`             ✗ repair failed: ${linkErr.message}`)
      else { repaired++; console.log(`             ✓ repaired → lead ${callLead.id.slice(0, 8)}`) }
    }
  } else {
    console.log(`  lead:      none captured on this call at all`)
  }

  // Owner alert — fires from /api/book-appointment, gated on a subscription row existing.
  const ownerEmail = subByDomain[b.client_domain]
  if (ownerEmail) {
    console.log(`  owner:     alert deliverable → ${ownerEmail}`)
  } else {
    console.log(`  owner:     ⚠ no agent_subscriptions row — nobody was alerted`)
  }

  // Caller confirmation — Nova. confirmation_sent only goes true on a real send.
  const { data: deliveries } = await db
    .from('nova_deliveries').select('status, sent_to_email').eq('booking_id', b.id)
  const statuses = (deliveries ?? []).map(d => d.status)
  const sent = b.confirmation_sent === true

  if (sent) {
    console.log(`  caller:    ✓ confirmation sent`)
  } else if (!statuses.length) {
    unnotified++
    console.log(`  caller:    ✗ Nova never ran for this booking`)
  } else {
    unnotified++
    const email = callLead?.caller_email
    const why = statuses.includes('skipped_no_email') && email
      ? `recorded "skipped_no_email" but the call DID capture ${email} — this is the orphan fault`
      : statuses.join(', ')
    console.log(`  caller:    ✗ not confirmed — ${why}`)
  }
}

// ── Verdict ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`)
console.log(`${bookings.length} booking(s):  ${orphans} orphaned, ${unnotified} with no caller confirmation`)

if (REPAIR) {
  console.log(`\nRepaired ${repaired} link(s). No email was sent — see this script's header for why.`)
}

if (!orphans && !unnotified) {
  console.log('\n✓ Every booking in this window reached both a lead and a confirmation.')
  process.exit(0)
}

if (orphans && !REPAIR) {
  console.log('\nOrphaned bookings mean book_appointment ran before capture_lead. On this branch the')
  console.log('lead adopts the booking when it arrives, so NEW calls should not produce orphans.')
  console.log('Re-run with --repair to link the existing ones.')
}

if (unnotified) {
  console.log('\nA booking with no caller confirmation is one the customer has no record of.')
  console.log('Check whether the call captured an email at all — Nova cannot send without one.')
}

process.exit(orphans || unnotified ? 1 : 0)

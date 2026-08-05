import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendClientBookingAlert } from '@/lib/email-sequences'
import { resolveAppointmentStart, civilDateInZone } from '@/lib/availability'
import { buildBookingEvent, getProviderForClient } from '@/lib/calendar'
import { loadSchedule } from '@/lib/client-schedule'
import { denyIfBadRetellSecret, internalHeaders } from '@/lib/security/route-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Called by Retell's agent tool ("book_appointment"). Secret via x-webhook-secret
  // header or ?secret= on the tool URL — dormant until RETELL_WEBHOOK_SECRET is set
  // (and configured on the Retell tool), then required.
  const denied = denyIfBadRetellSecret(request)
  if (denied) return denied

  let raw: Record<string, unknown>
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Retell custom tools POST { name, call: { call_id, ... }, args: {...} }.
  // Still accept a flat body too, for direct/manual calls (e.g. Nova internal trigger, testing).
  const retellCall = raw.call as { call_id?: string } | undefined
  const source     = (raw.args ?? raw) as Record<string, unknown>

  const {
    client_domain,
    appointment_date,
    appointment_time,
    service_type,
    location,
    starts_at,
  } = source as {
    client_domain?:    string
    appointment_date?: string
    appointment_time?: string
    service_type?:     string
    location?:         string
    // Supplied verbatim from available-slots' slot_details. Preferred over the prose fields,
    // which have to be re-parsed and have already put one real booking a full year out.
    starts_at?:        string
  }

  const call_id = retellCall?.call_id ?? (source.call_id as string | undefined)

  // Either the exact instant from available-slots, or the day-and-time pair Ava spoke. Demanding
  // both would reject the more precise of the two.
  if (!call_id || (!starts_at && (!appointment_date || !appointment_time))) {
    return NextResponse.json(
      { error: 'Missing required fields: call_id, and either starts_at or both appointment_date and appointment_time' },
      { status: 400 }
    )
  }

  // Resolve Retell call_id string → Supabase UUID. caller_phone/caller_name come along because
  // the owner alert below needs a fallback: the agent often books BEFORE it captures the lead
  // (measured at 27s and 41s ahead on the two real calls of 2026-08-04), so there is frequently
  // no lead row yet at this point. call-received writes caller_phone from Retell's from_number
  // at call start, so it is always populated by the time a booking can happen.
  const { data: callRow } = await supabase
    .from('calls')
    .select('id, client_domain, caller_phone, caller_name')
    .eq('call_id', call_id)
    .maybeSingle()

  // Find linked lead (if capture-lead ran first). Ordered + limited to 1 so a stray
  // duplicate row (pre-upsert-constraint data, or any future edge case) can't turn this
  // into a silent null via .maybeSingle() erroring on >1 row.
  const { data: leadRows } = callRow
    ? await supabase.from('leads').select('id, caller_name, caller_phone, caller_email, caller_address').eq('call_id', callRow.id).order('created_at', { ascending: false }).limit(1)
    : { data: null }
  const leadRow = leadRows?.[0] ?? null

  // Falls back to the demo line's client_domain if not supplied — matches call-received's convention.
  const resolvedClientDomain = client_domain ?? callRow?.client_domain ?? 'demo.369agenticsystems.com'

  const schedule = await loadSchedule(supabase, resolvedClientDomain)

  // Prefer the exact instant available-slots handed out; fall back to parsing what Ava said.
  const startsAt = starts_at
    ? new Date(starts_at)
    : resolveAppointmentStart(appointment_date ?? '', appointment_time ?? '', schedule.timezone)

  // Refuse rather than guess. A booking silently landing at midnight, or a year out, is worse
  // than one that visibly failed — Ava can ask the caller to repeat the time.
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    console.error(`[BOOKING] ✗  Unparseable time: date="${appointment_date}" time="${appointment_time}" starts_at="${starts_at}"`)
    return NextResponse.json(
      { error: `Could not understand the appointment time "${appointment_date} ${appointment_time}". Ask the caller to confirm the day and time.` },
      { status: 400 },
    )
  }

  const endsAt = new Date(startsAt.getTime() + schedule.slot_duration_minutes * 60_000)

  // The dashboard and the owner's alert email both read the original text columns, so they stay
  // populated. When only starts_at was supplied they are derived from it, in the client's own
  // timezone — never left null, and never a UTC instant rendered as if it were local.
  const inZone = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: schedule.timezone, ...opts }).format(startsAt)
  const civil = civilDateInZone(startsAt, schedule.timezone)
  const pad = (n: number) => String(n).padStart(2, '0')

  const appointmentDateValue = appointment_date ?? `${civil.year}-${pad(civil.month)}-${pad(civil.day)}`
  const appointmentTimeValue = appointment_time ?? inZone({ hour: 'numeric', minute: '2-digit', hour12: true })

  // Atomic capacity check + insert. Two callers on two simultaneous calls can both be told
  // 10:00 AM is free before either row lands, so the check has to happen where the insert does
  // — the Supabase client cannot open a transaction.
  const { data: bookedRows, error: bookingError } = await supabase.rpc('book_slot', {
    p_client_domain:    resolvedClientDomain,
    p_starts_at:        startsAt.toISOString(),
    p_ends_at:          endsAt.toISOString(),
    p_call_id:          callRow?.id ?? null,
    p_lead_id:          leadRow?.id ?? null,
    p_appointment_date: appointmentDateValue,
    p_appointment_time: appointmentTimeValue,
    p_service_type:     service_type ?? null,
    p_location:         location     ?? null,
  })

  if (bookingError) {
    console.error('[BOOKING] ✗  book_slot failed:', bookingError.message)
    return NextResponse.json({ error: bookingError.message }, { status: 500 })
  }

  // Zero rows is unambiguous — book_slot raises on anything else — so it means the slot filled
  // between being offered and being accepted. 409 so Ava offers another time instead of
  // reporting success for an appointment that does not exist.
  const booking = Array.isArray(bookedRows) ? bookedRows[0] : bookedRows
  if (!booking) {
    console.log(`[BOOKING] ⚠  Slot already taken: ${startsAt.toISOString()} — ${resolvedClientDomain}`)
    return NextResponse.json(
      {
        error: 'slot_unavailable',
        message: 'That time was just taken. Offer the caller another slot from check_availability.',
      },
      { status: 409 },
    )
  }

  // Stamp the call as booked
  if (callRow?.id) {
    await supabase
      .from('calls')
      .update({ call_outcome: 'booked' })
      .eq('id', callRow.id)
  }

  console.log(`[BOOKING] ✓  ${appointmentDateValue} @ ${appointmentTimeValue} — ${resolvedClientDomain}`)

  /**
   * Write the event to the owner's calendar.
   *
   * Deliberately non-fatal, and deliberately the opposite of how /api/available-slots treats the
   * same provider. The read fails closed because offering an unverifiable time causes the exact
   * harm this integration exists to prevent. The write fails open because by this point
   * `book_slot()` has already held the slot atomically and the caller is on the phone — failing
   * a booking that really happened, to report a Google outage, would be strictly worse for
   * everyone.
   *
   * `calendar_sync_status` carries the difference so /api/cron/calendar-sync can retry, and the
   * .ics attachment on the owner's alert email remains the backstop meanwhile.
   *
   * The event is usually created with no caller name: Ava books 27–41s before she captures the
   * lead. /api/capture-lead patches it when the lead lands.
   */
  const provider = await getProviderForClient(supabase, resolvedClientDomain)
  if (provider) {
    try {
      const { id: eventId } = await provider.createEvent(buildBookingEvent({
        startsAt,
        endsAt,
        timeZone:      schedule.timezone,
        serviceType:   service_type,
        location,
        callerName:    leadRow?.caller_name  ?? callRow?.caller_name,
        callerPhone:   leadRow?.caller_phone ?? callRow?.caller_phone,
        callerEmail:   leadRow?.caller_email,
        callerAddress: leadRow?.caller_address,
      }))

      await supabase
        .from('bookings')
        .update({
          calendar_event_id:    eventId,
          calendar_sync_status: 'synced',
          calendar_synced_at:   new Date().toISOString(),
        })
        .eq('id', booking.id)

      console.log(`[BOOKING] ✓  Calendar event ${eventId} — ${resolvedClientDomain}`)
    } catch (e) {
      console.error('[BOOKING] Calendar write failed (booking stands):', (e as Error).message)
      await supabase
        .from('bookings')
        .update({ calendar_sync_status: 'pending' })
        .eq('id', booking.id)
    }
  }

  // Alert the client (business owner) directly — the dashboard's Appointments count is a
  // running total with nothing to signal "this one is new," so someone in the field would
  // never know without this. Non-fatal: a failed alert shouldn't fail the booking.
  const { data: ownerSub } = await supabase
    .from('agent_subscriptions')
    .select('user_email')
    .eq('client_domain', resolvedClientDomain)
    .maybeSingle()

  if (ownerSub?.user_email) {
    // Fall back to the call row when the lead hasn't been captured yet. An alert saying
    // "Phone: unknown" is one the owner cannot act on — the whole point is to give them
    // someone to ring back.
    const callerPhone = leadRow?.caller_phone ?? callRow?.caller_phone ?? 'unknown'
    try {
      await sendClientBookingAlert({
        toEmail:         ownerSub.user_email,
        callerName:      leadRow?.caller_name ?? callRow?.caller_name ?? undefined,
        callerPhone,
        callerEmail:     leadRow?.caller_email ?? undefined,
        callerAddress:   leadRow?.caller_address ?? undefined,
        appointmentDate: appointmentDateValue,
        appointmentTime: appointmentTimeValue,
        serviceType:     service_type ?? undefined,
        location:        location ?? undefined,
      })
      console.log(`[BOOKING] ✓  Owner alert sent → ${ownerSub.user_email}`)
    } catch (e) {
      console.error('[BOOKING] Owner alert failed:', e)
    }
  } else {
    // Silent by construction otherwise: a booking lands, no one is told, and nothing in the
    // logs says why. This is correct for the demo line (no owner to notify) and a real fault
    // for a paying client, so it needs to be visible rather than inferred.
    console.warn(`[BOOKING] ⚠  No agent_subscriptions row for ${resolvedClientDomain} — owner alert skipped`)
  }

  // Fire Nova (booking confirmation) — non-fatal, but awaited: an un-awaited fetch risks the
  // serverless function freezing before it completes (confirmed missing in production once already).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    await fetch(`${appUrl}/api/nova/booking-confirmation`, {
      method:  'POST',
      headers: internalHeaders(),
      body:    JSON.stringify({ booking_id: booking.id }),
    }).catch(err => console.error('[NOVA TRIGGER] Failed:', err))
  }

  return NextResponse.json({ success: true, booking })
}

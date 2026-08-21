import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { formatAppointment } from '@/lib/appointment-format'
import { loadSchedule } from '@/lib/client-schedule'
import { sendNovaBookingEmail, sendNovaEstimateSMS, type NovaVertical } from '@/lib/nova-templates'
import { denyIfBadSecret, INTERNAL_SECRET_HEADER } from '@/lib/security/route-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verticals Nova has real copy for. `unknown` is deliberately NOT here — it is the fallback, not
// something a caller can be classified as, and listing it would let an unrecognised value skip
// the refusal above and quietly render neutral copy instead of being logged as unsupported.
const NOVA_VERTICALS: NovaVertical[] = [
  'roofing', 'hvac', 'plumbing', 'legal', 'real-estate', 'insurance', 'saas', 'wholesale', 'dental',
  'event-rentals', 'dumpster-rental', 'equipment-rental',
]

export async function POST(request: NextRequest) {
  // Internal-only route (fired server-to-server by book-appointment). Guarded by
  // a shared secret — dormant until INTERNAL_API_SECRET is set, then required.
  const denied = denyIfBadSecret(request, process.env.INTERNAL_API_SECRET, INTERNAL_SECRET_HEADER)
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { booking_id } = body as { booking_id?: string }
  if (!booking_id) {
    return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, lead_id, client_domain, starts_at, appointment_date, appointment_time, service_type, location')
    .eq('id', booking_id)
    .maybeSingle()

  if (bookingError || !booking) {
    console.error('[NOVA] ✗  Booking lookup failed:', bookingError?.message ?? 'not found')
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const { data: lead } = booking.lead_id
    ? await supabase
        .from('leads')
        .select('caller_name, caller_phone, caller_email, vertical')
        .eq('id', booking.lead_id)
        .maybeSingle()
    : { data: null }

  // Prefer Ava's live classification on the lead; fall back to the client's real
  // subscription for paying customers.
  let rawVertical = lead?.vertical as string | undefined
  if (!rawVertical) {
    const { data: subscription } = await supabase
      .from('agent_subscriptions')
      .select('vertical')
      .eq('client_domain', booking.client_domain)
      .maybeSingle()
    rawVertical = subscription?.vertical as string | undefined
  }

  const isSupported = rawVertical ? NOVA_VERTICALS.includes(rawVertical as NovaVertical) : false

  // A real vertical was identified, just not one we have templates for yet — skip
  // rather than send mismatched-industry copy (e.g. roofing language on a legal booking).
  if (rawVertical && !isSupported) {
    await supabase.from('nova_deliveries').insert({
      booking_id, lead_id: booking.lead_id, client_domain: booking.client_domain,
      vertical: rawVertical, delivery_type: 'booking_confirmation_email',
      content: null, sent_to_email: null, sent_to_phone: null, status: 'skipped_unsupported_vertical',
    })
    console.log(`[NOVA] ⚠  Skipped booking ${booking_id} — no templates yet for vertical "${rawVertical}"`)
    return NextResponse.json({ success: true, status: 'skipped_unsupported_vertical' })
  }

  /**
   * Reached only when `rawVertical` is EMPTY — a real-but-unsupported vertical returned above.
   * That case is common, not exotic: a third of `leads` rows have a null vertical, and the shared
   * demo line has no `agent_subscriptions` row to fall back to while taking real prospect calls.
   *
   * This used to be `'roofing'`, which sent a stranger a confident email about their upcoming
   * roof inspection. Now trade-neutral: it confirms the booking without naming an industry.
   */
  const vertical: NovaVertical = isSupported ? (rawVertical as NovaVertical) : 'unknown'

  // No address to send to. Recorded, not claimed — /api/capture-lead re-fires this route the
  // moment an email arrives, and claiming here would suppress that retry forever.
  if (!lead?.caller_email) {
    await supabase.from('nova_deliveries').insert({
      booking_id, lead_id: booking.lead_id, client_domain: booking.client_domain,
      vertical, delivery_type: 'booking_confirmation_email',
      content: null, sent_to_email: null, sent_to_phone: lead?.caller_phone ?? null,
      status: 'skipped_no_email',
    })
    return NextResponse.json({ success: true, status: 'skipped_no_email' })
  }

  /**
   * Claim the booking before sending — one UPDATE that is also the lock.
   *
   * This route has two callers (book-appointment, and capture-lead once a lead lands) and
   * capture_lead itself fires several times per call. Every one of them checked
   * `confirmation_sent` and then sent, which is a check-then-act race across processes: on the
   * first real Northside booking two of them both read false and the caller got the same
   * confirmation email twice, 862ms apart.
   *
   * Postgres makes the conditional UPDATE atomic, so exactly one caller can flip false -> true
   * and the losers get zero rows back. `.or(...)` rather than `.eq('confirmation_sent', false)`
   * because older rows carry null, and `null = false` is null in SQL — those rows would never
   * match and would send on every single attempt.
   */
  const { data: claimed } = await supabase
    .from('bookings')
    .update({ confirmation_sent: true, confirmation_sent_at: new Date().toISOString() })
    .eq('id', booking_id)
    .or('confirmation_sent.is.null,confirmation_sent.eq.false')
    .select('id')

  if (!claimed || claimed.length === 0) {
    console.log(`[NOVA] ·  Confirmation for ${booking_id} already claimed — not sending a duplicate`)
    return NextResponse.json({ success: true, status: 'already_sent' })
  }

  // The client's own timezone. A booking is a wall-clock promise to a human, and telling a
  // caller in Phoenix an hour that only makes sense in Chicago is the same class of error as
  // the date bug above.
  const schedule = await loadSchedule(supabase, booking.client_domain)
  const when = formatAppointment(booking, schedule.timezone)

  let status = 'sent'
  let content = ''

  try {
    await sendNovaBookingEmail({
      vertical,
      toEmail:          lead.caller_email,
      callerName:       lead.caller_name ?? undefined,
      serviceType:      booking.service_type ?? undefined,
      appointmentDate:  when.date,
      appointmentTime:  when.time,
      location:         booking.location ?? undefined,
      clientDomain:     booking.client_domain,
    })
    content = `Booking confirmation sent for ${when.date} ${when.time}`
  } catch (e) {
    console.error('[NOVA] Email generation/send failed:', e)
    status = 'error'

    // Release the claim. `confirmation_sent` must mean "the caller has this in writing" and
    // nothing else — it used to be set unconditionally, which hid real delivery failures behind
    // a database that claimed success. Releasing also lets capture-lead's retry pick it up.
    await supabase
      .from('bookings')
      .update({ confirmation_sent: false, confirmation_sent_at: null })
      .eq('id', booking_id)
  }

  // Inside the claim, so a duplicate invocation cannot text the caller twice either.
  if (status === 'sent' && lead.caller_phone) {
    await sendNovaEstimateSMS(lead.caller_phone, `Your ${vertical} appointment is confirmed for ${when.date} at ${when.time}.`)
  }

  await supabase.from('nova_deliveries').insert({
    booking_id,
    lead_id:       booking.lead_id,
    client_domain: booking.client_domain,
    vertical,
    delivery_type: 'booking_confirmation_email',
    content,
    sent_to_email: lead.caller_email,
    sent_to_phone: lead.caller_phone ?? null,
    status,
  })

  if (booking.lead_id) {
    await supabase
      .from('follow_up_sequences')
      .update({ converted: true })
      .eq('lead_id', booking.lead_id)
  }

  console.log(`[NOVA] ✓  Booking confirmation processed for booking ${booking_id} (${status})`)
  return NextResponse.json({ success: true, status })
}

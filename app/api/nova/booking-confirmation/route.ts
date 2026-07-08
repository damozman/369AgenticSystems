import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendNovaBookingEmail, sendNovaEstimateSMS, type NovaVertical } from '@/lib/nova-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NOVA_VERTICALS: NovaVertical[] = ['roofing', 'hvac', 'plumbing']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  })
}

export async function POST(request: NextRequest) {
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
    .select('id, lead_id, client_domain, appointment_date, appointment_time, service_type, location')
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

  const vertical: NovaVertical = isSupported ? (rawVertical as NovaVertical) : 'roofing'

  let status = 'sent'
  let content = ''

  if (lead?.caller_email) {
    const emailInput = {
      vertical,
      toEmail:          lead.caller_email,
      callerName:       lead.caller_name ?? undefined,
      serviceType:      booking.service_type ?? undefined,
      appointmentDate:  formatDate(String(booking.appointment_date)),
      appointmentTime:  booking.appointment_time,
      location:         booking.location ?? undefined,
      clientDomain:     booking.client_domain,
    }
    try {
      await sendNovaBookingEmail(emailInput)
      content = `Booking confirmation sent for ${emailInput.appointmentDate} ${emailInput.appointmentTime}`
    } catch (e) {
      console.error('[NOVA] Email generation/send failed:', e)
      status = 'error'
    }
  } else {
    status = 'skipped_no_email'
  }

  if (lead?.caller_phone) {
    await sendNovaEstimateSMS(lead.caller_phone, `Your ${vertical} appointment is confirmed for ${booking.appointment_time}.`)
  }

  await supabase.from('nova_deliveries').insert({
    booking_id,
    lead_id:       booking.lead_id,
    client_domain: booking.client_domain,
    vertical,
    delivery_type: 'booking_confirmation_email',
    content,
    sent_to_email: lead?.caller_email ?? null,
    sent_to_phone: lead?.caller_phone ?? null,
    status,
  })

  await supabase
    .from('bookings')
    .update({ confirmation_sent: true, confirmation_sent_at: new Date().toISOString() })
    .eq('id', booking_id)

  if (booking.lead_id) {
    await supabase
      .from('follow_up_sequences')
      .update({ converted: true })
      .eq('lead_id', booking.lead_id)
  }

  console.log(`[NOVA] ✓  Booking confirmation processed for booking ${booking_id} (${status})`)
  return NextResponse.json({ success: true, status })
}

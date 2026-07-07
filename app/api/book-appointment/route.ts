import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    call_id,
    client_domain,
    appointment_date,
    appointment_time,
    service_type,
    location,
  } = body as {
    call_id?:          string
    client_domain?:    string
    appointment_date?: string
    appointment_time?: string
    service_type?:     string
    location?:         string
  }

  if (!call_id || !client_domain || !appointment_date || !appointment_time) {
    return NextResponse.json(
      { error: 'Missing required fields: call_id, client_domain, appointment_date, appointment_time' },
      { status: 400 }
    )
  }

  // Resolve Retell call_id string → Supabase UUID
  const { data: callRow } = await supabase
    .from('calls')
    .select('id')
    .eq('call_id', call_id)
    .maybeSingle()

  // Find linked lead (if capture-lead ran first)
  const { data: leadRow } = callRow
    ? await supabase.from('leads').select('id').eq('call_id', callRow.id).maybeSingle()
    : { data: null }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      call_id:          callRow?.id ?? null,
      lead_id:          leadRow?.id ?? null,
      client_domain,
      appointment_date,
      appointment_time,
      service_type:     service_type ?? null,
      location:         location     ?? null,
    })
    .select()
    .single()

  if (bookingError) {
    console.error('[BOOKING] ✗  Insert failed:', bookingError.message)
    return NextResponse.json({ error: bookingError.message }, { status: 500 })
  }

  // Stamp the call as booked
  if (callRow?.id) {
    await supabase
      .from('calls')
      .update({ call_outcome: 'booked' })
      .eq('id', callRow.id)
  }

  console.log(`[BOOKING] ✓  ${appointment_date} @ ${appointment_time} — ${client_domain}`)

  // Fire Nova (booking confirmation) — non-fatal
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    fetch(`${appUrl}/api/nova/booking-confirmation`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ booking_id: booking.id }),
    }).catch(err => console.error('[NOVA TRIGGER] Failed:', err))
  }

  return NextResponse.json({ success: true, booking })
}

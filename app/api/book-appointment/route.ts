import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendClientBookingAlert } from '@/lib/email-sequences'
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
  } = source as {
    client_domain?:    string
    appointment_date?: string
    appointment_time?: string
    service_type?:     string
    location?:         string
  }

  const call_id = retellCall?.call_id ?? (source.call_id as string | undefined)

  if (!call_id || !appointment_date || !appointment_time) {
    return NextResponse.json(
      { error: 'Missing required fields: call_id, appointment_date, appointment_time' },
      { status: 400 }
    )
  }

  // Resolve Retell call_id string → Supabase UUID
  const { data: callRow } = await supabase
    .from('calls')
    .select('id, client_domain')
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

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      call_id:          callRow?.id ?? null,
      lead_id:          leadRow?.id ?? null,
      client_domain:    resolvedClientDomain,
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

  console.log(`[BOOKING] ✓  ${appointment_date} @ ${appointment_time} — ${resolvedClientDomain}`)

  // Alert the client (business owner) directly — the dashboard's Appointments count is a
  // running total with nothing to signal "this one is new," so someone in the field would
  // never know without this. Non-fatal: a failed alert shouldn't fail the booking.
  const { data: ownerSub } = await supabase
    .from('agent_subscriptions')
    .select('user_email')
    .eq('client_domain', resolvedClientDomain)
    .maybeSingle()

  if (ownerSub?.user_email) {
    try {
      await sendClientBookingAlert({
        toEmail:         ownerSub.user_email,
        callerName:      leadRow?.caller_name ?? undefined,
        callerPhone:     leadRow?.caller_phone ?? 'unknown',
        callerEmail:     leadRow?.caller_email ?? undefined,
        callerAddress:   leadRow?.caller_address ?? undefined,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time,
        serviceType:     service_type ?? undefined,
        location:        location ?? undefined,
      })
      console.log(`[BOOKING] ✓  Owner alert sent → ${ownerSub.user_email}`)
    } catch (e) {
      console.error('[BOOKING] Owner alert failed:', e)
    }
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

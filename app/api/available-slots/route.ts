import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { openSlots, formatSlot } from '@/lib/availability'
import { loadSchedule } from '@/lib/client-schedule'
import { denyIfBadRetellSecret } from '@/lib/security/route-guard'

/**
 * The times Ava offers a caller.
 *
 * This route used to be a GET taking no arguments that returned hardcoded 10:00 AM and 2:00 PM
 * slots, Mon–Fri, always America/Chicago. It read no calendar and — more damaging — never read
 * the bookings table, so Ava could hand the same Tuesday 10:00 AM to five different callers and
 * nothing anywhere objected.
 *
 * It is now a POST because it needs to know *which* client is asking. Retell's custom-tool
 * envelope carries the call id, and the call resolves to a client exactly as book-appointment
 * already does.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
  // Now guarded. The old route was public because it returned nothing but invented dates;
  // this one reads a specific client's working hours and their booked appointments.
  const denied = denyIfBadRetellSecret(request)
  if (denied) return denied

  let raw: Record<string, unknown> = {}
  try {
    raw = await request.json()
  } catch {
    // Retell has been observed calling argument-less tools with an empty body. That is not an
    // error — it just means no call context, which the demo-line fallback below handles.
  }

  const retellCall = raw.call as { call_id?: string } | undefined
  const source = (raw.args ?? raw) as Record<string, unknown>
  const callId = retellCall?.call_id ?? (source.call_id as string | undefined)

  // Resolve the caller's client. Same convention as book-appointment: fall back to the demo
  // line rather than failing, so a demo call still gets real slots.
  let clientDomain = (source.client_domain as string | undefined) ?? null
  if (!clientDomain && callId) {
    const { data: callRow } = await supabase
      .from('calls')
      .select('client_domain')
      .eq('call_id', callId)
      .maybeSingle()
    clientDomain = callRow?.client_domain ?? null
  }
  clientDomain ??= 'demo.369agenticsystems.com'

  const schedule = await loadSchedule(supabase, clientDomain)

  // Only the window Ava can actually offer from. Cancelled appointments free their slot.
  const horizonEnd = new Date(Date.now() + (schedule.booking_horizon_days + 1) * 86_400_000)
  const { data: busy, error: busyError } = await supabase
    .from('bookings')
    .select('starts_at, ends_at')
    .eq('client_domain', clientDomain)
    .neq('status', 'cancelled')
    .not('starts_at', 'is', null)
    .lte('starts_at', horizonEnd.toISOString())

  // Refusing to answer is better than offering a slot that is already taken: an unreadable
  // bookings table is exactly the case where Ava would double-book.
  if (busyError) {
    console.error('[SLOTS] Could not read existing bookings:', busyError.message)
    return NextResponse.json(
      { error: `Could not check the calendar: ${busyError.message}` },
      { status: 503 },
    )
  }

  const slots = openSlots(schedule, busy ?? [], { limit: 4, perDay: 2 })

  // Genuinely full. Saying so is the honest answer — the old route could never produce it.
  if (slots.length === 0) {
    console.log(`[SLOTS] No availability in the next ${schedule.booking_horizon_days} days — ${clientDomain}`)
    return NextResponse.json({
      slots: [],
      suggested: null,
      timezone: schedule.timezone,
      message: 'No open appointments in the scheduling window. Offer to take a message and have someone call back.',
    })
  }

  const spoken = slots.map(s => formatSlot(s, schedule.timezone))

  console.log(`[SLOTS] ✓  ${slots.length} open — ${clientDomain}`)

  return NextResponse.json({
    slots: spoken,
    // Two options, not four — a caller asked to choose between four times picks none.
    suggested: spoken.length > 1 ? `${spoken[0]} or ${spoken[1]}` : spoken[0],
    timezone: schedule.timezone,
    // The exact instants behind the spoken strings. book_appointment prefers starts_at over
    // re-parsing prose, which is how an appointment ends up an hour or a year off.
    slot_details: slots.map((s, i) => ({
      spoken:     spoken[i],
      starts_at:  s.startsAt.toISOString(),
      ends_at:    s.endsAt.toISOString(),
    })),
  })
}

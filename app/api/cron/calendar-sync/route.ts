import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { buildBookingEvent, buildProvider } from '@/lib/calendar'
import type { CalendarConnection } from '@/lib/calendar'
import { loadSchedule } from '@/lib/client-schedule'

/**
 * Daily repair and health check for connected calendars.
 *
 * Two faults live here, and both are silent by construction — the reason this project already
 * has a webhook-audit cron for exactly the same class of problem.
 *
 * 1. **An event that never got written.** /api/book-appointment creates the calendar event
 *    non-fatally, because the slot is already held and the caller is on the phone. That trade
 *    only works if something comes back for the failures.
 * 2. **A connection that has quietly died.** Reads fail closed, so a revoked token does not
 *    degrade anything visibly — it stops Ava booking for that client entirely, while callers
 *    keep hearing a working agent. That is precisely how the ten-day call outage looked.
 *
 * Alerts only on a problem, and only once per breakage (see `alerted_at`). A daily green mail,
 * or a daily nag about a known fault, both train you to ignore the sender.
 */

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface BookingRow {
  id:                   string
  client_domain:        string
  starts_at:            string
  ends_at:              string | null
  service_type:         string | null
  location:             string | null
  calendar_sync_status: string
  leads: { caller_name: string | null; caller_phone: string | null; caller_email: string | null; caller_address: string | null } | null
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connections, error: connError } = await supabase
    .from('calendar_connections')
    .select('*')

  if (connError) {
    // A cron that cannot run must say so. Silence from this route is supposed to mean "healthy",
    // and that only holds if a broken run is loud.
    console.error('[CALENDAR SYNC] ✗  Could not read connections:', connError.message)
    await notify(
      '⚠️ Calendar sync could not run',
      `<p>The daily calendar reconciler failed before it started.</p><pre>${escapeHtml(connError.message)}</pre>
       <p>Pending calendar events were NOT retried and connection health was NOT checked today.</p>`,
    )
    return NextResponse.json({ error: connError.message }, { status: 500 })
  }

  const rows = (connections ?? []) as CalendarConnection[]

  // No client has connected a calendar. Nothing to do and nothing wrong — this is where every
  // client starts.
  if (rows.length === 0) {
    console.log('[CALENDAR SYNC] ✓  No calendar connections to check.')
    return NextResponse.json({ ok: true, connections: 0 })
  }

  const broken: { domain: string; detail: string; connection: CalendarConnection }[] = []
  let repaired = 0
  let stillFailing = 0

  for (const connection of rows) {
    if (connection.status !== 'active') {
      broken.push({
        domain: connection.client_domain,
        detail: connection.last_error ?? `Connection status is "${connection.status}"`,
        connection,
      })
      continue
    }

    const provider = buildProvider(supabase, connection)

    // A one-minute free/busy read. Cheap, and it exercises the whole chain the phone line
    // depends on: decrypt → refresh if needed → authenticate → read.
    try {
      const now = new Date()
      await provider.busy({ from: now, to: new Date(now.getTime() + 60_000) })
    } catch (e) {
      broken.push({ domain: connection.client_domain, detail: (e as Error).message, connection })
      continue
    }

    // Retry the events that never landed. Only future ones: writing an event for an appointment
    // that has already happened is noise, not a repair.
    const { data: pending, error: pendingError } = await supabase
      .from('bookings')
      .select('id, client_domain, starts_at, ends_at, service_type, location, calendar_sync_status, leads(caller_name, caller_phone, caller_email, caller_address)')
      .eq('client_domain', connection.client_domain)
      .in('calendar_sync_status', ['pending', 'failed'])
      .gt('starts_at', new Date().toISOString())
      .limit(50)

    if (pendingError) {
      // The embedded `leads(...)` join is the fragile part of this query. A failure here returns
      // no rows, which looks exactly like "nothing to repair" — so it is reported rather than
      // left to read as success.
      console.error(`[CALENDAR SYNC] ✗  Could not list pending bookings for ${connection.client_domain}:`, pendingError.message)
      broken.push({
        domain: connection.client_domain,
        detail: `Calendar is reachable, but pending bookings could not be listed: ${pendingError.message}`,
        connection,
      })
      continue
    }

    const schedule = await loadSchedule(supabase, connection.client_domain)

    for (const booking of (pending ?? []) as unknown as BookingRow[]) {
      const startsAt = new Date(booking.starts_at)
      const endsAt = booking.ends_at
        ? new Date(booking.ends_at)
        : new Date(startsAt.getTime() + schedule.slot_duration_minutes * 60_000)

      try {
        const { id: eventId } = await provider.createEvent(buildBookingEvent({
          startsAt,
          endsAt,
          timeZone:      schedule.timezone,
          serviceType:   booking.service_type,
          location:      booking.location,
          callerName:    booking.leads?.caller_name,
          callerPhone:   booking.leads?.caller_phone,
          callerEmail:   booking.leads?.caller_email,
          callerAddress: booking.leads?.caller_address,
        }))

        await supabase
          .from('bookings')
          .update({
            calendar_event_id:    eventId,
            calendar_sync_status: 'synced',
            calendar_synced_at:   new Date().toISOString(),
          })
          .eq('id', booking.id)

        repaired++
        console.log(`[CALENDAR SYNC] ✓  Wrote missing event ${eventId} for booking ${booking.id}`)
      } catch (e) {
        // 'failed' rather than 'pending' after a retry has already been tried, so a booking that
        // keeps failing is distinguishable from one that has simply not been attempted yet.
        stillFailing++
        await supabase
          .from('bookings')
          .update({ calendar_sync_status: 'failed' })
          .eq('id', booking.id)
        console.error(`[CALENDAR SYNC] ✗  Booking ${booking.id} still failing:`, (e as Error).message)
      }
    }
  }

  // Only connections not already reported. Reconnecting clears `alerted_at`, so a genuinely new
  // breakage always alerts even if the previous one was reported yesterday.
  const unreported = broken.filter(b => !b.connection.alerted_at)

  if (unreported.length > 0) {
    const list = unreported.map(b => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);color:#F0F0F0;font-size:12px;">
          <strong>${escapeHtml(b.domain)}</strong><br>
          <span style="color:#94A3B8;">${escapeHtml(b.detail)}</span>
        </td>
      </tr>`).join('')

    await notify(
      `🚨 ${unreported.length} calendar connection(s) are down — Ava has stopped booking`,
      `<table style="width:100%;border-collapse:collapse;">${list}</table>
       <p style="color:#F87171;font-size:12px;margin-top:16px;">
         Availability reads fail closed, so for these clients Ava now takes a message instead of
         offering times. Callers still hear a working agent and no metric will show this.
       </p>
       <p style="color:#94A3B8;font-size:12px;">
         Fix: the owner reconnects from their dashboard. A revoked grant cannot be repaired from
         our side — it needs their consent again.
       </p>`,
    )

    await supabase
      .from('calendar_connections')
      .update({ alerted_at: new Date().toISOString() })
      .in('client_domain', unreported.map(b => b.domain))
  }

  const ok = broken.length === 0 && stillFailing === 0
  console.log(`[CALENDAR SYNC] ${ok ? '✓' : '⚠'}  ${rows.length} connection(s), ${repaired} event(s) repaired, ${stillFailing} still failing, ${broken.length} connection(s) down`)

  return NextResponse.json({
    ok,
    connections: rows.length,
    repaired,
    stillFailing,
    brokenConnections: broken.length,
    alerted: unreported.length,
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Resend reports API failures by RETURNING `{ error }`, it does not throw — a try/catch alone
 * swallows a rejected send. An alert that never arrives is indistinguishable from having nothing
 * to report, which is the exact failure this cron exists to prevent.
 */
async function notify(subject: string, bodyHtml: string) {
  try {
    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
      to:      'chris@369agenticsystems.com',
      subject,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#0A0A0A;color:#F0F0F0;padding:28px 24px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D4AF37;font-family:monospace;">369 Agentic Systems · Calendar Sync</p>
        ${bodyHtml}
      </div>`,
    })
    if (error) {
      console.error(`[CALENDAR SYNC] ✗  Alert email REJECTED by Resend: ${error.name} — ${error.message}`)
      return
    }
    console.log(`[CALENDAR SYNC] ✓  Alert email sent: ${subject}`)
  } catch (e) {
    console.error('[CALENDAR SYNC] ✗  Could not send alert email:', e)
  }
}

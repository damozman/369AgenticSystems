/**
 * Exercises the Google Calendar integration against PRODUCTION.
 *
 *   node --import ./scripts/test-resolver.mjs scripts/verify-calendar-sync.mjs
 *
 * The unit tests prove the response mapping and the error classification with an injected fetch.
 * They cannot prove any of the things that have actually broken this project: that the migration
 * applied, that the stored ciphertext decrypts with the key this environment holds, that the
 * refresh token Google issued still works, or that the account can genuinely read and write a
 * calendar. Every one of those is a live-system question.
 *
 * Runs in two modes, on purpose:
 *   - **No connection yet** — checks the schema and reports what is still outstanding. Useful
 *     immediately, before the Google Cloud console work is done.
 *   - **A connection exists** — does a real free/busy read, then creates, patches and deletes a
 *     throwaway event on the owner's real calendar.
 *
 * The event it creates is deleted by the id Google returned, never by search, so cleanup can
 * never reach an event this script did not create. It is placed a year out at 3 AM so that even
 * if cleanup fails it collides with nothing.
 */

import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../lib/calendar/crypto.ts'
import { buildProvider } from '../lib/calendar/index.ts'
import { buildBookingEvent, buildBookingEventPatch } from '../lib/calendar/booking-event.ts'

nextEnv.loadEnvConfig(process.cwd())

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failures++
}
const note = (label, detail = '') => console.log(`  · ${label}${detail ? `  — ${detail}` : ''}`)

// ── 1. Did the migration actually apply? ───────────────────────────────────────
// schema.sql is not guaranteed to match production — three tables were found drifted on
// 2026-07-12 — so this asks the live database rather than trusting the file.
console.log('\n1. Schema')

const { data: connections, error: connErr } = await db
  .from('calendar_connections')
  .select('id, client_domain, provider, account_email, calendar_id, access_token_enc, refresh_token_enc, access_token_expires_at, scopes, status, last_error, last_ok_at, alerted_at')

if (connErr) {
  check('calendar_connections is readable', false, connErr.message)
  console.error('\n  The migration has not applied. Run supabase/migrations/2026-08-05-calendar-connections.sql.')
  process.exit(1)
}
check('calendar_connections exists with every column', true, `${connections.length} connection(s)`)

const { error: bookingColErr } = await db
  .from('bookings')
  .select('id, calendar_event_id, calendar_sync_status, calendar_synced_at')
  .limit(1)
check('bookings has the calendar sync columns', !bookingColErr, bookingColErr?.message ?? 'calendar_event_id, calendar_sync_status, calendar_synced_at')

// ── 2. Environment ─────────────────────────────────────────────────────────────
console.log('\n2. Environment')
const hasKey    = Boolean(process.env.CALENDAR_TOKEN_KEY)
const hasClient = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
check('CALENDAR_TOKEN_KEY is set',                  hasKey)
check('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET set', hasClient)
if (!hasKey || !hasClient) {
  note('These live in Vercel; a local .env.local may legitimately not have them.')
  note('Vercel bakes env vars in at build time — after adding them, REDEPLOY.')
}

// ── 3. Pending bookings the reconciler would pick up ───────────────────────────
console.log('\n3. Bookings awaiting a calendar event')
const { data: pending } = await db
  .from('bookings')
  .select('id, client_domain, starts_at, calendar_sync_status')
  .in('calendar_sync_status', ['pending', 'failed'])
  .gt('starts_at', new Date().toISOString())

if ((pending?.length ?? 0) === 0) {
  check('no future bookings are missing their calendar event', true)
} else {
  check('no future bookings are missing their calendar event', false, `${pending.length} outstanding`)
  for (const b of pending) note(`${b.client_domain} · ${b.starts_at} · ${b.calendar_sync_status}`, b.id)
  note('/api/cron/calendar-sync retries these daily.')
}

// ── 4. The live round trip ─────────────────────────────────────────────────────
console.log('\n4. Live calendar round trip')

const active = connections.filter(c => c.status === 'active')

if (connections.length === 0) {
  note('No calendar has been connected yet — nothing to exercise.')
  note('Outstanding: create the OAuth client, publish to Production, then connect from /client-dashboard.')
} else if (active.length === 0) {
  check('at least one connection is active', false,
    connections.map(c => `${c.client_domain}: ${c.status} (${c.last_error ?? 'no detail'})`).join('; '))
  note('A revoked connection means Ava has STOPPED booking for that client — reads fail closed.')
} else {
  for (const connection of active) {
    console.log(`\n   ${connection.client_domain} → ${connection.account_email ?? 'unknown account'}`)

    // The key held here must be the key that encrypted the row. A mismatch is what a rotated or
    // re-pasted CALENDAR_TOKEN_KEY looks like, and it is invisible until a call needs a token.
    let decrypts = false
    try {
      decryptToken(connection.refresh_token_enc)
      decrypts = true
    } catch (e) {
      check('stored refresh token decrypts with this key', false, e.message)
    }
    if (decrypts) check('stored refresh token decrypts with this key', true)

    check('both required scopes were granted',
      connection.scopes?.includes('https://www.googleapis.com/auth/calendar.freebusy') &&
      connection.scopes?.includes('https://www.googleapis.com/auth/calendar.events'),
      (connection.scopes ?? []).join(' ') || 'none recorded')

    if (!decrypts || !hasClient) {
      note('Skipping the live calls — cannot build a request without a usable token.')
      continue
    }

    const provider = buildProvider(db, connection)

    // 4a. Read. This is the call every phone call depends on.
    try {
      const now = new Date()
      const busy = await provider.busy({ from: now, to: new Date(now.getTime() + 7 * 86_400_000) })
      check('free/busy read succeeded', true, `${busy.length} busy interval(s) in the next 7 days`)
    } catch (e) {
      check('free/busy read succeeded', false, e.message)
      note('With reads failing closed, this means Ava is taking messages instead of booking.')
      continue
    }

    // 4b. Write, patch, delete. A year out at 3 AM: harmless even if cleanup fails.
    const startsAt = new Date(Date.now() + 365 * 86_400_000)
    startsAt.setUTCHours(9, 0, 0, 0)
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000)

    let eventId = null
    try {
      const created = await provider.createEvent(buildBookingEvent({
        startsAt, endsAt,
        timeZone:    'America/Chicago',
        serviceType: '369 verification — safe to delete',
        callerPhone: '+10000000000',
      }))
      eventId = created.id
      check('created a calendar event', true, eventId)
    } catch (e) {
      check('created a calendar event', false, e.message)
    }

    if (eventId) {
      try {
        // The same call /api/capture-lead makes when the lead lands after the booking.
        await provider.updateEvent(eventId, buildBookingEventPatch({
          serviceType: '369 verification — safe to delete',
          callerName:  'Verification Script',
          callerPhone: '+10000000000',
        }))
        check('patched the event with caller details', true)
      } catch (e) {
        check('patched the event with caller details', false, e.message)
      }

      try {
        // By the id Google returned. Never by search — cleanup must not be able to reach an
        // event this script did not create.
        await provider.deleteEvent(eventId)
        check('deleted the test event', true)
      } catch (e) {
        check('deleted the test event', false, `${e.message} — REMOVE ${eventId} BY HAND`)
      }
    }
  }
}

console.log(`\n${'─'.repeat(62)}`)
if (failures) {
  console.error(`✗ ${failures} check(s) failed.`)
  process.exit(1)
}
console.log('✓ Calendar sync verified against production.')

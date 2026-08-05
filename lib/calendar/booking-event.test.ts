import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBookingEvent, buildBookingEventPatch } from './booking-event.ts'
import { openSlots, type ClientSchedule } from '../availability.ts'

const BASE = {
  startsAt: new Date('2026-08-12T15:00:00Z'),
  endsAt:   new Date('2026-08-12T16:00:00Z'),
  timeZone: 'America/Chicago',
}

test('the title leads with the service and who is coming', () => {
  const event = buildBookingEvent({ ...BASE, serviceType: 'Roof inspection', callerName: 'John Smith' })
  assert.equal(event.summary, 'Roof inspection — John Smith')
})

test('with no name yet the title uses the phone number', () => {
  // Ava books 27–41s before she captures the lead, so this is the *usual* first state — not an
  // edge case. "Appointment — Unknown Caller" would read as a bug.
  const event = buildBookingEvent({ ...BASE, callerPhone: '(817) 555-0123' })
  assert.equal(event.summary, 'Appointment — (817) 555-0123')
})

test('with neither name nor phone it degrades to the service alone', () => {
  const event = buildBookingEvent({ ...BASE, serviceType: 'Estimate' })
  assert.equal(event.summary, 'Estimate')
  assert.ok(!event.summary.includes('—'), 'no dangling separator')
})

test('blank strings count as absent, not as a name', () => {
  // capture-lead can write an empty string where the model had nothing to say.
  const event = buildBookingEvent({ ...BASE, callerName: '   ', callerPhone: '555' })
  assert.equal(event.summary, 'Appointment — 555')
})

test('the description carries what the owner needs to ring the caller back', () => {
  const event = buildBookingEvent({
    ...BASE,
    callerName: 'John Smith', callerPhone: '817-555-0123', callerEmail: 'j@example.com',
  })
  assert.match(event.description!, /John Smith/)
  assert.match(event.description!, /817-555-0123/)
  assert.match(event.description!, /j@example\.com/)
})

test('the description omits missing fields instead of printing blanks', () => {
  const event = buildBookingEvent({ ...BASE, callerPhone: '817-555-0123' })
  assert.ok(!/Email:/.test(event.description!))
  assert.ok(!/Address:/.test(event.description!))
})

test('location falls back to the caller address for on-site trades', () => {
  // For roofing, HVAC and plumbing the caller's address *is* the job site.
  const event = buildBookingEvent({ ...BASE, callerAddress: '12 Oak St, Fort Worth TX' })
  assert.equal(event.location, '12 Oak St, Fort Worth TX')

  const explicit = buildBookingEvent({ ...BASE, location: 'Main office', callerAddress: '12 Oak St' })
  assert.equal(explicit.location, 'Main office')
})

test('the patch rewrites the wording but never the times', () => {
  // The appointment did not move. Resending start/end would overwrite an adjustment the owner
  // made in their own calendar between the booking and the lead landing — so the patch builder
  // does not even accept them.
  const patch = buildBookingEventPatch({ serviceType: 'Roof inspection', callerName: 'John Smith' })
  assert.equal(patch.summary, 'Roof inspection — John Smith')
  assert.equal(patch.startsAt, undefined)
  assert.equal(patch.endsAt, undefined)
  assert.equal(patch.timeZone, undefined)
})

test('the patch omits location entirely rather than blanking it', () => {
  // Sending `location: undefined` would clear an address the owner typed in themselves.
  const patch = buildBookingEventPatch({ callerName: 'John Smith' })
  assert.ok(!('location' in patch))
})

// ── The point of the whole phase ──────────────────────────────────────────────

const schedule: ClientSchedule = {
  timezone: 'America/Chicago',
  business_hours: {
    mon: { open: '08:00', close: '17:00' }, tue: { open: '08:00', close: '17:00' },
    wed: { open: '08:00', close: '17:00' }, thu: { open: '08:00', close: '17:00' },
    fri: { open: '08:00', close: '17:00' }, sat: null, sun: null,
  },
  slot_duration_minutes: 60,
  max_concurrent_per_slot: 1,
  lead_time_hours: 0,
  booking_horizon_days: 1,
}

// Wednesday 2026-08-12, 07:00 CDT (UTC-5).
const WED_MORNING = new Date('2026-08-12T12:00:00Z')

test('a busy interval from the calendar suppresses the slot, exactly like a booking does', () => {
  // This is the bug the phase exists to fix: before it, the 09:00 slot below was offered to a
  // caller while the owner sat in a dentist's chair.
  const fromGoogle = [{ starts_at: '2026-08-12T14:00:00Z', ends_at: '2026-08-12T15:00:00Z' }] // 09:00 CDT

  const withCalendar = openSlots(schedule, fromGoogle, { now: WED_MORNING, limit: 4, perDay: 4 })
  const withoutCalendar = openSlots(schedule, [], { now: WED_MORNING, limit: 4, perDay: 4 })

  assert.ok(
    withoutCalendar.some(s => s.startsAt.toISOString() === '2026-08-12T14:00:00.000Z'),
    'the 09:00 slot is open when only the bookings table is consulted',
  )
  assert.ok(
    !withCalendar.some(s => s.startsAt.toISOString() === '2026-08-12T14:00:00.000Z'),
    'and closed once the owner’s own calendar is consulted',
  )
})

test('calendar and database busy intervals combine', () => {
  const fromDatabase = [{ starts_at: '2026-08-12T14:00:00Z', ends_at: '2026-08-12T15:00:00Z' }] // 09:00
  const fromGoogle   = [{ starts_at: '2026-08-12T15:00:00Z', ends_at: '2026-08-12T16:00:00Z' }] // 10:00

  const slots = openSlots(schedule, [...fromDatabase, ...fromGoogle], { now: WED_MORNING, limit: 4, perDay: 4 })
  const offered = slots.map(s => s.startsAt.toISOString())

  assert.ok(!offered.includes('2026-08-12T14:00:00.000Z'))
  assert.ok(!offered.includes('2026-08-12T15:00:00.000Z'))
  assert.ok(offered.includes('2026-08-12T16:00:00.000Z'), '11:00 is still free')
})

test('a Google interval expressed as a local offset is understood', () => {
  // Google returns RFC3339, which may carry an offset rather than Z. Misreading one as UTC
  // would blank the wrong five hours of the day.
  const offsetForm = [{ starts_at: '2026-08-12T09:00:00-05:00', ends_at: '2026-08-12T10:00:00-05:00' }]
  const slots = openSlots(schedule, offsetForm, { now: WED_MORNING, limit: 4, perDay: 4 })
  assert.ok(!slots.some(s => s.startsAt.toISOString() === '2026-08-12T14:00:00.000Z'))
})

test('an all-day event blocks the whole working day', () => {
  // Google renders these as midnight-to-midnight in the calendar's zone. The owner is on
  // holiday; Ava must offer nothing that day.
  const allDay = [{ starts_at: '2026-08-12T05:00:00Z', ends_at: '2026-08-13T05:00:00Z' }]
  const slots = openSlots(schedule, allDay, { now: WED_MORNING, limit: 4, perDay: 4 })
  const sameDay = slots.filter(s => s.startsAt.toISOString().startsWith('2026-08-12'))
  assert.equal(sameDay.length, 0)
})

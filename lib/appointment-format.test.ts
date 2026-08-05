import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAppointment } from './appointment-format.ts'

/**
 * The first test below is the verbatim booking that told a real customer the wrong day, on
 * 2026-08-05. Pinned here for the same reason lib/security/lead-sanitize.test.ts pins its real
 * payloads: the class of bug is easy to reintroduce, and the actual data is the proof.
 */

test('the real booking that shipped the wrong day', () => {
  // Northside, booked Thursday August 6th at 9:00 AM Central. The customer was emailed
  // "Wednesday, August 5 at 9:00 AM" — a day early — because the formatter read
  // appointment_date ("2026-08-06T00:00:00", no offset) as a UTC instant and rendered it in
  // Chicago, landing at 7pm on the 5th.
  const booking = {
    starts_at:        '2026-08-06T14:00:00+00:00',
    appointment_date: '2026-08-06T00:00:00',
    appointment_time: '9:00 AM',
  }

  const when = formatAppointment(booking, 'America/Chicago')
  assert.equal(when.date, 'Thursday, August 6')
  assert.equal(when.time, '9:00 AM')
})

test('appointment_date alone never shifts the day', () => {
  // The legacy path, for rows predating starts_at. Building and formatting both in UTC is what
  // makes this immune — the previous code did one in the server's zone and the other in Chicago.
  const when = formatAppointment(
    { appointment_date: '2026-08-06T00:00:00', appointment_time: '9:00 AM' },
    'America/Chicago',
  )
  assert.equal(when.date, 'Thursday, August 6')
  assert.equal(when.time, '9:00 AM')
})

test('starts_at wins over appointment_date when they disagree', () => {
  // starts_at is the timestamptz and the one book_slot() enforced capacity against. If the prose
  // columns ever drift, the instant is the truth.
  const when = formatAppointment(
    { starts_at: '2026-08-06T14:00:00Z', appointment_date: '2026-01-01T00:00:00', appointment_time: '3:00 PM' },
    'America/Chicago',
  )
  assert.equal(when.date, 'Thursday, August 6')
  assert.equal(when.time, '9:00 AM')
})

test('the client timezone is honoured, not assumed to be Chicago', () => {
  // The old formatter hardcoded America/Chicago. Telling a caller in Phoenix an hour that only
  // makes sense in Chicago is the same class of error as the date bug.
  const booking = { starts_at: '2026-08-06T14:00:00Z' }
  assert.equal(formatAppointment(booking, 'America/Chicago').time,  '9:00 AM')
  assert.equal(formatAppointment(booking, 'America/New_York').time, '10:00 AM')
  assert.equal(formatAppointment(booking, 'America/Phoenix').time,  '7:00 AM')
  assert.equal(formatAppointment(booking, 'America/Los_Angeles').time, '7:00 AM')
})

test('an appointment either side of midnight lands on the right day', () => {
  // 00:30 UTC on the 7th is still the evening of the 6th in Chicago. Getting this backwards is
  // exactly how the original bug printed the previous day.
  const late = formatAppointment({ starts_at: '2026-08-07T00:30:00Z' }, 'America/Chicago')
  assert.equal(late.date, 'Thursday, August 6')
  assert.equal(late.time, '7:30 PM')
})

test('date and time cannot disagree, because both come from the same instant', () => {
  const when = formatAppointment({ starts_at: '2026-11-01T06:30:00Z' }, 'America/Chicago')
  // The fall-back Sunday: 06:30Z is 01:30 CDT, the first pass through the repeated hour.
  assert.equal(when.date, 'Sunday, November 1')
  assert.equal(when.time, '1:30 AM')
})

test('an unparseable starts_at falls through instead of throwing', () => {
  // A confirmation that renders "Invalid Date" is worse than one built from the prose columns.
  const when = formatAppointment(
    { starts_at: 'not-a-date', appointment_date: '2026-08-06T00:00:00', appointment_time: '9:00 AM' },
    'America/Chicago',
  )
  assert.equal(when.date, 'Thursday, August 6')
  assert.equal(when.time, '9:00 AM')
})

test('a booking with nothing usable degrades quietly', () => {
  const when = formatAppointment({}, 'America/Chicago')
  assert.equal(when.date, '')
  assert.equal(when.time, '')
})

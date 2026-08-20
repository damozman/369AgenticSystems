import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateSlots,
  generateRentalWindows,
  filterAvailable,
  openSlots,
  formatSlot,
  zonedWallClockToUtc,
  parseSpokenTime,
  resolveAppointmentStart,
  type ClientSchedule,
} from './availability.ts'

/**
 * The route these replace invented its slots — hardcoded 10:00 AM and 2:00 PM, Mon–Fri, always
 * America/Chicago, never consulting the bookings table. Every test below is aimed at something
 * that route got wrong, or at arithmetic that would silently produce a real double-booking.
 */

const schedule = (over: Partial<ClientSchedule> = {}): ClientSchedule => ({
  timezone: 'America/Chicago',
  business_hours: {
    mon: { open: '08:00', close: '17:00' },
    tue: { open: '08:00', close: '17:00' },
    wed: { open: '08:00', close: '17:00' },
    thu: { open: '08:00', close: '17:00' },
    fri: { open: '08:00', close: '17:00' },
    sat: null,
    sun: null,
  },
  slot_duration_minutes: 60,
  max_concurrent_per_slot: 1,
  lead_time_hours: 0,
  booking_horizon_days: 1,
  ...over,
})

// Monday 2026-01-05, 06:00 CST. Chicago is UTC-6 in January.
const MON_JAN_5 = new Date('2026-01-05T12:00:00Z')

test('opening time is the client\'s wall clock, not the server\'s', () => {
  const [first] = generateSlots(schedule(), MON_JAN_5)
  // 08:00 CST === 14:00 UTC.
  assert.equal(first.startsAt.toISOString(), '2026-01-05T14:00:00.000Z')
  assert.equal(first.endsAt.toISOString(), '2026-01-05T15:00:00.000Z')
})

test('DST is resolved at the instant, not assumed — the same 08:00 is an hour earlier in UTC', () => {
  // Monday 2026-03-09, the day after US spring-forward (Sunday 2026-03-08). Chicago is now
  // UTC-5, so the identical "08:00" opening is 13:00 UTC rather than 14:00. A fixed offset
  // would put every appointment in this week an hour wrong.
  const [first] = generateSlots(schedule(), new Date('2026-03-09T11:00:00Z'))
  assert.equal(first.startsAt.toISOString(), '2026-03-09T13:00:00.000Z')
})

test('a different timezone actually changes the answer', () => {
  const [first] = generateSlots(schedule({ timezone: 'America/New_York' }), MON_JAN_5)
  // 08:00 EST === 13:00 UTC.
  assert.equal(first.startsAt.toISOString(), '2026-01-05T13:00:00.000Z')
})

test('closed days produce no slots', () => {
  // Saturday 2026-01-10. Horizon of 1 day keeps this to the weekend.
  const slots = generateSlots(schedule(), new Date('2026-01-10T12:00:00Z'))
  assert.equal(slots.length, 0, 'Sat and Sun are null in the schedule')
})

test('a slot must finish by closing time', () => {
  const slots = generateSlots(schedule({ slot_duration_minutes: 90 }), MON_JAN_5)
  const last = slots[slots.length - 1]
  // 08:00 + 90-minute slots: the last one that fits before 17:00 starts at 15:30, not 16:00.
  assert.equal(formatSlot(last, 'America/Chicago'), 'Monday, January 5th, 2026 at 3:30 PM')
})

test('lead time excludes slots too soon to be real', () => {
  // 06:00 CST + 4 hours means nothing before 10:00 CST may be offered.
  const slots = generateSlots(schedule({ lead_time_hours: 4 }), MON_JAN_5)
  assert.equal(slots[0].startsAt.toISOString(), '2026-01-05T16:00:00.000Z') // 10:00 CST
})

test('a booked slot is not offered again — the double-booking this whole change exists to stop', () => {
  const slots = generateSlots(schedule(), MON_JAN_5)
  const available = filterAvailable(
    slots,
    [{ starts_at: '2026-01-05T14:00:00Z', ends_at: '2026-01-05T15:00:00Z' }],
    1,
    60,
  )
  assert.equal(available[0].startsAt.toISOString(), '2026-01-05T15:00:00.000Z')
  assert.ok(
    !available.some(s => s.startsAt.toISOString() === '2026-01-05T14:00:00.000Z'),
    '08:00 was booked and must not be offered',
  )
})

test('capacity above 1 keeps the slot open — a roofer with three crews takes three', () => {
  const slots = generateSlots(schedule({ max_concurrent_per_slot: 3 }), MON_JAN_5)
  const available = filterAvailable(
    slots,
    [{ starts_at: '2026-01-05T14:00:00Z', ends_at: '2026-01-05T15:00:00Z' }],
    3,
    60,
  )
  assert.equal(available[0].startsAt.toISOString(), '2026-01-05T14:00:00.000Z')
})

test('capacity is consumed by overlap, not by an identical start time', () => {
  // A 90-minute job starting at 08:00 runs into the 09:00 slot. Equality-matching would
  // happily offer 09:00 and send two crews out.
  const slots = generateSlots(schedule(), MON_JAN_5)
  const available = filterAvailable(
    slots,
    [{ starts_at: '2026-01-05T14:00:00Z', ends_at: '2026-01-05T15:30:00Z' }],
    1,
    60,
  )
  assert.equal(available[0].startsAt.toISOString(), '2026-01-05T16:00:00.000Z') // 10:00 CST
})

test('back-to-back is not a collision', () => {
  // An appointment ending exactly at 09:00 must not block the 09:00 slot, or a full day
  // silently becomes a half day.
  const slots = generateSlots(schedule(), MON_JAN_5)
  const available = filterAvailable(
    slots,
    [{ starts_at: '2026-01-05T14:00:00Z', ends_at: '2026-01-05T15:00:00Z' }],
    1,
    60,
  )
  assert.ok(available.some(s => s.startsAt.toISOString() === '2026-01-05T15:00:00.000Z'))
})

test('a booking with no end date still holds its slot', () => {
  // Rows predating starts_at/ends_at can arrive with a null end. Treating that as zero-length
  // would make it collide with nothing and quietly free up a taken slot.
  const slots = generateSlots(schedule(), MON_JAN_5)
  const available = filterAvailable(slots, [{ starts_at: '2026-01-05T14:00:00Z', ends_at: null }], 1, 60)
  assert.equal(available[0].startsAt.toISOString(), '2026-01-05T15:00:00.000Z')
})

test('offers are spread across days rather than four times in one morning', () => {
  const slots = openSlots(schedule({ booking_horizon_days: 7 }), [], { now: MON_JAN_5, limit: 4, perDay: 2 })
  assert.equal(slots.length, 4)
  const days = new Set(slots.map(s => s.startsAt.toISOString().slice(0, 10)))
  assert.equal(days.size, 2, 'two options on each of two days')
})

test('one open day still fills the full offer rather than returning two', () => {
  // Only Monday is open, so spreading is impossible — offering fewer times would be worse.
  const onlyMonday = schedule({
    business_hours: { mon: { open: '08:00', close: '17:00' } },
    booking_horizon_days: 1,
  })
  const slots = openSlots(onlyMonday, [], { now: MON_JAN_5, limit: 4, perDay: 2 })
  assert.equal(slots.length, 4)
})

test('the spoken slot keeps its year — a real booking landed in 2025 without it', () => {
  const [first] = generateSlots(schedule(), MON_JAN_5)
  const spoken = formatSlot(first, 'America/Chicago')
  assert.equal(spoken, 'Monday, January 5th, 2026 at 8:00 AM')
  assert.match(spoken, /2026/, 'the LLM has no other grounding for the current year')
})

test('every real wall-clock time round-trips across both DST transitions', () => {
  // The conversion is hand-rolled on Intl, so the transition days are pinned explicitly:
  // an hour of drift here books every appointment in that week at the wrong time.
  const cases: [string, [number, number, number, number, number], string][] = [
    ['CST',                    [2026,  1,  5, 8, 0], '2026-01-05T14:00:00.000Z'],
    ['spring-forward day',     [2026,  3,  8, 8, 0], '2026-03-08T13:00:00.000Z'],
    ['CDT',                    [2026,  3,  9, 8, 0], '2026-03-09T13:00:00.000Z'],
    ['fall-back day',          [2026, 11,  1, 8, 0], '2026-11-01T14:00:00.000Z'],
    // 01:30 happens twice on fall-back day; the first occurrence (still CDT) is chosen.
    ['ambiguous repeated hour',[2026, 11,  1, 1,30], '2026-11-01T06:30:00.000Z'],
  ]
  for (const [label, [y, mo, d, h, mi], expected] of cases) {
    const actual = zonedWallClockToUtc({ year: y, month: mo, day: d }, h, mi, 'America/Chicago')
    assert.equal(actual.toISOString(), expected, label)
  }
})

test('the time Ava speaks is parsed, not guessed', () => {
  assert.equal(parseSpokenTime('2:00 PM'), 14 * 60)
  assert.equal(parseSpokenTime('2 pm'),    14 * 60)
  assert.equal(parseSpokenTime('14:00'),   14 * 60)
  assert.equal(parseSpokenTime('8:30 AM'),  8 * 60 + 30)
  assert.equal(parseSpokenTime('12:00 AM'), 0,          'midnight, not noon')
  assert.equal(parseSpokenTime('12:00 PM'), 12 * 60,    'noon, not midnight')
})

test('an unparseable time is rejected rather than defaulting to midnight', () => {
  // Silently landing on 00:00 would book a real customer for the middle of the night.
  for (const bad of ['', 'sometime tomorrow', '25:00', '2:75 PM', 'afternoon', '13 pm']) {
    assert.equal(parseSpokenTime(bad), null, `"${bad}" must not parse`)
  }
})

test('date + spoken time resolve to a real instant in the client\'s zone', () => {
  const start = resolveAppointmentStart('2026-01-05', '2:00 PM', 'America/Chicago')
  assert.equal(start?.toISOString(), '2026-01-05T20:00:00.000Z') // 14:00 CST
})

test('a full timestamp in appointment_date contributes only its calendar date', () => {
  // The column is a bare TIMESTAMP, so its time part is noise — the wall-clock time must come
  // from appointment_time or the booking lands hours off.
  const start = resolveAppointmentStart('2026-01-05T00:00:00.000Z', '2:00 PM', 'America/Chicago')
  assert.equal(start?.toISOString(), '2026-01-05T20:00:00.000Z')
})

test('a bad date or time yields null so the route can refuse the booking', () => {
  assert.equal(resolveAppointmentStart('next Tuesday', '2:00 PM', 'America/Chicago'), null)
  assert.equal(resolveAppointmentStart('2026-01-05', 'afternoon', 'America/Chicago'), null)
})

test('a wall-clock time that does not exist resolves backwards, not into the gap', () => {
  // 02:30 on 2026-03-08 never happens — Chicago jumps 02:00 CST straight to 03:00 CDT. The
  // convention is to land on the last valid instant before the gap (01:30 local) rather than
  // throw. Pinned because it is a silent behaviour: it can only be reached by a client whose
  // hours span 2 AM on the one Sunday a year the clock moves.
  const instant = zonedWallClockToUtc({ year: 2026, month: 3, day: 8 }, 2, 30, 'America/Chicago')
  assert.equal(instant.toISOString(), '2026-03-08T07:30:00.000Z')
})

test('malformed hours close the day instead of throwing', () => {
  const slots = generateSlots(schedule({
    business_hours: { mon: { open: 'half past eight', close: '17:00' } },
  }), MON_JAN_5)
  assert.equal(slots.length, 0)
})

test('a close time that is not after the open time closes the day', () => {
  const slots = generateSlots(schedule({
    business_hours: { mon: { open: '17:00', close: '08:00' } },
  }), MON_JAN_5)
  assert.equal(slots.length, 0, 'overnight shifts are not supported and must not silently invert')
})


/**
 * Multi-day rental windows.
 *
 * The bug these exist to prevent is specific and was live: a bounce house booked Saturday 10:00
 * for 90 minutes read as FREE at noon, while it was physically at a party until Sunday. Every
 * test below is aimed at that class of error — a unit being offered while it is out.
 */

const rentalSchedule = (over: Partial<ClientSchedule> = {}): ClientSchedule => schedule({
  business_hours: {
    mon: { open: '08:00', close: '17:00' },
    tue: { open: '08:00', close: '17:00' },
    wed: { open: '08:00', close: '17:00' },
    thu: { open: '08:00', close: '17:00' },
    fri: { open: '08:00', close: '17:00' },
    sat: { open: '09:00', close: '15:00' },
    sun: { open: '09:00', close: '15:00' },
  },
  lead_time_hours: 0,
  booking_horizon_days: 30,
  ...over,
})

test('a rental window spans days rather than collapsing into one', () => {
  const now = new Date('2026-09-01T12:00:00Z') // Tuesday
  const [first] = generateRentalWindows(rentalSchedule(), 3, now)

  assert.ok(first, 'expected at least one window')
  const spanMs = first.endsAt.getTime() - first.startsAt.getTime()
  assert.ok(spanMs > 2 * 86_400_000, `window spanned only ${spanMs}ms — day-bounded regression`)
})

test('the whole span is busy, so an overlapping day is not offered again', () => {
  const now = new Date('2026-09-01T12:00:00Z')
  const windows = generateRentalWindows(rentalSchedule(), 2, now)
  const taken = windows[0]

  // One unit, already out on that window. Every window touching it must disappear.
  const free = filterAvailable(
    windows,
    [{ starts_at: taken.startsAt, ends_at: taken.endsAt }],
    1,
    60,
  )

  for (const w of free) {
    const overlaps = w.startsAt < taken.endsAt && w.endsAt > taken.startsAt
    assert.ok(!overlaps, `offered ${w.startsAt.toISOString()} while the unit is still out`)
  }
})

test('a window is not offered when the return day is closed', () => {
  // Yard shut at weekends: a Friday start returning Saturday has nobody to receive it.
  const weekdaysOnly = rentalSchedule({
    business_hours: {
      mon: { open: '08:00', close: '17:00' },
      tue: { open: '08:00', close: '17:00' },
      wed: { open: '08:00', close: '17:00' },
      thu: { open: '08:00', close: '17:00' },
      fri: { open: '08:00', close: '17:00' },
      sat: null,
      sun: null,
    },
  })
  const now = new Date('2026-09-01T12:00:00Z')

  for (const w of generateRentalWindows(weekdaysOnly, 1, now)) {
    const returnDay = w.endsAt.getUTCDay()
    assert.ok(returnDay !== 0 && returnDay !== 6, `returns on a closed day: ${w.endsAt.toISOString()}`)
  }
})

test('a zero or negative hire is refused rather than producing a backwards window', () => {
  const now = new Date('2026-09-01T12:00:00Z')
  assert.equal(generateRentalWindows(rentalSchedule(), 0, now).length, 0)
  assert.equal(generateRentalWindows(rentalSchedule(), -2, now).length, 0)
})

test('lead time is respected — nothing leaves the yard sooner than allowed', () => {
  const now = new Date('2026-09-01T12:00:00Z')
  const s = rentalSchedule({ lead_time_hours: 48 })
  const earliest = now.getTime() + 48 * 3_600_000

  for (const w of generateRentalWindows(s, 2, now)) {
    assert.ok(w.startsAt.getTime() >= earliest, `window starts inside the lead time: ${w.startsAt.toISOString()}`)
  }
})

test('a hire may finish past the horizon, but may not START past it', () => {
  const now = new Date('2026-09-01T12:00:00Z')
  const s = rentalSchedule({ booking_horizon_days: 7 })
  const horizonEnd = now.getTime() + 7 * 86_400_000

  const windows = generateRentalWindows(s, 5, now)
  assert.ok(windows.length > 0, 'expected windows inside a 7-day horizon')
  for (const w of windows) {
    assert.ok(w.startsAt.getTime() <= horizonEnd, 'started past the horizon')
  }
  // The horizon caps how far ahead you may book, not how long you may keep the unit.
  assert.ok(
    windows.some(w => w.endsAt.getTime() > horizonEnd),
    'no window ran past the horizon — a long hire near the edge is being wrongly dropped',
  )
})

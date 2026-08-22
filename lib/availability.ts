/**
 * Real appointment availability.
 *
 * Everything here is pure — a schedule plus a list of already-booked intervals in, open slots
 * out — so it is unit-testable without a database or a phone call. That matters: the route this
 * replaces invented its slots, and the only honest way to prove the replacement doesn't is to
 * test the arithmetic directly.
 *
 * No date library. Timezone conversion is done with `Intl`, which ships with Node and the
 * browser, rather than adding a dependency for the handful of conversions below.
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

/** Local wall-clock hours, "HH:MM" in the client's own timezone. */
export interface DayHours {
  open: string
  close: string
}

/** A day mapped to null is closed. */
export type BusinessHours = Partial<Record<Weekday, DayHours | null>>

export interface ClientSchedule {
  timezone: string
  business_hours: BusinessHours
  slot_duration_minutes: number
  max_concurrent_per_slot: number
  lead_time_hours: number
  booking_horizon_days: number
}

/** An appointment already on the books. Anything overlapping consumes capacity. */
export interface BusyInterval {
  starts_at: string | Date
  ends_at: string | Date | null
}

export interface Slot {
  startsAt: Date
  endsAt: Date
}

/** Sunday-indexed, matching `Date.prototype.getUTCDay()`. */
const WEEKDAY_KEYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export interface CivilDate {
  year: number
  month: number // 1-12
  day: number
}

/**
 * The offset, in ms, between UTC and `timeZone` at a given instant.
 *
 * Formats the instant as local wall-clock time in the zone, reads that back as though it were
 * UTC, and takes the difference. This is the standard Intl-only approach and it is DST-correct
 * because the offset is resolved *at that instant* rather than assumed.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    // hourCycle h23 rather than hour12:false — the latter renders midnight as "24" in some
    // ICU versions, which parses into the wrong day.
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)

  const at = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0')

  const asIfUtc = Date.UTC(
    at('year'), at('month') - 1, at('day'),
    at('hour'), at('minute'), at('second'),
  )
  return asIfUtc - instant.getTime()
}

/**
 * A wall-clock time in `timeZone` → the real UTC instant.
 *
 * Resolved twice because the first offset is a guess: converting 2:30 AM on a spring-forward
 * date with the pre-transition offset lands on the far side of the jump, and the second pass
 * corrects it.
 *
 * Verified against both 2026 US transitions: every real wall-clock time round-trips exactly,
 * and the ambiguous hour repeated at fall-back resolves to its first occurrence. A wall-clock
 * time that does not exist at all — 02:30 on a spring-forward Sunday, where the clock jumps
 * 02:00 → 03:00 — resolves backwards to the last valid instant before the gap (01:30 local)
 * rather than throwing. Deterministic either way, and unreachable in practice: it needs a
 * client whose business hours span 2 AM on the one Sunday a year the clock moves.
 */
export function zonedWallClockToUtc(
  date: CivilDate,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(date.year, date.month - 1, date.day, hours, minutes)
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone)
  const corrected = naive - zoneOffsetMs(new Date(firstPass), timeZone)
  return new Date(corrected)
}

/** The calendar date at `instant` as seen in `timeZone` — not the UTC date. */
export function civilDateInZone(instant: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant)
  const at = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0')
  return { year: at('year'), month: at('month'), day: at('day') }
}

/**
 * Civil-date arithmetic, done in UTC deliberately. A calendar date has no timezone, so adding
 * a day to one is exact — no DST to trip over. Only the final wall-clock → instant conversion
 * needs to care about the zone.
 */
function addCivilDays(date: CivilDate, days: number): CivilDate {
  const t = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}

function weekdayOf(date: CivilDate): Weekday {
  return WEEKDAY_KEYS[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()]
}

/** "HH:MM" → minutes past midnight, or null if unparseable. */
function parseWallClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? '')
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Every slot the schedule allows between `now + lead_time` and the booking horizon,
 * before capacity is considered.
 *
 * A day whose `close` is not after its `open` is treated as closed. Overnight shifts that wrap
 * past midnight are not supported — no vertical here books them, and silently generating slots
 * on the wrong calendar day would be worse than not offering them.
 */
export function generateSlots(schedule: ClientSchedule, now: Date = new Date()): Slot[] {
  const durationMs = schedule.slot_duration_minutes * 60_000
  if (durationMs <= 0) return []

  const earliest = new Date(now.getTime() + schedule.lead_time_hours * 3_600_000)
  const horizonEnd = new Date(now.getTime() + schedule.booking_horizon_days * 86_400_000)

  const slots: Slot[] = []
  let civil = civilDateInZone(earliest, schedule.timezone)

  // +1 so the horizon's final day is fully considered rather than cut off mid-afternoon.
  for (let i = 0; i <= schedule.booking_horizon_days + 1; i++) {
    const hours = schedule.business_hours?.[weekdayOf(civil)]
    if (hours) {
      const openMin = parseWallClock(hours.open)
      const closeMin = parseWallClock(hours.close)

      if (openMin !== null && closeMin !== null && closeMin > openMin) {
        const dayOpen = zonedWallClockToUtc(civil, 0, openMin, schedule.timezone)
        const dayClose = zonedWallClockToUtc(civil, 0, closeMin, schedule.timezone)

        for (let start = dayOpen.getTime(); start + durationMs <= dayClose.getTime(); start += durationMs) {
          const startsAt = new Date(start)
          // A slot must finish before close, start no earlier than the lead time, and fall
          // inside the horizon.
          if (startsAt >= earliest && startsAt <= horizonEnd) {
            slots.push({ startsAt, endsAt: new Date(start + durationMs) })
          }
        }
      }
    }
    civil = addCivilDays(civil, 1)
  }

  return slots
}

/**
 * A multi-day rental window: pick the item up on one open day, bring it back on a later one.
 *
 * Deliberately a SEPARATE function from `generateSlots` rather than a flag on it. The two answer
 * different questions — `generateSlots` asks "when can someone come to you", this asks "when can
 * this unit leave the yard and when is it back" — and every existing client books the former.
 * Keeping them apart means nothing a roofer, attorney or plumber does can change shape, which is
 * the same load-bearing property `verify-inventory.mjs` already guards for items generally.
 *
 * Shape of a window:
 *   - It STARTS at `open` on a day the business is open, because that is when a unit can be
 *     collected or delivered.
 *   - It ENDS at `close` on the return day, `days` later. The unit is unavailable for that whole
 *     span — a dumpster in someone's driveway on Saturday is not available on Sunday, which is
 *     precisely what day-bounded slots got wrong.
 *   - The return day must itself be open. Nobody takes a return on a day the yard is shut, and
 *     offering one books a unit back in when there is no one there to receive it.
 *
 * `days` is counted as nights out: `days: 1` leaves Friday morning and returns Saturday at close.
 * The result is a plain `Slot`, so `filterAvailable` works on it unchanged — that function is
 * overlap-based and duration-agnostic, so a 3-day window collides with anything touching it.
 */
export function generateRentalWindows(
  schedule: ClientSchedule,
  days: number,
  now: Date = new Date(),
): Slot[] {
  if (!Number.isFinite(days) || days < 1) return []

  const earliest = new Date(now.getTime() + schedule.lead_time_hours * 3_600_000)
  const horizonEnd = new Date(now.getTime() + schedule.booking_horizon_days * 86_400_000)

  const windows: Slot[] = []
  let civil = civilDateInZone(earliest, schedule.timezone)

  // +1 so a window that starts on the horizon's final day is still considered, matching
  // generateSlots. A window may legitimately END past the horizon — the horizon governs how far
  // ahead someone may BOOK, not how long they may keep the unit.
  for (let i = 0; i <= schedule.booking_horizon_days + 1; i++) {
    const startHours = schedule.business_hours?.[weekdayOf(civil)]

    if (startHours) {
      const openMin = parseWallClock(startHours.open)

      if (openMin !== null) {
        const returnCivil = addCivilDays(civil, days)
        const returnHours = schedule.business_hours?.[weekdayOf(returnCivil)]
        const closeMin = returnHours ? parseWallClock(returnHours.close) : null

        // A closed return day disqualifies the window rather than sliding it, because sliding
        // silently gives the customer a longer hire than they asked for — and on a rate card
        // that is a day they were not quoted.
        if (returnHours && closeMin !== null) {
          const startsAt = zonedWallClockToUtc(civil, 0, openMin, schedule.timezone)
          const endsAt = zonedWallClockToUtc(returnCivil, 0, closeMin, schedule.timezone)

          if (startsAt >= earliest && startsAt <= horizonEnd && endsAt > startsAt) {
            windows.push({ startsAt, endsAt })
          }
        }
      }
    }

    civil = addCivilDays(civil, 1)
  }

  return windows
}

function toTime(value: string | Date | null): number | null {
  if (!value) return null
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Drop slots already at capacity.
 *
 * Overlap, not equality: a 60-minute job starting halfway through another one still collides,
 * which is what happens as soon as anyone changes `slot_duration_minutes`. A busy interval
 * with no end is treated as one slot long — the safe reading, since assuming zero length would
 * make it collide with nothing.
 */
export function filterAvailable(
  slots: Slot[],
  busy: BusyInterval[],
  maxConcurrent: number,
  slotDurationMinutes: number,
): Slot[] {
  const capacity = Math.max(1, maxConcurrent)

  const intervals = busy
    .map(b => {
      const start = toTime(b.starts_at)
      if (start === null) return null
      const end = toTime(b.ends_at) ?? start + slotDurationMinutes * 60_000
      return { start, end }
    })
    .filter((b): b is { start: number; end: number } => b !== null)

  return slots.filter(slot => {
    const start = slot.startsAt.getTime()
    const end = slot.endsAt.getTime()
    // Half-open [start, end): an appointment ending at 10:00 does not collide with one
    // starting at 10:00.
    const taken = intervals.filter(b => b.start < end && start < b.end).length
    return taken < capacity
  })
}

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/**
 * The spoken form Ava reads back, e.g. "Monday, August 10th, 2026 at 10:00 AM".
 *
 * The year is deliberate and must stay. Without it the LLM has no grounding for the current
 * year anywhere in the conversation and has to guess when it later builds book_appointment's
 * arguments — confirmed on a real booking, where it guessed 2025 instead of 2026.
 */
/**
 * A multi-day hire, said out loud.
 *
 * `formatSlot` speaks only the start, which for a rental would state the collection day and
 * silently drop the return — the single most important number on a hire, and the one the price
 * depends on. This says both ends and the night count, so a caller cannot agree to a window
 * without hearing how long they actually have it.
 */
export function formatRentalWindow(slot: Slot, timeZone: string): string {
  const on = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).format(d)

  const dayPhrase = (d: Date) =>
    `${on(d, { weekday: 'long' })}, ${on(d, { month: 'long' })} ${ordinal(Number(on(d, { day: 'numeric' })))}`

  // Counted from the civil days in the client's own zone, not from elapsed milliseconds — a
  // DST change would otherwise turn three nights into "2.96 days" and round it to two.
  const startCivil = civilDateInZone(slot.startsAt, timeZone)
  const endCivil = civilDateInZone(slot.endsAt, timeZone)
  const nights = Math.round(
    (Date.UTC(endCivil.year, endCivil.month - 1, endCivil.day) -
     Date.UTC(startCivil.year, startCivil.month - 1, startCivil.day)) / 86_400_000,
  )

  const unit = nights === 1 ? 'day' : 'days'
  return `${dayPhrase(slot.startsAt)} through ${dayPhrase(slot.endsAt)} — ${nights} ${unit}`
}

export function formatSlot(slot: Slot, timeZone: string): string {
  const on = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).format(slot.startsAt)

  const weekday = on({ weekday: 'long' })
  const month = on({ month: 'long' })
  const day = Number(on({ day: 'numeric' }))
  const year = on({ year: 'numeric' })
  const time = on({ hour: 'numeric', minute: '2-digit', hour12: true })

  return `${weekday}, ${month} ${ordinal(day)}, ${year} at ${time}`
}

/**
 * "2:00 PM" / "2 PM" / "14:00" → minutes past midnight.
 *
 * Ava sends this as free text, so it is parsed rather than trusted. Returns null on anything
 * unrecognised so the caller can reject the booking instead of silently landing on midnight —
 * a booking at the wrong time is worse than a booking that visibly failed.
 */
export function parseSpokenTime(value: string): number | null {
  const text = (value ?? '').trim().toLowerCase()
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text)
  if (!m) return null

  let hours = Number(m[1])
  const minutes = m[2] ? Number(m[2]) : 0
  const meridiem = m[3]

  if (minutes > 59) return null

  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    if (meridiem === 'pm' && hours !== 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0
  } else if (hours > 23) {
    return null
  }

  return hours * 60 + minutes
}

/**
 * The date and time Ava reports → a real instant in the client's timezone.
 *
 * `appointment_date` arrives as either a plain date ("2026-01-05") or a full timestamp whose
 * time part is meaningless; only its calendar date is used, with the wall-clock time coming
 * from `appointment_time`. Returns null if either part is unparseable.
 */
export function resolveAppointmentStart(
  appointmentDate: string,
  appointmentTime: string,
  timeZone: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec((appointmentDate ?? '').trim())
  if (!dateMatch) return null

  const minutes = parseSpokenTime(appointmentTime)
  if (minutes === null) return null

  return zonedWallClockToUtc(
    { year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]) },
    0,
    minutes,
    timeZone,
  )
}

/**
 * The composed entry point: the next `limit` genuinely open slots.
 *
 * Spread across days rather than handing back the first four consecutive slots of one morning —
 * offering "10:00, 11:00, 12:00, 1:00 on Tuesday" is a worse conversation than two options on
 * each of two days, and it collapses to a single day anyway when only one day has openings.
 */
export function openSlots(
  schedule: ClientSchedule,
  busy: BusyInterval[],
  options: { now?: Date; limit?: number; perDay?: number } = {},
): Slot[] {
  const { now = new Date(), limit = 4, perDay = 2 } = options

  const available = filterAvailable(
    generateSlots(schedule, now),
    busy,
    schedule.max_concurrent_per_slot,
    schedule.slot_duration_minutes,
  )

  const takenPerDay = new Map<string, number>()
  const spread: Slot[] = []

  for (const slot of available) {
    if (spread.length >= limit) break
    const civil = civilDateInZone(slot.startsAt, schedule.timezone)
    const key = `${civil.year}-${civil.month}-${civil.day}`
    const used = takenPerDay.get(key) ?? 0
    if (used >= perDay) continue
    takenPerDay.set(key, used + 1)
    spread.push(slot)
  }

  // Only one day had openings — fill the rest from that day rather than offering fewer times.
  if (spread.length < limit) {
    for (const slot of available) {
      if (spread.length >= limit) break
      if (!spread.includes(slot)) spread.push(slot)
    }
    spread.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  }

  return spread
}

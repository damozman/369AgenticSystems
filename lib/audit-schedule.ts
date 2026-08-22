/**
 * When the two audit calls go out, and when the prospect hears from us.
 *
 * Dossier step 5. Pure: every function here takes `now` and returns instants, so the whole
 * sequence is testable without waiting for an evening to arrive.
 *
 * **Two calls, one in business hours and one late evening**, because the comparison is the entire
 * artifact: *"we called at 10:32 AM and someone picked up; we called at 8:41 PM and it went to
 * voicemail."* One call asserts a problem. Two calls isolate it, on their own line, with no
 * industry average anywhere near it.
 *
 * **Chris's decision, 2026-08-20: disclose *that* we call, never *when*.** The timing is meant to
 * be spontaneous, so nothing here is ever shown to a prospect — it exists to stop us calling at
 * 3 AM, not to publish a timetable.
 *
 * **The dossier never waits for the second call.** A prospect who submits at 10 AM and hears
 * nothing until the following morning has already moved on. It goes out after the *first* call
 * resolves, and the second call becomes a short follow-up the next morning carrying the single
 * most persuasive line in the process.
 */

import { zonedWallClockToUtc, civilDateInZone, type CivilDate } from '@/lib/availability'

/** The buyer's clock. Every window below is DFW local time. */
export const AUDIT_TIME_ZONE = 'America/Chicago'

/**
 * Business-hours window, deliberately narrow.
 *
 * Not 9–5. A call at 09:01 catches someone unlocking the door and 16:59 catches them leaving,
 * and "nobody answered" at either would be a cheap shot rather than a finding.
 */
export const BUSINESS_HOUR_START = 10
export const BUSINESS_HOUR_END = 16

/** Late evening: after any reasonable business would still be staffing a phone. */
export const EVENING_HOUR_START = 20
export const EVENING_HOUR_END = 21

/** Never call sooner than this after they submit — instant is uncanny, not responsive. */
export const MIN_LEAD_MINUTES = 25

/** The morning follow-up carrying the comparison. */
export const FOLLOW_UP_HOUR = 8

export type CallSlot = 'business' | 'evening'

export interface AuditSchedule {
  /** The call that happens first, given when they submitted. */
  first: { slot: CallSlot; at: Date }
  second: { slot: CallSlot; at: Date }
  /** Dossier send. After the first call resolves — never held for the second. */
  dossierAt: Date
  /** Short follow-up with the comparison, the morning after the second call. */
  followUpAt: Date
}

const DAY_MS = 86_400_000

/** Day of week in the audit zone: 0 = Sunday. */
function weekdayInZone(instant: Date): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: AUDIT_TIME_ZONE, weekday: 'short',
  }).format(instant)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

function isWeekday(instant: Date): boolean {
  const d = weekdayInZone(instant)
  return d >= 1 && d <= 5
}

/** Local wall-clock hour and minute in the audit zone. */
function localHour(instant: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: AUDIT_TIME_ZONE, hour: 'numeric', hour12: false,
  }).format(instant))
}

function civilPlusDays(instant: Date, days: number): CivilDate {
  return civilDateInZone(new Date(instant.getTime() + days * DAY_MS), AUDIT_TIME_ZONE)
}

/**
 * The next instant at `hour` local that is a weekday and at least `notBefore`.
 *
 * **Weekdays only, and this is a fairness rule rather than a convenience.** Calling a roofer at
 * 11 AM on a Sunday and reporting "nobody answered" would be a finding about the day of the week,
 * not about how they handle calls. The evening call is the after-hours test; the business-hours
 * call has to actually land in business hours to establish anything.
 */
function nextWeekdayAt(hour: number, minute: number, notBefore: Date): Date {
  for (let offset = 0; offset <= 8; offset++) {
    const candidate = zonedWallClockToUtc(
      civilPlusDays(notBefore, offset), hour, minute, AUDIT_TIME_ZONE)
    if (candidate.getTime() >= notBefore.getTime() && isWeekday(candidate)) return candidate
  }
  // Unreachable: any eight-day span contains a weekday.
  return new Date(notBefore.getTime() + DAY_MS)
}

/**
 * Picks a minute inside the window so two prospects submitting together are not dialled in
 * lockstep, and so the time never looks machine-scheduled to the person picking up.
 *
 * Derived from the seed rather than random, so a schedule is reproducible and a test can assert
 * it. `seed` is normally the prospect's audit row id.
 */
function scatter(seed: string, spanHours: number): { hour: number; minute: number } {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const totalMinutes = h % (spanHours * 60)
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 }
}

/**
 * Builds the whole sequence from the moment they submitted.
 *
 * Morning submission → business call first, dossier the same day, evening call that night,
 * follow-up next morning. Evening submission → the order flips and the evening call goes first.
 * The sequence adapts; the shape does not.
 */
export function planAuditCalls(submittedAt: Date, seed: string): AuditSchedule {
  const earliest = new Date(submittedAt.getTime() + MIN_LEAD_MINUTES * 60_000)

  const bizOffset = scatter(seed, BUSINESS_HOUR_END - BUSINESS_HOUR_START)
  const eveOffset = scatter(seed + 'e', EVENING_HOUR_END - EVENING_HOUR_START)

  const businessAt = nextWeekdayAt(
    BUSINESS_HOUR_START + bizOffset.hour, bizOffset.minute, earliest)
  const eveningAt = nextWeekdayAt(
    EVENING_HOUR_START + eveOffset.hour, eveOffset.minute, earliest)

  const businessFirst = businessAt.getTime() <= eveningAt.getTime()
  const first = businessFirst
    ? { slot: 'business' as const, at: businessAt }
    : { slot: 'evening' as const, at: eveningAt }
  const second = businessFirst
    ? { slot: 'evening' as const, at: eveningAt }
    : { slot: 'business' as const, at: businessAt }

  // A call is a few minutes and Retell resolves it on a webhook; half an hour is comfortably
  // clear of a ring-out plus a voicemail message.
  const dossierAt = new Date(first.at.getTime() + 30 * 60_000)

  // The morning after the second call. If the second call is itself a morning one, the follow-up
  // is the next morning rather than four hours later.
  const afterSecond = new Date(second.at.getTime() + 60 * 60_000)
  const followUpAt = localHour(afterSecond) < FOLLOW_UP_HOUR
    ? zonedWallClockToUtc(civilDateInZone(afterSecond, AUDIT_TIME_ZONE), FOLLOW_UP_HOUR, 0, AUDIT_TIME_ZONE)
    : nextWeekdayAt(FOLLOW_UP_HOUR, 0, new Date(afterSecond.getTime() + 8 * 3_600_000))

  return { first, second, dossierAt, followUpAt }
}

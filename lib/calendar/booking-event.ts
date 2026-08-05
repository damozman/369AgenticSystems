/**
 * A booking → the calendar event the owner sees.
 *
 * Pure, so the wording and the fallbacks are testable without a database or a phone call. It
 * has to survive being called twice with different amounts of information: Ava books the
 * appointment 27–41 seconds before she captures the lead (measured on real calls, 2026-08-04),
 * so the first call frequently knows only a phone number, and the second — from the
 * lead-adoption backfill in /api/capture-lead — fills in the rest.
 */

import type { CalendarEvent } from '@/lib/calendar/types'

/** Everything the wording is derived from. Deliberately separate from the times. */
export interface CallerDetails {
  serviceType?:   string | null
  location?:      string | null
  callerName?:    string | null
  callerPhone?:   string | null
  callerEmail?:   string | null
  callerAddress?: string | null
}

export interface BookingEventInput extends CallerDetails {
  startsAt: Date
  endsAt:   Date
  timeZone: string
}

/**
 * The title is what the owner reads at a glance in a week view, so it leads with who is coming.
 * With no name yet it uses the phone number rather than a placeholder — "Appointment —
 * Unknown Caller" looks like a bug, and a phone number is genuinely useful on its own.
 */
function summaryOf(input: CallerDetails): string {
  const service = input.serviceType?.trim() || 'Appointment'
  const who = input.callerName?.trim() || input.callerPhone?.trim() || null
  return who ? `${service} — ${who}` : service
}

function descriptionOf(input: CallerDetails): string {
  return [
    input.callerName    ? `Caller:  ${input.callerName}`    : null,
    input.callerPhone   ? `Phone:   ${input.callerPhone}`   : null,
    input.callerEmail   ? `Email:   ${input.callerEmail}`   : null,
    input.callerAddress ? `Address: ${input.callerAddress}` : null,
    '',
    'Booked automatically by Ava, your AI receptionist.',
  ].filter(v => v !== null).join('\n')
}

/**
 * The job site, when there is one. Falls back to the caller's own address, which for the trades
 * (roofing, HVAC, plumbing) is where the work actually happens.
 */
function locationOf(input: CallerDetails): string | undefined {
  return input.location?.trim() || input.callerAddress?.trim() || undefined
}

export function buildBookingEvent(input: BookingEventInput): CalendarEvent {
  return {
    summary:     summaryOf(input),
    description: descriptionOf(input),
    location:    locationOf(input),
    startsAt:    input.startsAt,
    endsAt:      input.endsAt,
    timeZone:    input.timeZone,
  }
}

/**
 * The subset worth rewriting once the caller's details land.
 *
 * Takes no times at all, which is the point: the appointment did not move, and a PATCH that
 * resent start/end would overwrite any adjustment the owner made in their own calendar in the
 * meantime. An absent location is left out rather than sent as undefined, so a patch cannot
 * blank an address the owner typed in themselves.
 */
export function buildBookingEventPatch(input: CallerDetails): Partial<CalendarEvent> {
  const location = locationOf(input)
  return {
    summary:     summaryOf(input),
    description: descriptionOf(input),
    ...(location ? { location } : {}),
  }
}

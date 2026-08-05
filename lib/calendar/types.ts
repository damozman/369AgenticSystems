/**
 * The calendar provider seam.
 *
 * Nothing Google-specific belongs in this file. Microsoft Graph is the planned second
 * implementation, and the point of writing an interface before there are two providers is that
 * the second one is a new file rather than a rewrite of the booking chain.
 *
 * Apple/CalDAV is deliberately not on that list: it has no public REST API and no OAuth at all,
 * only a 16-character app-specific password the client generates by hand. That cannot be
 * automated, which kills "live within minutes of signup". iCloud-only owners get the .ics
 * attachment Nova already sends (lib/email-sequences.ts) and no sync.
 */

import type { BusyInterval } from '@/lib/availability'

export type CalendarProviderName = 'google' | 'microsoft'

/**
 * An appointment as the calendar should show it.
 *
 * `timeZone` travels with the instants because a calendar event is displayed in a zone, and
 * sending a bare UTC instant makes an 11:00 AM appointment render as 4:00 PM for an owner whose
 * calendar defaults to UTC. The client's own timezone comes from `client_schedules`.
 */
export interface CalendarEvent {
  summary:      string
  description?: string
  location?:    string
  startsAt:     Date
  endsAt:       Date
  timeZone:     string
}

export interface CalendarProvider {
  readonly name: CalendarProviderName

  /**
   * Busy intervals in the window — never event contents.
   *
   * Returns `BusyInterval[]` from lib/availability rather than a new type, so the result drops
   * straight into `openSlots()` alongside rows from the `bookings` table with no adapter.
   */
  busy(range: { from: Date; to: Date }): Promise<BusyInterval[]>

  createEvent(event: CalendarEvent): Promise<{ id: string }>
  updateEvent(eventId: string, patch: Partial<CalendarEvent>): Promise<void>
  deleteEvent(eventId: string): Promise<void>
}

/**
 * The connection is dead and retrying will not help — the owner revoked access, or the refresh
 * token expired (which is what a project left in Google's "Testing" publishing status does to
 * every token after 7 days).
 *
 * Separated from CalendarError because only one of the two is worth retrying, and because this
 * one has to alert: with fail-closed reads, a revoked connection means Ava stops booking for
 * that client entirely, and nothing about that is visible from outside.
 */
export class CalendarAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalendarAuthError'
  }
}

/** Transient — network, rate limit, 5xx. Worth retrying; not worth alarming anyone about. */
export class CalendarError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'CalendarError'
    this.status = status
  }
}

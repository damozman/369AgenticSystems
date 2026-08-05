/**
 * The date and time a caller is told, in the client's own timezone.
 *
 * This lives here rather than inside the Nova route because it got a real customer's appointment
 * day wrong, and a bug that reaches a customer deserves a test that can import the function.
 *
 * The fault: `bookings.appointment_date` is a bare Postgres `timestamp` — no offset — so it
 * serialises as "2026-08-06T00:00:00", which `new Date()` reads as the *server's* local time. On
 * Vercel the server runs in UTC, so formatting that instant in America/Chicago moved it back
 * five hours to 7pm the previous evening and printed "Wednesday, August 5" for an appointment on
 * Thursday the 6th.
 *
 * `starts_at` is a real timestamptz and is exactly why it was added in Phase 1. Both strings come
 * from it, so the date and the time cannot disagree with each other.
 */

export interface AppointmentSource {
  starts_at?:        string | null
  appointment_date?: unknown
  appointment_time?: string | null
}

export interface FormattedAppointment {
  date: string
  time: string
}

export function formatAppointment(
  booking: AppointmentSource,
  timeZone: string,
): FormattedAppointment {
  if (booking.starts_at) {
    const at = new Date(booking.starts_at)
    if (!Number.isNaN(at.getTime())) {
      return {
        date: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone }).format(at),
        time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone }).format(at),
      }
    }
  }

  // Legacy rows predating starts_at. Take the calendar date only, and build the instant in UTC
  // *and* format it in UTC — matching zones is what guarantees no conversion can shift the day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(booking.appointment_date ?? ''))
  const date = m
    ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))))
    : String(booking.appointment_date ?? '')

  return { date, time: booking.appointment_time ?? '' }
}

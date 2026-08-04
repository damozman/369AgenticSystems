import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClientSchedule } from '@/lib/availability'

/**
 * Loading a client's working hours, with a defined fallback.
 *
 * Shared by /api/available-slots and /api/book-appointment so the two can never disagree about
 * when a business is open — if availability and booking read different rules, the booking route
 * will happily accept a time availability would never have offered.
 */

/**
 * Used when a client has no `client_schedules` row yet: every existing client predates this
 * table, and the demo line has no row at all.
 *
 * These are the same weekday hours the old synthetic route implied, so behaviour for an
 * un-onboarded client stays recognisable — but capacity is 1 and the times are now real.
 */
export const DEFAULT_SCHEDULE: ClientSchedule = {
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
  lead_time_hours: 12,
  booking_horizon_days: 14,
}

export async function loadSchedule(
  supabase: SupabaseClient,
  clientDomain: string,
): Promise<ClientSchedule> {
  const { data, error } = await supabase
    .from('client_schedules')
    .select('timezone, business_hours, slot_duration_minutes, max_concurrent_per_slot, lead_time_hours, booking_horizon_days')
    .eq('client_domain', clientDomain)
    .maybeSingle()

  // A missing table or a failed read must not take the phone line down — Ava falls back to
  // default hours and still books. Logged loudly because silently serving defaults to a client
  // who set real hours is exactly the kind of quiet wrongness that hides for weeks.
  if (error) {
    console.error(`[SCHEDULE] Falling back to defaults for ${clientDomain}: ${error.message}`)
    return DEFAULT_SCHEDULE
  }
  if (!data) return DEFAULT_SCHEDULE

  return {
    timezone:                data.timezone                ?? DEFAULT_SCHEDULE.timezone,
    business_hours:          data.business_hours          ?? DEFAULT_SCHEDULE.business_hours,
    slot_duration_minutes:   data.slot_duration_minutes   ?? DEFAULT_SCHEDULE.slot_duration_minutes,
    max_concurrent_per_slot: data.max_concurrent_per_slot ?? DEFAULT_SCHEDULE.max_concurrent_per_slot,
    lead_time_hours:         data.lead_time_hours         ?? DEFAULT_SCHEDULE.lead_time_hours,
    booking_horizon_days:    data.booking_horizon_days    ?? DEFAULT_SCHEDULE.booking_horizon_days,
  }
}

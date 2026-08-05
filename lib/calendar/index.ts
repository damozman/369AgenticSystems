/**
 * The entry point every route uses. Nothing outside lib/calendar imports google.ts directly —
 * that is what makes Microsoft Graph a new file rather than a rewrite of the booking chain.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { GoogleCalendarProvider } from '@/lib/calendar/google'
import { loadConnection, makeAccessTokenSource, markError, markOk, markRevoked, type CalendarConnection } from '@/lib/calendar/tokens'
import { CalendarAuthError, type CalendarProvider } from '@/lib/calendar/types'

export { CalendarAuthError, CalendarError } from '@/lib/calendar/types'
export type { CalendarEvent, CalendarProvider } from '@/lib/calendar/types'
export { buildBookingEvent, buildBookingEventPatch } from '@/lib/calendar/booking-event'
export { loadConnection, loadConnectionAnyStatus } from '@/lib/calendar/tokens'
export type { CalendarConnection } from '@/lib/calendar/tokens'

/**
 * The provider for a client, or **null when there is no calendar to sync** — which is the
 * normal case today and behaves exactly as things did before this feature existed.
 *
 * The returned provider records its own health: every success refreshes `last_ok_at`, every
 * auth failure marks the connection revoked. Doing that here rather than at each call site
 * means a new caller cannot forget to, and `last_ok_at` is what the reconciler cron watches to
 * notice a connection that has quietly stopped working.
 */
export async function getProviderForClient(
  supabase: SupabaseClient,
  clientDomain: string,
): Promise<CalendarProvider | null> {
  const connection = await loadConnection(supabase, clientDomain)
  if (!connection) return null

  return buildProvider(supabase, connection)
}

/** For callers that already hold the row — the reconciler, which iterates every connection. */
export function buildProvider(
  supabase: SupabaseClient,
  connection: CalendarConnection,
): CalendarProvider {
  const inner = new GoogleCalendarProvider(
    makeAccessTokenSource(supabase, connection),
    connection.calendar_id,
  )
  return withStatusTracking(inner, supabase, connection)
}

function withStatusTracking(
  provider: CalendarProvider,
  supabase: SupabaseClient,
  connection: CalendarConnection,
): CalendarProvider {
  const track = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      const result = await fn()
      await markOk(supabase, connection)
      return result
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // markRevoked is already called inside the token refresh when Google returns
      // invalid_grant; this covers the other route to the same conclusion — a 401/403 from the
      // Calendar API itself, which means the grant is gone even though the token still parses.
      if (e instanceof CalendarAuthError) await markRevoked(supabase, connection.client_domain, message)
      else await markError(supabase, connection.client_domain, message)
      throw e
    }
  }

  return {
    name:        provider.name,
    busy:        range        => track(() => provider.busy(range)),
    createEvent: event        => track(() => provider.createEvent(event)),
    updateEvent: (id, patch)  => track(() => provider.updateEvent(id, patch)),
    deleteEvent: id           => track(() => provider.deleteEvent(id)),
  }
}

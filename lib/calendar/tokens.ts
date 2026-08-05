/**
 * Loading a calendar connection and keeping its access token alive.
 *
 * This is the only file in lib/calendar that touches the database. google.ts never sees a
 * Supabase client, which is what lets its every branch be unit-tested with an injected fetch
 * and no database at all.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptToken, encryptToken } from '@/lib/calendar/crypto'
import { refreshAccessToken, type AccessTokenSource } from '@/lib/calendar/google'
import { CalendarAuthError, type CalendarProviderName } from '@/lib/calendar/types'

export interface CalendarConnection {
  id:                      string
  client_domain:           string
  provider:                CalendarProviderName
  account_email:           string | null
  calendar_id:             string
  access_token_enc:        string | null
  refresh_token_enc:       string | null
  access_token_expires_at: string | null
  scopes:                  string[]
  status:                  'active' | 'revoked' | 'error'
  last_error:              string | null
  last_ok_at:              string | null
  alerted_at:              string | null
}

const CONNECTION_COLUMNS =
  'id, client_domain, provider, account_email, calendar_id, access_token_enc, refresh_token_enc, ' +
  'access_token_expires_at, scopes, status, last_error, last_ok_at, alerted_at'

/**
 * The connection for a client, or null when there is nothing to sync.
 *
 * Null is the normal case and must stay a first-class one: no client has connected a calendar
 * yet, and eight of nine verticals will have none for a while. Every caller treats null as
 * "behave exactly as before this feature existed".
 *
 * A revoked or errored connection also returns null here — a dead connection cannot answer
 * questions. The reconciler cron is what makes that visible; see /api/cron/calendar-sync.
 */
export async function loadConnection(
  supabase: SupabaseClient,
  clientDomain: string,
): Promise<CalendarConnection | null> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select(CONNECTION_COLUMNS)
    .eq('client_domain', clientDomain)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    // A missing table (migration not applied) or an unreadable one must not take the phone
    // line down — it means "no calendar", which is where every client already is.
    console.error(`[CALENDAR] Could not read connection for ${clientDomain}: ${error.message}`)
    return null
  }
  return (data as CalendarConnection | null) ?? null
}

/** The row as the dashboard needs it, including dead connections — those are what it must show. */
export async function loadConnectionAnyStatus(
  supabase: SupabaseClient,
  clientDomain: string,
): Promise<CalendarConnection | null> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select(CONNECTION_COLUMNS)
    .eq('client_domain', clientDomain)
    .maybeSingle()

  if (error) {
    console.error(`[CALENDAR] Could not read connection for ${clientDomain}: ${error.message}`)
    return null
  }
  return (data as CalendarConnection | null) ?? null
}

export async function markRevoked(
  supabase: SupabaseClient,
  clientDomain: string,
  reason: string,
): Promise<void> {
  await supabase
    .from('calendar_connections')
    .update({ status: 'revoked', last_error: reason.slice(0, 500), updated_at: new Date().toISOString() })
    .eq('client_domain', clientDomain)

  // Loud on purpose. With fail-closed reads this is not a degraded feature, it is Ava no longer
  // booking for this client — and nothing about it is visible from outside.
  console.error(`[CALENDAR] ✗  Connection REVOKED for ${clientDomain}: ${reason}`)
}

export async function markError(
  supabase: SupabaseClient,
  clientDomain: string,
  reason: string,
): Promise<void> {
  await supabase
    .from('calendar_connections')
    .update({ last_error: reason.slice(0, 500), updated_at: new Date().toISOString() })
    .eq('client_domain', clientDomain)
}

/**
 * Recorded on every successful provider call, throttled to once a minute.
 *
 * `last_ok_at` going stale is how the cron detects a connection that has quietly stopped
 * working, so it has to be written from the success path rather than inferred.
 */
export async function markOk(
  supabase: SupabaseClient,
  connection: CalendarConnection,
): Promise<void> {
  const last = connection.last_ok_at ? new Date(connection.last_ok_at).getTime() : 0
  if (Date.now() - last < 60_000) return

  await supabase
    .from('calendar_connections')
    .update({ last_ok_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
    .eq('client_domain', connection.client_domain)
}

/**
 * An access-token source for google.ts: returns a live token, refreshing and persisting when
 * the stored one has expired or the provider reports it rejected.
 *
 * Two simultaneous calls can both refresh. Google keeps the refresh token valid across that, so
 * the outcome is two valid access tokens and a last-write-wins row — harmless at this volume,
 * and cheaper than serialising every call behind a lock.
 */
export function makeAccessTokenSource(
  supabase: SupabaseClient,
  connection: CalendarConnection,
): AccessTokenSource {
  return async ({ forceRefresh = false } = {}) => {
    const expiresAt = connection.access_token_expires_at
      ? new Date(connection.access_token_expires_at).getTime()
      : 0

    if (!forceRefresh && connection.access_token_enc && expiresAt > Date.now()) {
      return decryptToken(connection.access_token_enc)
    }

    const refreshToken = connection.refresh_token_enc ? decryptToken(connection.refresh_token_enc) : null
    if (!refreshToken) {
      // Nothing to refresh with. This is what a connection made without prompt=consent looks
      // like, which is why buildAuthUrl always sends it.
      await markRevoked(supabase, connection.client_domain, 'No refresh token stored — reconnect required')
      throw new CalendarAuthError(`No refresh token for ${connection.client_domain} — the calendar must be reconnected`)
    }

    const clientId     = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new CalendarAuthError('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — cannot refresh the calendar token')
    }

    let tokens
    try {
      tokens = await refreshAccessToken({ refreshToken, clientId, clientSecret })
    } catch (e) {
      // invalid_grant surfaces as CalendarAuthError: the owner revoked access, or the token
      // expired under Testing publishing status. Either way retrying is pointless.
      if (e instanceof CalendarAuthError) {
        await markRevoked(supabase, connection.client_domain, e.message)
      }
      throw e
    }

    const accessTokenEnc = encryptToken(tokens.accessToken)
    await supabase
      .from('calendar_connections')
      .update({
        access_token_enc:        accessTokenEnc,
        access_token_expires_at: tokens.expiresAt.toISOString(),
        updated_at:              new Date().toISOString(),
      })
      .eq('client_domain', connection.client_domain)

    // Keep the in-memory copy current so a second call in the same request doesn't refresh again.
    connection.access_token_enc        = accessTokenEnc
    connection.access_token_expires_at = tokens.expiresAt.toISOString()

    return tokens.accessToken
  }
}

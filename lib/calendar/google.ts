/**
 * The only file that knows Google exists.
 *
 * Plain `fetch`, no `googleapis` dependency. That package is tens of megabytes of generated
 * clients for every Google API there is, to save writing the four requests below — the same
 * trade lib/availability.ts declined when it did timezone maths with `Intl` rather than adding
 * a date library.
 *
 * Every network call goes through `request()` so timeouts, error classification and the
 * one-shot token refresh are in a single place, and so tests can inject a fetch instead of
 * mocking the module.
 */

import type { BusyInterval } from '@/lib/availability'
import {
  CalendarAuthError,
  CalendarError,
  type CalendarEvent,
  type CalendarProvider,
} from '@/lib/calendar/types'

const OAUTH_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const CALENDAR_API    = 'https://www.googleapis.com/calendar/v3'

/**
 * Busy times and event write, nothing more.
 *
 * `calendar.freebusy` returns intervals only — no titles, no attendees, no descriptions — which
 * is what lets the privacy policy say we never read the contents of unrelated events and have
 * that be structurally true rather than a promise. `calendar.readonly` would have done the same
 * job while granting far more, and Google asks you to justify exactly this choice at review.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events',
]

/** Mid-call, on the phone, with a caller waiting. Slow is the same as broken here. */
const DEFAULT_TIMEOUT_MS = 3_000

/**
 * freeBusy rejects windows wider than three months. `booking_horizon_days` is capped at 365 by
 * its check constraint, so a client who sets a long horizon would otherwise get an opaque 400
 * from Google instead of slots.
 */
const MAX_FREEBUSY_DAYS = 90

export type FetchLike = typeof fetch

export interface GoogleTokens {
  accessToken:  string
  refreshToken: string | null
  expiresAt:    Date
  scopes:       string[]
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

/**
 * `access_type=offline` is what makes Google issue a refresh token at all, and
 * `prompt=consent` is what makes it issue one on every consent rather than only the first.
 * Without the latter, a client who disconnects and reconnects gets an access token with no
 * refresh token, and the connection silently dies an hour later.
 */
export function buildAuthUrl(params: {
  clientId:    string
  redirectUri: string
  state:       string
}): string {
  const url = new URL(OAUTH_AUTH_URL)
  url.searchParams.set('client_id',     params.clientId)
  url.searchParams.set('redirect_uri',  params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope',         GOOGLE_SCOPES.join(' '))
  url.searchParams.set('access_type',   'offline')
  url.searchParams.set('prompt',        'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state',         params.state)
  return url.toString()
}

interface TokenResponse {
  access_token?:  string
  refresh_token?: string
  expires_in?:    number
  scope?:         string
  error?:         string
  error_description?: string
}

async function tokenRequest(body: Record<string, string>, doFetch: FetchLike): Promise<GoogleTokens> {
  let res: Response
  try {
    res = await doFetch(OAUTH_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams(body).toString(),
      signal:  AbortSignal.timeout(DEFAULT_TIMEOUT_MS * 2), // token exchange is not mid-call
    })
  } catch (e) {
    throw new CalendarError(`Google token endpoint unreachable: ${(e as Error).message}`)
  }

  const json = (await res.json().catch(() => ({}))) as TokenResponse

  // invalid_grant is the one that matters: the user revoked access, or the refresh token
  // expired under "Testing" publishing status. Retrying it forever accomplishes nothing, so it
  // is classified as auth failure and the connection gets marked revoked.
  if (json.error === 'invalid_grant') {
    throw new CalendarAuthError(`Google rejected the grant: ${json.error_description ?? 'invalid_grant'}`)
  }
  if (!res.ok || !json.access_token) {
    throw new CalendarError(
      `Google token exchange failed (HTTP ${res.status}): ${json.error ?? 'no access_token in response'}`,
      res.status,
    )
  }

  return {
    accessToken:  json.access_token,
    // Absent on a refresh — Google only returns it on the initial consent. The caller keeps
    // the one it already has rather than overwriting it with null.
    refreshToken: json.refresh_token ?? null,
    // 60s of slack so a token that expires between the check and the request doesn't 401.
    expiresAt:    new Date(Date.now() + ((json.expires_in ?? 3600) - 60) * 1000),
    scopes:       json.scope ? json.scope.split(' ') : [],
  }
}

export function exchangeCode(
  params: { code: string; clientId: string; clientSecret: string; redirectUri: string },
  doFetch: FetchLike = fetch,
): Promise<GoogleTokens> {
  return tokenRequest({
    code:          params.code,
    client_id:     params.clientId,
    client_secret: params.clientSecret,
    redirect_uri:  params.redirectUri,
    grant_type:    'authorization_code',
  }, doFetch)
}

export function refreshAccessToken(
  params: { refreshToken: string; clientId: string; clientSecret: string },
  doFetch: FetchLike = fetch,
): Promise<GoogleTokens> {
  return tokenRequest({
    refresh_token: params.refreshToken,
    client_id:     params.clientId,
    client_secret: params.clientSecret,
    grant_type:    'refresh_token',
  }, doFetch)
}

/**
 * Best-effort. The privacy policy promises that disconnecting deletes the token and stops all
 * access; deleting our row achieves that regardless of what Google says here, so a failure to
 * revoke must not block the disconnect.
 */
export async function revokeToken(token: string, doFetch: FetchLike = fetch): Promise<boolean> {
  try {
    const res = await doFetch(`${OAUTH_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal:  AbortSignal.timeout(DEFAULT_TIMEOUT_MS * 2),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── The provider ──────────────────────────────────────────────────────────────

/**
 * Supplied by lib/calendar/tokens.ts, which owns refreshing and persisting. The provider asks
 * for a token and, on a 401, asks once more with `forceRefresh` — so the refresh logic lives in
 * exactly one place and this file never touches the database.
 */
export type AccessTokenSource = (opts?: { forceRefresh?: boolean }) => Promise<string>

interface GoogleErrorBody {
  error?: { code?: number; message?: string; errors?: { reason?: string }[] }
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = 'google' as const

  // Written out longhand rather than as constructor parameter properties: Node's type-stripping
  // (which is what runs `npm test`) rejects that syntax outright, so the shorthand would make
  // this whole file untestable.
  private readonly getAccessToken: AccessTokenSource
  private readonly calendarId: string
  private readonly doFetch: FetchLike
  private readonly timeoutMs: number

  constructor(
    getAccessToken: AccessTokenSource,
    calendarId: string = 'primary',
    doFetch: FetchLike = fetch,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    this.getAccessToken = getAccessToken
    this.calendarId     = calendarId
    this.doFetch        = doFetch
    this.timeoutMs      = timeoutMs
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: unknown },
    retryOn401 = true,
  ): Promise<T | null> {
    const token = await this.getAccessToken({ forceRefresh: !retryOn401 })

    let res: Response
    try {
      res = await this.doFetch(`${CALENDAR_API}${path}`, {
        method:  init.method,
        headers: {
          authorization:  `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body:   init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (e) {
      // AbortSignal.timeout throws TimeoutError; everything else is a network fault. Both are
      // transient, and both mean Ava must not be handed times we could not verify.
      throw new CalendarError(`Google Calendar unreachable: ${(e as Error).message}`)
    }

    if (res.status === 401 && retryOn401) {
      // The access token expired earlier than its stated lifetime, or was revoked at the far
      // end. One forced refresh distinguishes the two: if it was really revoked, the token
      // endpoint returns invalid_grant and CalendarAuthError propagates from there.
      return this.request<T>(path, init, false)
    }

    if (res.status === 204) return null

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as GoogleErrorBody
      const detail = body.error?.message ?? `HTTP ${res.status}`

      if (res.status === 401 || res.status === 403) {
        const reason = body.error?.errors?.[0]?.reason ?? ''
        // 403 covers both "you have no permission to this calendar" (permanent, needs
        // reconnecting) and "slow down" (transient). Splitting them keeps a rate limit from
        // marking a healthy connection revoked.
        if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
          throw new CalendarError(`Google Calendar rate limit: ${detail}`, res.status)
        }
        throw new CalendarAuthError(`Google Calendar denied access: ${detail}`)
      }

      throw new CalendarError(`Google Calendar error: ${detail}`, res.status)
    }

    return (await res.json().catch(() => null)) as T | null
  }

  async busy(range: { from: Date; to: Date }): Promise<BusyInterval[]> {
    const maxTo = new Date(range.from.getTime() + MAX_FREEBUSY_DAYS * 86_400_000)
    const timeMax = range.to > maxTo ? maxTo : range.to

    const body = await this.request<{
      calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason?: string }[] }>
    }>('/freeBusy', {
      method: 'POST',
      body: {
        timeMin: range.from.toISOString(),
        timeMax: timeMax.toISOString(),
        items:   [{ id: this.calendarId }],
      },
    })

    // Google keys the response by the calendar id that was asked for. Reading the first value
    // rather than indexing by `this.calendarId` because Google normalises some ids (notably
    // 'primary' → the account's address) and an exact-key lookup then silently returns nothing —
    // which would read as "completely free" and double-book the owner.
    const entry = Object.values(body?.calendars ?? {})[0]

    // A per-calendar error means we did not get an answer for this calendar. Treating a missing
    // answer as "no busy times" is precisely the bug this integration exists to prevent, so it
    // throws and the caller fails closed.
    if (entry?.errors?.length) {
      throw new CalendarError(
        `Google could not read calendar "${this.calendarId}": ${entry.errors.map(e => e.reason).join(', ')}`,
      )
    }
    if (!entry) {
      throw new CalendarError(`Google returned no free/busy data for calendar "${this.calendarId}"`)
    }

    return (entry.busy ?? []).map(b => ({ starts_at: b.start, ends_at: b.end }))
  }

  /**
   * A one-shot connectivity check, used at the end of the OAuth callback.
   *
   * Two jobs. It proves the brand-new grant can actually read the calendar *before* the
   * dashboard tells the owner they are connected — the alternative is reporting success and
   * discovering at the next phone call that the account had no calendar access. And it returns
   * the key Google answered under, which for `primary` is the account's own address, giving the
   * connected-account email without asking for a profile or email scope we do not otherwise need.
   */
  async probe(): Promise<{ calendarKey: string | null }> {
    const now = new Date()
    const body = await this.request<{ calendars?: Record<string, { errors?: { reason?: string }[] }> }>(
      '/freeBusy',
      {
        method: 'POST',
        body: {
          timeMin: now.toISOString(),
          timeMax: new Date(now.getTime() + 60_000).toISOString(),
          items:   [{ id: this.calendarId }],
        },
      },
    )

    const [key, entry] = Object.entries(body?.calendars ?? {})[0] ?? []
    if (entry?.errors?.length) {
      throw new CalendarError(
        `Google could not read calendar "${this.calendarId}": ${entry.errors.map(e => e.reason).join(', ')}`,
      )
    }
    // An address is an address; anything else (a group calendar id) is not worth showing back.
    return { calendarKey: key && key.includes('@') && !key.endsWith('.calendar.google.com') ? key : null }
  }

  async createEvent(event: CalendarEvent): Promise<{ id: string }> {
    const created = await this.request<{ id?: string }>(
      `/calendars/${encodeURIComponent(this.calendarId)}/events`,
      { method: 'POST', body: toGoogleEvent(event) },
    )
    if (!created?.id) {
      throw new CalendarError('Google accepted the event but returned no id')
    }
    return { id: created.id }
  }

  async updateEvent(eventId: string, patch: Partial<CalendarEvent>): Promise<void> {
    // PATCH, not PUT: a full update would blank every field the caller did not supply, and the
    // only caller here is the lead-adoption backfill, which knows the caller's name and nothing
    // else about the event.
    await this.request(
      `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'PATCH', body: toGoogleEvent(patch) },
    )
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.request(
        `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: 'DELETE' },
      )
    } catch (e) {
      // Already gone — someone deleted it in the Google UI. That is the desired end state, so
      // reporting failure would make cancellation flows retry something that is already done.
      if (e instanceof CalendarError && (e.status === 404 || e.status === 410)) return
      throw e
    }
  }
}

/** CalendarEvent → Google's wire shape. Partial-safe, so the same mapper serves PATCH. */
function toGoogleEvent(event: Partial<CalendarEvent>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (event.summary     !== undefined) body.summary     = event.summary
  if (event.description !== undefined) body.description = event.description
  if (event.location    !== undefined) body.location    = event.location
  // dateTime carries the instant; timeZone tells Google which zone to display it in. Sending
  // the instant alone makes an 11:00 AM appointment render as 4:00 PM for an owner whose
  // calendar defaults to UTC.
  if (event.startsAt    !== undefined) body.start = { dateTime: event.startsAt.toISOString(), timeZone: event.timeZone }
  if (event.endsAt      !== undefined) body.end   = { dateTime: event.endsAt.toISOString(),   timeZone: event.timeZone }
  return body
}

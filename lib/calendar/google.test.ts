import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  GoogleCalendarProvider,
  GOOGLE_SCOPES,
  type FetchLike,
} from './google.ts'
import { CalendarAuthError, CalendarError } from './types.ts'

/**
 * Every branch here is a way the integration fails in the real world, and each one has a
 * different correct response. The distinction that matters most is *transient vs revoked*:
 * treating a rate limit as a revocation would mark a healthy connection dead and stop Ava
 * booking for that client, and treating a revocation as transient would retry forever while
 * nobody is told the calendar has been disconnected.
 */

interface Call { url: string; init: RequestInit }

/** A fetch that replays a queue of responses and records what it was asked for. */
function fakeFetch(responses: { status: number; body?: unknown }[]): FetchLike & { calls: Call[] } {
  const calls: Call[] = []
  const fn = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    const next = responses.shift()
    if (!next) throw new Error(`fakeFetch: unexpected extra request to ${url}`)
    return {
      ok:     next.status >= 200 && next.status < 300,
      status: next.status,
      json:   async () => next.body ?? {},
    } as Response
  }) as FetchLike & { calls: Call[] }
  fn.calls = calls
  return fn
}

const token = async () => 'access-token'

const RANGE = { from: new Date('2026-08-10T00:00:00Z'), to: new Date('2026-08-17T00:00:00Z') }

// ── freeBusy ──────────────────────────────────────────────────────────────────

test('freeBusy busy intervals map straight onto BusyInterval', () => {
  // The shape lib/availability.ts already consumes — no adapter, which is the whole reason the
  // seam is cheap.
  const doFetch = fakeFetch([{
    status: 200,
    body: { calendars: { primary: { busy: [
      { start: '2026-08-10T14:00:00Z', end: '2026-08-10T15:00:00Z' },
      { start: '2026-08-11T16:00:00Z', end: '2026-08-11T17:30:00Z' },
    ] } } },
  }])

  const provider = new GoogleCalendarProvider(token, 'primary', doFetch)
  return provider.busy(RANGE).then(busy => {
    assert.deepEqual(busy, [
      { starts_at: '2026-08-10T14:00:00Z', ends_at: '2026-08-10T15:00:00Z' },
      { starts_at: '2026-08-11T16:00:00Z', ends_at: '2026-08-11T17:30:00Z' },
    ])
  })
})

test('freeBusy reads the response whatever key Google returns it under', async () => {
  // Asked for 'primary', answered under the account's real address. An exact-key lookup would
  // find nothing, read as "completely free", and double-book the owner.
  const doFetch = fakeFetch([{
    status: 200,
    body: { calendars: { 'owner@example.com': { busy: [{ start: '2026-08-10T14:00:00Z', end: '2026-08-10T15:00:00Z' }] } } },
  }])

  const busy = await new GoogleCalendarProvider(token, 'primary', doFetch).busy(RANGE)
  assert.equal(busy.length, 1)
})

test('freeBusy treats an empty busy array as genuinely free', async () => {
  const doFetch = fakeFetch([{ status: 200, body: { calendars: { primary: { busy: [] } } } }])
  assert.deepEqual(await new GoogleCalendarProvider(token, 'primary', doFetch).busy(RANGE), [])
})

test('freeBusy throws when Google reports a per-calendar error', async () => {
  // "No answer" must never be read as "no busy times" — that is exactly the bug this
  // integration exists to prevent, so the caller has to fail closed.
  const doFetch = fakeFetch([{
    status: 200,
    body: { calendars: { primary: { errors: [{ reason: 'notFound' }] } } },
  }])

  await assert.rejects(
    () => new GoogleCalendarProvider(token, 'primary', doFetch).busy(RANGE),
    (e: Error) => e instanceof CalendarError && /notFound/.test(e.message),
  )
})

test('freeBusy throws when the calendar is missing from the response entirely', async () => {
  const doFetch = fakeFetch([{ status: 200, body: { calendars: {} } }])
  await assert.rejects(
    () => new GoogleCalendarProvider(token, 'primary', doFetch).busy(RANGE),
    CalendarError,
  )
})

test('freeBusy clamps a window wider than Google accepts', async () => {
  // booking_horizon_days allows up to 365; freeBusy rejects more than three months. Without the
  // clamp a long-horizon client gets an opaque 400 instead of slots.
  const doFetch = fakeFetch([{ status: 200, body: { calendars: { primary: { busy: [] } } } }])
  const from = new Date('2026-01-01T00:00:00Z')
  await new GoogleCalendarProvider(token, 'primary', doFetch)
    .busy({ from, to: new Date('2026-12-01T00:00:00Z') })

  const sent = JSON.parse(String(doFetch.calls[0].init.body)) as { timeMin: string; timeMax: string }
  const days = (new Date(sent.timeMax).getTime() - new Date(sent.timeMin).getTime()) / 86_400_000
  assert.equal(days, 90)
})

// ── auth failures ─────────────────────────────────────────────────────────────

test('a 401 triggers one forced token refresh and then succeeds', async () => {
  const doFetch = fakeFetch([
    { status: 401, body: { error: { message: 'Invalid Credentials' } } },
    { status: 200, body: { calendars: { primary: { busy: [] } } } },
  ])

  const asked: boolean[] = []
  const source = async (opts?: { forceRefresh?: boolean }) => {
    asked.push(opts?.forceRefresh === true)
    return 'access-token'
  }

  await new GoogleCalendarProvider(source, 'primary', doFetch).busy(RANGE)
  // First attempt uses the cached token; the retry demands a fresh one.
  assert.deepEqual(asked, [false, true])
})

test('a second 401 is an auth failure, not an infinite retry', async () => {
  const doFetch = fakeFetch([
    { status: 401, body: { error: { message: 'Invalid Credentials' } } },
    { status: 401, body: { error: { message: 'Invalid Credentials' } } },
  ])
  await assert.rejects(
    () => new GoogleCalendarProvider(token, 'primary', doFetch).busy(RANGE),
    CalendarAuthError,
  )
})

test('a rate limit is transient, not a revocation', async () => {
  // Marking a rate-limited connection revoked would stop Ava booking for a client whose
  // calendar is perfectly healthy.
  const doFetch = fakeFetch([{
    status: 403,
    body: { error: { message: 'Rate Limit Exceeded', errors: [{ reason: 'rateLimitExceeded' }] } },
  }])

  await assert.rejects(
    () => new GoogleCalendarProvider(token, 'primary', doFetch).busy(RANGE),
    (e: Error) => e instanceof CalendarError && !(e instanceof CalendarAuthError),
  )
})

test('a 403 for any other reason is an auth failure', async () => {
  const doFetch = fakeFetch([{
    status: 403,
    body: { error: { message: 'Forbidden', errors: [{ reason: 'insufficientPermissions' }] } },
  }])
  await assert.rejects(
    () => new GoogleCalendarProvider(token, 'primary', doFetch).busy(RANGE),
    CalendarAuthError,
  )
})

test('a network failure is transient', async () => {
  const doFetch = (async () => { throw new Error('TimeoutError: signal timed out') }) as FetchLike
  await assert.rejects(
    () => new GoogleCalendarProvider(token, 'primary', doFetch).busy(RANGE),
    (e: Error) => e instanceof CalendarError && /unreachable/.test(e.message),
  )
})

// ── events ────────────────────────────────────────────────────────────────────

const EVENT = {
  summary:  'Roof inspection — John Smith',
  startsAt: new Date('2026-08-12T15:00:00Z'),
  endsAt:   new Date('2026-08-12T16:00:00Z'),
  timeZone: 'America/Chicago',
}

test('createEvent sends the instant with the display timezone', async () => {
  // dateTime alone would render an 11:00 AM appointment as 4:00 PM for an owner whose calendar
  // defaults to UTC.
  const doFetch = fakeFetch([{ status: 200, body: { id: 'evt_123' } }])
  const result = await new GoogleCalendarProvider(token, 'primary', doFetch).createEvent(EVENT)

  assert.equal(result.id, 'evt_123')
  const sent = JSON.parse(String(doFetch.calls[0].init.body)) as Record<string, { dateTime: string; timeZone: string }>
  assert.equal(sent.start.dateTime, '2026-08-12T15:00:00.000Z')
  assert.equal(sent.start.timeZone, 'America/Chicago')
  assert.equal(sent.end.timeZone,   'America/Chicago')
})

test('createEvent throws when Google returns no id', async () => {
  // Storing an undefined event id would leave the booking looking synced with nothing to patch
  // or cancel later.
  const doFetch = fakeFetch([{ status: 200, body: {} }])
  await assert.rejects(
    () => new GoogleCalendarProvider(token, 'primary', doFetch).createEvent(EVENT),
    /returned no id/,
  )
})

test('updateEvent sends only the fields supplied', async () => {
  // The lead-adoption backfill knows the caller's name and nothing else. A full update would
  // blank the times and location.
  const doFetch = fakeFetch([{ status: 200, body: { id: 'evt_123' } }])
  await new GoogleCalendarProvider(token, 'primary', doFetch)
    .updateEvent('evt_123', { summary: 'Roof inspection — John Smith' })

  assert.equal(doFetch.calls[0].init.method, 'PATCH')
  assert.deepEqual(JSON.parse(String(doFetch.calls[0].init.body)), { summary: 'Roof inspection — John Smith' })
})

test('deleting an event that is already gone is not an error', async () => {
  // Someone removed it in the Google UI. That is the desired end state, so reporting failure
  // would make a cancellation retry something already done.
  const doFetch = fakeFetch([{ status: 404, body: { error: { message: 'Not Found' } } }])
  await new GoogleCalendarProvider(token, 'primary', doFetch).deleteEvent('evt_gone')
})

test('event ids are escaped into the path', async () => {
  const doFetch = fakeFetch([{ status: 204 }])
  await new GoogleCalendarProvider(token, 'my calendar@group.calendar.google.com', doFetch)
    .deleteEvent('evt/../../escape')

  assert.ok(!doFetch.calls[0].url.includes('/../'), 'path traversal in an id must not reach the URL')
  assert.ok(doFetch.calls[0].url.includes('my%20calendar%40group.calendar.google.com'))
})

// ── OAuth ─────────────────────────────────────────────────────────────────────

test('the consent URL asks for offline access and forces the consent screen', () => {
  // Without access_type=offline there is no refresh token at all; without prompt=consent there
  // is none on any *re*-consent, and the connection dies silently an hour after reconnecting.
  const url = new URL(buildAuthUrl({ clientId: 'cid', redirectUri: 'https://x/cb', state: 's' }))
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('prompt'), 'consent')
  assert.equal(url.searchParams.get('state'), 's')
  assert.equal(url.searchParams.get('scope'), GOOGLE_SCOPES.join(' '))
})

test('the requested scopes are freebusy plus events, and nothing wider', () => {
  // The privacy policy commits to exactly this. calendar.readonly would grant event contents
  // we promise never to read, and full calendar scope is what Google asks you to justify away.
  assert.deepEqual(GOOGLE_SCOPES, [
    'https://www.googleapis.com/auth/calendar.freebusy',
    'https://www.googleapis.com/auth/calendar.events',
  ])
})

test('exchangeCode returns tokens with expiry slack', async () => {
  const doFetch = fakeFetch([{
    status: 200,
    body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: GOOGLE_SCOPES.join(' ') },
  }])

  const before = Date.now()
  const tokens = await exchangeCode(
    { code: 'c', clientId: 'i', clientSecret: 's', redirectUri: 'https://x/cb' },
    doFetch,
  )

  assert.equal(tokens.accessToken, 'at')
  assert.equal(tokens.refreshToken, 'rt')
  assert.deepEqual(tokens.scopes, GOOGLE_SCOPES)
  // 60s short of the stated hour, so a token cannot expire between the check and the request.
  const lifetimeMs = tokens.expiresAt.getTime() - before
  assert.ok(lifetimeMs <= 3540_000 && lifetimeMs > 3500_000, `expected ~3540s of life, got ${lifetimeMs}ms`)
})

test('invalid_grant is an auth failure, so nothing retries it', async () => {
  // The owner revoked access, or the refresh token expired under Testing publishing status.
  const doFetch = fakeFetch([{ status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } }])
  await assert.rejects(
    () => refreshAccessToken({ refreshToken: 'rt', clientId: 'i', clientSecret: 's' }, doFetch),
    CalendarAuthError,
  )
})

test('a refresh with no refresh_token in the response keeps the stored one', async () => {
  // Google only returns refresh_token on the initial consent. Overwriting with null here would
  // destroy the connection on its first refresh.
  const doFetch = fakeFetch([{ status: 200, body: { access_token: 'at2', expires_in: 3600 } }])
  const tokens = await refreshAccessToken({ refreshToken: 'rt', clientId: 'i', clientSecret: 's' }, doFetch)
  assert.equal(tokens.refreshToken, null)
})

test('a 5xx from the token endpoint is transient, not a revocation', async () => {
  const doFetch = fakeFetch([{ status: 503, body: { error: 'backendError' } }])
  await assert.rejects(
    () => refreshAccessToken({ refreshToken: 'rt', clientId: 'i', clientSecret: 's' }, doFetch),
    (e: Error) => e instanceof CalendarError && !(e instanceof CalendarAuthError),
  )
})

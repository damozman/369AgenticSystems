import { NextRequest, NextResponse } from 'next/server'
import { encryptToken } from '@/lib/calendar/crypto'
import { exchangeCode, GoogleCalendarProvider, GOOGLE_SCOPES } from '@/lib/calendar/google'
import { googleRedirectUri, resolveOwner, serviceRoleClient } from '@/lib/calendar/owner'

/**
 * Where Google sends the owner back after the consent screen.
 *
 * This URL is registered in the Google Cloud console and must not move. It is also the only
 * place a token is ever written: the RLS policy on `calendar_connections` grants authenticated
 * users select and delete but deliberately no insert or update, so a browser session cannot
 * inject one.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  // The owner pressed "Cancel", or Google refused. Not an error worth logging loudly.
  const googleError = params.get('error')
  if (googleError) {
    return done(request, googleError === 'access_denied' ? 'cancelled' : 'google_error')
  }

  // CSRF: the nonce this browser was issued at /connect must come back. Without this, a crafted
  // link could attach someone else's Google account to whichever business happens to be logged
  // in here.
  const state = params.get('state')
  const expected = request.cookies.get('calendar_oauth_state')?.value
  if (!state || !expected || state !== expected) {
    console.warn('[CALENDAR] OAuth state mismatch — refusing the callback')
    return done(request, 'state_mismatch')
  }

  const code = params.get('code')
  if (!code) return done(request, 'no_code')

  // Re-derived from the session rather than carried in `state`. A value that round-trips through
  // the browser is a value the browser can change, and this one decides which business the
  // token is stored against.
  const owner = await resolveOwner()
  if (!owner) return NextResponse.redirect(new URL('/login', request.url))

  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('[CALENDAR] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set')
    return done(request, 'not_configured')
  }

  try {
    const tokens = await exchangeCode({ code, clientId, clientSecret, redirectUri: googleRedirectUri() })

    // The consent screen lets a user untick individual permissions. Storing a connection that
    // cannot read busy times would leave Ava failing closed on every call with nothing saying
    // why, so it is rejected here where the owner is present to re-consent.
    const missing = GOOGLE_SCOPES.filter(s => !tokens.scopes.includes(s))
    if (missing.length > 0) {
      console.warn(`[CALENDAR] Consent granted without ${missing.join(', ')} — ${owner.clientDomain}`)
      return done(request, 'missing_scopes')
    }

    // Without a refresh token the connection dies within the hour. buildAuthUrl always sends
    // prompt=consent to prevent this, so reaching here means something is wrong with the OAuth
    // client configuration rather than with this particular consent.
    if (!tokens.refreshToken) {
      console.error(`[CALENDAR] No refresh token returned for ${owner.clientDomain} — check access_type/prompt`)
      return done(request, 'no_refresh_token')
    }

    // Prove the grant actually works before telling anyone it does, and learn which account
    // consented. Reporting success and finding out at the next phone call is the failure mode
    // this project has already paid for twice.
    let accountEmail: string | null = null
    try {
      const probe = await new GoogleCalendarProvider(async () => tokens.accessToken, 'primary').probe()
      accountEmail = probe.calendarKey
    } catch (e) {
      console.error('[CALENDAR] New connection failed its first read:', (e as Error).message)
      return done(request, 'probe_failed')
    }

    // Upsert: reconnecting after a revocation has to replace the dead row, and status must go
    // back to 'active' or the reconnect would appear to do nothing.
    const { error } = await serviceRoleClient()
      .from('calendar_connections')
      .upsert({
        client_domain:           owner.clientDomain,
        provider:                'google',
        account_email:           accountEmail,
        calendar_id:             'primary',
        access_token_enc:        encryptToken(tokens.accessToken),
        refresh_token_enc:       encryptToken(tokens.refreshToken),
        access_token_expires_at: tokens.expiresAt.toISOString(),
        scopes:                  tokens.scopes,
        status:                  'active',
        last_error:              null,
        // Cleared so a future breakage alerts again rather than being suppressed by the last one.
        alerted_at:              null,
        last_ok_at:              new Date().toISOString(),
        updated_at:              new Date().toISOString(),
      }, { onConflict: 'client_domain' })

    if (error) {
      console.error('[CALENDAR] Could not store the connection:', error.message)
      return done(request, 'store_failed')
    }

    console.log(`[CALENDAR] ✓  Connected ${accountEmail ?? 'a Google account'} → ${owner.clientDomain}`)
    return done(request, null)
  } catch (e) {
    console.error('[CALENDAR] OAuth callback failed:', (e as Error).message)
    return done(request, 'exchange_failed')
  }
}

/** Back to the dashboard either way, clearing the one-shot CSRF cookie. */
function done(request: NextRequest, error: string | null) {
  const url = new URL('/client-dashboard', request.url)
  if (error) url.searchParams.set('calendar_error', error)
  else url.searchParams.set('calendar', 'connected')

  const response = NextResponse.redirect(url)
  response.cookies.delete('calendar_oauth_state')
  return response
}

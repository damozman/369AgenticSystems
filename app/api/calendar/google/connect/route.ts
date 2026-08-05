import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { buildAuthUrl } from '@/lib/calendar/google'
import { googleRedirectUri, resolveOwner } from '@/lib/calendar/owner'

/**
 * Start the Google Calendar connection.
 *
 * Owner-initiated only — the privacy policy says connecting is optional and initiated by the
 * business owner, and this route is the only way in. There is no admin path that connects a
 * calendar on a client's behalf, deliberately: consent has to come from the person whose
 * calendar it is.
 *
 * Not covered by middleware.ts (its matcher lists page prefixes, not /api), so the session check
 * happens here.
 */
export async function GET(request: NextRequest) {
  const owner = await resolveOwner()
  if (!owner) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    // Named explicitly rather than a generic 503: this is the first thing to go wrong when the
    // Vercel env vars were added but the project was not redeployed, and Vercel bakes env vars
    // in at build time.
    console.error('[CALENDAR] GOOGLE_CLIENT_ID is not set — cannot start the OAuth flow')
    return redirectToDashboard(request, 'not_configured')
  }

  // CSRF. The nonce goes to Google as `state` and into an httpOnly cookie; the callback only
  // proceeds when the two match, so a link someone else crafted cannot attach *their* Google
  // account to this owner's business.
  const state = randomBytes(24).toString('base64url')

  const response = NextResponse.redirect(
    buildAuthUrl({ clientId, redirectUri: googleRedirectUri(), state }),
  )

  response.cookies.set('calendar_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must survive the redirect back from accounts.google.com
    path:     '/',
    maxAge:   600,   // ten minutes is longer than any real consent takes
  })

  return response
}

function redirectToDashboard(request: NextRequest, error: string) {
  const url = new URL('/client-dashboard', request.url)
  url.searchParams.set('calendar_error', error)
  return NextResponse.redirect(url)
}

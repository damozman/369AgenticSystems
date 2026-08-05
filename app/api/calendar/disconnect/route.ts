import { NextResponse } from 'next/server'
import { decryptTokenOrNull } from '@/lib/calendar/crypto'
import { revokeToken } from '@/lib/calendar/google'
import { resolveOwner, serviceRoleClient } from '@/lib/calendar/owner'
import { loadConnectionAnyStatus } from '@/lib/calendar/tokens'

/**
 * Disconnect a calendar.
 *
 * The privacy policy promises that revoking "deletes the stored token and stops all calendar
 * access immediately", so this genuinely deletes the row rather than soft-flagging it. Anything
 * less would make the policy inaccurate, and the policy is what the Google verification is
 * assessed against.
 *
 * POST, not GET: a GET would let an <img> tag on any page disconnect a logged-in owner's
 * calendar.
 */
export async function POST() {
  const owner = await resolveOwner()
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serviceRoleClient()
  const connection = await loadConnectionAnyStatus(supabase, owner.clientDomain)

  if (!connection) {
    // Already disconnected. Idempotent, because the dashboard button is exactly the thing
    // someone double-clicks.
    return NextResponse.json({ success: true, alreadyDisconnected: true })
  }

  // Best-effort at Google's end. Deleting our row stops all access regardless, so a failure
  // here must not leave the owner unable to disconnect — but revoking properly is what makes
  // the token dead rather than merely unreachable.
  let revoked = false
  try {
    const refreshToken = decryptTokenOrNull(connection.refresh_token_enc)
    if (refreshToken) revoked = await revokeToken(refreshToken)
  } catch (e) {
    // A token that will not decrypt cannot be revoked. Worth recording, not worth blocking on.
    console.warn('[CALENDAR] Could not decrypt token for revocation:', (e as Error).message)
  }

  const { error } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('client_domain', owner.clientDomain)

  if (error) {
    console.error('[CALENDAR] Disconnect failed to delete the row:', error.message)
    return NextResponse.json({ error: 'Could not disconnect the calendar' }, { status: 500 })
  }

  console.log(`[CALENDAR] ✓  Disconnected ${owner.clientDomain} (revoked at Google: ${revoked})`)
  return NextResponse.json({ success: true, revokedAtGoogle: revoked })
}

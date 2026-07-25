import { NextResponse } from 'next/server'
import { secretGate } from './authz'

// Header names for the two server-side trust boundaries.
//  - RETELL: routes hit by Retell's infrastructure (webhook + agent tool calls)
//  - INTERNAL: server-to-server fan-out between our own API routes
export const RETELL_SECRET_HEADER = 'x-webhook-secret'
export const INTERNAL_SECRET_HEADER = 'x-internal-secret'

/**
 * Returns a 401 NextResponse when a shared secret is configured AND the incoming
 * request does not present the matching token; returns null (proceed) otherwise.
 *
 * When the secret env var is unset it returns null — so adding this guard changes
 * NO behavior until the operator sets the env var (dormant, non-breaking rollout).
 * Uses a constant-time comparison under the hood (see secretGate/timingSafeEqualStr).
 */
export function denyIfBadSecret(
  request: Request,
  expected: string | undefined,
  headerName: string,
): NextResponse | null {
  const provided = request.headers.get(headerName) ?? undefined
  if (secretGate(expected, provided) === 'deny') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * Retell-facing guard. Accepts the shared secret from EITHER the x-webhook-secret
 * header OR a `?secret=` query parameter — because Retell's webhook config offers
 * no custom-header field (only a URL), so the webhook can only carry the secret in
 * its URL, while custom tools can use the header. Same enforce-only-when-configured
 * semantics: returns null (proceed) when RETELL_WEBHOOK_SECRET is unset.
 *
 * Note: the query-param form means the secret appears in request-log URLs. That's
 * acceptable for a single-operator setup (logs aren't public and the secret is
 * rotatable), and it's the only channel Retell's webhook exposes.
 */
export function denyIfBadRetellSecret(request: Request): NextResponse | null {
  const expected = process.env.RETELL_WEBHOOK_SECRET
  if (!expected) return null // dormant until configured
  const fromHeader = request.headers.get(RETELL_SECRET_HEADER) ?? undefined
  const fromQuery = new URL(request.url).searchParams.get('secret') ?? undefined
  const provided = fromHeader ?? fromQuery
  if (secretGate(expected, provided) === 'deny') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * Headers for a server-to-server call to one of our own internal routes. Attaches
 * the internal shared secret when configured, so a guarded callee accepts the call.
 * When the secret is unset, only Content-Type is sent (callee is also dormant).
 */
export function internalHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET
  return {
    'Content-Type': 'application/json',
    ...(secret ? { [INTERNAL_SECRET_HEADER]: secret } : {}),
  }
}

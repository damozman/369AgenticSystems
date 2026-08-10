import { NextResponse } from 'next/server'
import { secretGate, secretGateEither } from './authz'

// Header names for the two server-side trust boundaries.
//  - RETELL: routes hit by Retell's infrastructure (webhook + agent tool calls)
//  - INTERNAL: server-to-server fan-out between our own API routes
export const RETELL_SECRET_HEADER = 'x-webhook-secret'
export const INTERNAL_SECRET_HEADER = 'x-internal-secret'
//  - EMAIL_INGEST: whatever inbound-mail service posts parsed messages to /api/email-ingest
export const EMAIL_INGEST_SECRET_HEADER = 'x-email-secret'

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
 * Accepts the shared secret from EITHER a header OR a `?secret=` query parameter.
 *
 * Both channels exist because several third-party senders offer no custom-header field, only a
 * URL — Retell's webhook config and SendGrid's Inbound Parse are both like this. The header is
 * preferred where the sender supports it (Retell's custom tools do).
 *
 * Same enforce-only-when-configured semantics as denyIfBadSecret: returns null (proceed) when
 * the env var is unset, so adding this guard changes nothing until the operator sets it.
 *
 * Note: the query-param form means the secret appears in request-log URLs. That's acceptable for
 * a single-operator setup — logs aren't public and the secret is rotatable — and for these
 * senders it is the only channel on offer.
 */
export function denyIfBadSecretHeaderOrQuery(
  request: Request,
  expected: string | undefined,
  headerName: string,
): NextResponse | null {
  // The decision lives in authz.ts so it can be unit-tested — this file imports next/server,
  // which the bare node test runner cannot resolve. See secretGateEither for why the two
  // channels are resolved to one value before gating rather than checked in sequence.
  const fromHeader = request.headers.get(headerName)
  const fromQuery = new URL(request.url).searchParams.get('secret')
  if (secretGateEither(expected, fromHeader, fromQuery) === 'deny') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/** Retell-facing guard. See denyIfBadSecretHeaderOrQuery for why both channels are accepted. */
export function denyIfBadRetellSecret(request: Request): NextResponse | null {
  return denyIfBadSecretHeaderOrQuery(request, process.env.RETELL_WEBHOOK_SECRET, RETELL_SECRET_HEADER)
}

/**
 * Inbound-email guard, for whatever service is pointed at /api/email-ingest.
 *
 * `respond.369agenticsystems.com` still has a live MX record pointing at mx.sendgrid.net, so the
 * plumbing for an inbound sender exists even though nothing has ever delivered through it.
 */
export function denyIfBadEmailIngestSecret(request: Request): NextResponse | null {
  return denyIfBadSecretHeaderOrQuery(request, process.env.EMAIL_INGEST_SECRET, EMAIL_INGEST_SECRET_HEADER)
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

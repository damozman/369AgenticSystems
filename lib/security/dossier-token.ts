/**
 * Signed links for the dossier review page.
 *
 * Same shape as `onboarding-token.ts` and for the same reason: the reviewer arrives from an email
 * rather than a session, so the link itself has to carry the proof. Bound to the dossier id, so a
 * token for one dossier cannot approve another — a gate that only proves "someone once received an
 * email from us" is not a gate.
 *
 * **Short TTL on purpose.** An onboarding link lives 90 days because a client may take that long to
 * fill a form. An approval link authorises sending mail to a third party, and a stale one sitting
 * in an inbox is a standing permission nobody remembers granting. Seven days is longer than any
 * queue should ever be, which is itself the point.
 *
 * ⚠️ **The token alone must never be enough to send.** Mail scanners and link-preview bots issue
 * GET requests to every URL in a message, so a bare `?approve=1` link would approve every dossier
 * the moment the email arrived, with nobody having read a word. The token authorises *viewing* the
 * review page; approval is a POST from that page. See `app/api/dossier/approve/route.ts`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Long enough for a weekend, short enough that a forgotten link expires. */
export const DOSSIER_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

export type DossierTokenCheck =
  | { valid: true }
  | { valid: false; reason: 'missing' | 'malformed' | 'expired' | 'bad-signature' | 'not-configured' }

function secret(): string | null {
  // Reuses the onboarding secret deliberately: one secret to rotate, and it already exists in
  // Vercel. If they ever need to differ, add DOSSIER_TOKEN_SECRET and prefer it here.
  const s = process.env.DOSSIER_TOKEN_SECRET || process.env.ONBOARDING_TOKEN_SECRET
  return s && s.length > 0 ? s : null
}

function sign(dossierId: string, expiry: number, key: string): string {
  return createHmac('sha256', key).update(`dossier:${dossierId}:${expiry}`).digest('hex')
}

/** Null when no secret is configured, so a caller can refuse to send a link rather than send a broken one. */
export function mintDossierToken(
  dossierId: string,
  ttlSeconds: number = DOSSIER_TOKEN_TTL_SECONDS,
): string | null {
  const key = secret()
  if (!key) return null
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds
  return `${expiry}.${sign(dossierId, expiry, key)}`
}

export function dossierReviewUrl(
  dossierId: string,
  origin = 'https://369agenticsystems.com',
): string | null {
  const token = mintDossierToken(dossierId)
  return token ? `${origin}/dossier/review/${dossierId}?t=${encodeURIComponent(token)}` : null
}

export function verifyDossierToken(
  token: string | null | undefined,
  dossierId: string,
): DossierTokenCheck {
  const key = secret()
  if (!key) return { valid: false, reason: 'not-configured' }
  if (!token) return { valid: false, reason: 'missing' }

  const [expiryPart, providedHex] = token.split('.')
  if (!expiryPart || !providedHex) return { valid: false, reason: 'malformed' }

  const expiry = Number(expiryPart)
  if (!Number.isFinite(expiry)) return { valid: false, reason: 'malformed' }

  const expected = sign(dossierId, expiry, key)
  // Compare before checking expiry, and in constant time: an early return on length or content
  // leaks whether a signature was close.
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(providedHex, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad-signature' }
  }
  if (Math.floor(Date.now() / 1000) > expiry) return { valid: false, reason: 'expired' }

  return { valid: true }
}

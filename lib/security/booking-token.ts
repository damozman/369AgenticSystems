import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * A signed handle for one offered slot, minted by /api/available-slots and spent by
 * /api/book-appointment.
 *
 * **Why this exists.** `book_appointment` has carried `item` and `rental_days` as parameters
 * since 2026-08-20, and on a real call that same day Ava called the tool with neither — booking a
 * one-hour appointment while telling the caller a dance floor was theirs for three days. The
 * prompt had been strengthened twice by then. Asking a model to re-supply, from memory, values it
 * was handed two turns earlier is a request that will be dropped eventually; the fix is to stop
 * asking. The token carries the item and the exact interval, so booking the wrong thing requires
 * the model to *corrupt* a value rather than merely *omit* one.
 *
 * **Why it is signed.** The token crosses the model. An unsigned handle could be invented, and a
 * hallucinated item key or interval must not become a booking — so a token that does not verify is
 * refused rather than parsed leniently. Signing turns a plausible-looking fabrication into a
 * failure, which is the direction that keeps a unit off the wrong van.
 *
 * **Why `RETELL_WEBHOOK_SECRET`.** Deliberately not `ONBOARDING_TOKEN_SECRET`: rotating that one
 * invalidates every questionnaire link already emailed, and coupling booking to it would mean a
 * routine rotation silently broke the phone line. This token lives on exactly the trust boundary
 * the Retell secret already guards — our route, out to Retell, back to our route — and is already
 * set in production, so nothing new has to be configured for this to work.
 *
 * **Absence is normal.** No secret, or no token on the request, falls back to the prose fields
 * exactly as before. Every existing client books people-time with no token at all.
 */

/** Two hours. Longer than any call, short enough that a leaked handle is worthless by morning. */
export const BOOKING_TOKEN_TTL_SECONDS = 2 * 60 * 60

export interface BookingOffer {
  /** null for a people-time slot — the load-bearing case every existing client is in. */
  itemKey: string | null
  startsAt: Date
  endsAt: Date
}

export type BookingTokenCheck =
  | { valid: true; offer: BookingOffer }
  | { valid: false; reason: 'missing' | 'malformed' | 'expired' | 'bad-signature' | 'not-configured' }

function secret(): string | null {
  const s = process.env.RETELL_WEBHOOK_SECRET
  return s && s.length > 0 ? s : null
}

/**
 * Truncated to 16 hex characters.
 *
 * The model has to copy this string from a tool result into its next tool call, and every
 * character is a chance to drop one. 64 bits is far past what a forger could guess inside a
 * two-hour window against a route that refuses on the first bad signature, and it keeps the whole
 * token short enough to survive being carried across a turn.
 */
function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('hex').slice(0, 16)
}

/**
 * `<itemKey>|<startEpoch>|<endEpoch>|<expiryEpoch>` — base64url, then a dot, then the signature.
 *
 * Seconds rather than ISO strings, and a bare pipe-joined string rather than JSON, purely to keep
 * it short: this is a value a language model must reproduce exactly.
 */
export function mintBookingToken(offer: BookingOffer, ttlSeconds: number = BOOKING_TOKEN_TTL_SECONDS): string | null {
  const key = secret()
  if (!key) return null

  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds
  const raw = [
    offer.itemKey ?? '',
    Math.floor(offer.startsAt.getTime() / 1000),
    Math.floor(offer.endsAt.getTime() / 1000),
    expiry,
  ].join('|')

  const payload = Buffer.from(raw, 'utf8').toString('base64url')
  return `${payload}.${sign(payload, key)}`
}

/** Verify and unpack. Anything that does not verify is refused, never partially trusted. */
export function verifyBookingToken(token: string | null | undefined): BookingTokenCheck {
  const key = secret()
  if (!key) return { valid: false, reason: 'not-configured' }
  if (!token) return { valid: false, reason: 'missing' }

  const [payload, provided] = token.split('.')
  if (!payload || !provided) return { valid: false, reason: 'malformed' }

  const expected = sign(payload, key)
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // Length first — timingSafeEqual throws on a mismatch rather than returning false.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, reason: 'bad-signature' }

  // Only decoded AFTER the signature holds, so a forged payload is never parsed at all.
  const parts = Buffer.from(payload, 'base64url').toString('utf8').split('|')
  if (parts.length !== 4) return { valid: false, reason: 'malformed' }

  const [itemKey, startS, endS, expS] = parts
  const start = Number(startS), end = Number(endS), exp = Number(expS)
  if (![start, end, exp].every(Number.isFinite)) return { valid: false, reason: 'malformed' }
  if (exp < Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' }
  if (end <= start) return { valid: false, reason: 'malformed' }

  return {
    valid: true,
    offer: {
      itemKey: itemKey === '' ? null : itemKey,
      startsAt: new Date(start * 1000),
      endsAt: new Date(end * 1000),
    },
  }
}

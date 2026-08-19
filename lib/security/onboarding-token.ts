import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed links for onboarding.
 *
 * `/api/questionnaire/submit` had no ownership check at all: it confirmed the client_domain
 * existed and then wrote that client's questionnaire, their working hours, their rental stock,
 * and — via syncQuestionnaireToKB — the `general_prompt` of their **live Retell agent**. Any
 * unauthenticated POST naming a known domain could do all of it. Same class as the
 * /api/update-dossier open relay deleted on 2026-08-03, except this one reaches the phone line.
 *
 * The obvious fix, requiring a login, is the wrong one on its own. The questionnaire is clicked
 * from the welcome email seconds after payment, when the client has no session — auth here is
 * Supabase OTP, so "log in" means going back to their inbox for a second email, at the highest
 * drop-off moment in the funnel. So the emailed link carries its own proof instead, exactly like
 * a magic link, and a logged-in owner is accepted separately for edits made later.
 *
 * Token format: `<expiry-epoch-seconds>.<hmac-hex>`, signed over `domain:expiry`. The expiry is
 * inside the signed payload, so it cannot be extended by editing the URL.
 */

/** 90 days. Long on purpose: a client who fills the form three weeks late must not be locked out. */
export const ONBOARDING_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60

export type TokenCheck =
  | { valid: true }
  | { valid: false; reason: 'missing' | 'malformed' | 'expired' | 'bad-signature' | 'not-configured' }

function secret(): string | null {
  const s = process.env.ONBOARDING_TOKEN_SECRET
  return s && s.length > 0 ? s : null
}

function sign(clientDomain: string, expiry: number, key: string): string {
  return createHmac('sha256', key).update(`${clientDomain}:${expiry}`).digest('hex')
}

/**
 * Mint a token for a link. Returns null when no secret is configured, so callers can fall back
 * to an unsigned URL rather than emailing a link with the literal word "null" in it.
 */
export function mintOnboardingToken(
  clientDomain: string,
  ttlSeconds: number = ONBOARDING_TOKEN_TTL_SECONDS,
): string | null {
  const key = secret()
  if (!key) return null
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds
  return `${expiry}.${sign(clientDomain, expiry, key)}`
}

/** The questionnaire URL, with proof attached when we are able to attach it. */
export function questionnaireUrl(clientDomain: string, origin = 'https://369agenticsystems.com'): string {
  const base = `${origin}/onboarding/questionnaire/${clientDomain}`
  const token = mintOnboardingToken(clientDomain)
  return token ? `${base}?t=${encodeURIComponent(token)}` : base
}

/**
 * Verify a token against the domain it claims to authorise.
 *
 * Binding to the domain is the point: a valid token for one client must not authorise writes to
 * another, or the gate only proves that someone, somewhere, once received an onboarding email.
 */
export function verifyOnboardingToken(token: string | null | undefined, clientDomain: string): TokenCheck {
  const key = secret()
  if (!key) return { valid: false, reason: 'not-configured' }
  if (!token) return { valid: false, reason: 'missing' }

  const [expiryPart, providedHex] = token.split('.')
  const expiry = Number(expiryPart)
  if (!providedHex || !Number.isFinite(expiry)) return { valid: false, reason: 'malformed' }
  if (expiry < Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' }

  const expectedHex = sign(clientDomain, expiry, key)
  const provided = Buffer.from(providedHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  // Length must match before timingSafeEqual, which throws on differing lengths.
  if (provided.length !== expected.length) return { valid: false, reason: 'bad-signature' }
  return timingSafeEqual(provided, expected) ? { valid: true } : { valid: false, reason: 'bad-signature' }
}

/**
 * Whether the gate refuses, or merely reports.
 *
 * Deliberately opt-in. Arming a shared-secret gate has twice broken producers that never got the
 * new secret — the funnel outage and the ten-day call outage — so this ships reporting-only,
 * both producers get verified against real links, and only then is it set to 'true'.
 */
export function onboardingAuthEnforced(): boolean {
  return process.env.ONBOARDING_AUTH_ENFORCED === 'true'
}

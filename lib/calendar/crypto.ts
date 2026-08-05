/**
 * Encryption for stored OAuth tokens.
 *
 * A refresh token is standing access to a client's calendar for as long as they don't notice
 * and revoke it, so it does not sit in the database in plaintext. AES-256-GCM because it is
 * authenticated — a tampered ciphertext fails to decrypt rather than silently yielding garbage
 * that then gets sent to Google as a bearer token.
 *
 * `node:crypto` only. No dependency, and the same reasoning as lib/availability.ts's refusal to
 * add a date library: this is a hundred lines of standard-library work.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // 96 bits, the GCM standard — not 16
const KEY_BYTES = 32

/**
 * Resolved per call rather than at module load.
 *
 * Reading env at import time means a missing key throws while Next is collecting page data
 * during `next build`, which fails the build for every route that transitively imports this —
 * including ones that never touch a calendar. Failing at the point of use keeps the blast
 * radius to the request that actually needed a token.
 */
function loadKey(explicit?: string): Buffer {
  const raw = explicit ?? process.env.CALENDAR_TOKEN_KEY
  if (!raw) {
    throw new Error(
      'CALENDAR_TOKEN_KEY is not set — cannot read or write calendar tokens. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    )
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    // A too-short key is the failure mode of pasting a truncated value into Vercel, and
    // createCipheriv's own error ("Invalid key length") does not say which key or why.
    throw new Error(
      `CALENDAR_TOKEN_KEY must be ${KEY_BYTES} bytes base64-encoded, got ${key.length}. ` +
      'It was probably truncated when it was copied.',
    )
  }
  return key
}

/**
 * → `v1:<iv>:<authTag>:<ciphertext>`, all base64.
 *
 * The version prefix is there so a future key rotation or algorithm change can recognise old
 * values instead of throwing on them.
 */
export function encryptToken(plaintext: string, key?: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, loadKey(key), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return ['v1', iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/**
 * Throws on a malformed value, the wrong key, or tampering. Callers treat that as "this
 * connection is unusable" rather than papering over it — a token that will not decrypt cannot
 * be sent to Google, and pretending otherwise would surface as a confusing 401 from a third
 * party instead of a clear local fault.
 */
export function decryptToken(encoded: string, key?: string): string {
  const parts = (encoded ?? '').split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Stored calendar token is not in the expected v1 format')
  }

  const [, ivB64, tagB64, ctB64] = parts
  const decipher = createDecipheriv(ALGORITHM, loadKey(key), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))

  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}

/** Null-tolerant, because `refresh_token_enc` is genuinely null on a connection mid-repair. */
export function decryptTokenOrNull(encoded: string | null | undefined, key?: string): string | null {
  if (!encoded) return null
  return decryptToken(encoded, key)
}

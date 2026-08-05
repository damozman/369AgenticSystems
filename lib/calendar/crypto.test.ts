import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'crypto'
import { decryptToken, decryptTokenOrNull, encryptToken } from './crypto.ts'

/**
 * These tokens are standing access to a client's Google Calendar. The tests below are aimed at
 * the two ways stored ciphertext goes wrong in practice: a key that was truncated on its way
 * into Vercel, and a value that has been altered in the database.
 */

const KEY = randomBytes(32).toString('base64')

test('round-trips a token', () => {
  const token = '1//0gLONG-refresh-token_with.punctuation-and-dashes'
  assert.equal(decryptToken(encryptToken(token, KEY), KEY), token)
})

test('produces a different ciphertext each time', () => {
  // A fresh IV per encryption. Identical ciphertexts would let anyone reading the table see
  // which two clients connected the same Google account.
  const a = encryptToken('same-token', KEY)
  const b = encryptToken('same-token', KEY)
  assert.notEqual(a, b)
  assert.equal(decryptToken(a, KEY), decryptToken(b, KEY))
})

test('carries the v1 format marker', () => {
  const parts = encryptToken('x', KEY).split(':')
  assert.equal(parts.length, 4)
  assert.equal(parts[0], 'v1')
})

test('rejects a token encrypted under a different key', () => {
  const other = randomBytes(32).toString('base64')
  assert.throws(() => decryptToken(encryptToken('secret', KEY), other))
})

test('rejects a tampered ciphertext rather than returning garbage', () => {
  // The whole reason for GCM over CBC: an altered ciphertext must fail, not decrypt into
  // rubbish that then gets sent to Google as a bearer token.
  const encrypted = encryptToken('secret', KEY)
  const parts = encrypted.split(':')
  const ct = Buffer.from(parts[3], 'base64')
  ct[0] ^= 0xff
  parts[3] = ct.toString('base64')
  assert.throws(() => decryptToken(parts.join(':'), KEY))
})

test('rejects a truncated key with a message naming the cause', () => {
  const short = randomBytes(16).toString('base64')
  assert.throws(
    () => encryptToken('x', short),
    /CALENDAR_TOKEN_KEY must be 32 bytes.*got 16/s,
  )
})

test('rejects a value that is not in v1 format', () => {
  assert.throws(() => decryptToken('not-encrypted-at-all', KEY), /not in the expected v1 format/)
  assert.throws(() => decryptToken('v2:a:b:c', KEY), /not in the expected v1 format/)
})

test('decryptTokenOrNull passes null through', () => {
  // refresh_token_enc is genuinely null on a connection mid-repair.
  assert.equal(decryptTokenOrNull(null, KEY), null)
  assert.equal(decryptTokenOrNull(undefined, KEY), null)
  assert.equal(decryptTokenOrNull(encryptToken('t', KEY), KEY), 't')
})

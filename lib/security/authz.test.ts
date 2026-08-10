import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timingSafeEqualStr, secretGate, secretGateEither } from './authz.ts'

// ── timingSafeEqualStr ────────────────────────────────────────────────────────
test('timingSafeEqualStr is true only for exact matches', () => {
  assert.equal(timingSafeEqualStr('s3cret', 's3cret'), true)
  assert.equal(timingSafeEqualStr('s3cret', 's3creT'), false)
})
test('timingSafeEqualStr is false for length mismatch (no throw)', () => {
  assert.equal(timingSafeEqualStr('short', 'longer-value'), false)
  assert.equal(timingSafeEqualStr('', 'x'), false)
})

// ── secretGate — enforce-only-when-configured ─────────────────────────────────
test('secretGate is dormant (allow) when no secret is configured', () => {
  // Current production state: env var unset → behavior unchanged, nothing breaks.
  assert.equal(secretGate(undefined, undefined), 'allow')
  assert.equal(secretGate('', 'anything'), 'allow')
  assert.equal(secretGate(null, null), 'allow')
})
test('secretGate denies an attacker with no / wrong token once configured', () => {
  assert.equal(secretGate('real-secret', undefined), 'deny')
  assert.equal(secretGate('real-secret', ''), 'deny')
  assert.equal(secretGate('real-secret', 'guess'), 'deny')
})
test('secretGate allows the legitimate caller once configured', () => {
  assert.equal(secretGate('real-secret', 'real-secret'), 'allow')
})

// ── secretGateEither: header OR query ─────────────────────────────────────────
/**
 * Pinned because the obvious implementation is wrong.
 *
 * The first attempt chained two guards — gate the header, fall through to gating the query.
 * That rejects every request carrying the secret in the URL, because the header gate denies on a
 * missing header before the query is ever looked at. Retell's webhook and SendGrid's Inbound
 * Parse can only send the secret in the URL, so that bug would have locked out precisely the
 * senders the second channel exists for.
 */

test('secretGateEither is dormant until a secret is configured', () => {
  // The whole rollout strategy depends on this: a guard that enforced immediately would break
  // every existing producer the moment it merged.
  assert.equal(secretGateEither(undefined, null, null), 'allow')
  assert.equal(secretGateEither('', 'anything', null), 'allow')
})

test('secretGateEither accepts the secret from the header', () => {
  assert.equal(secretGateEither('s3cr3t', 's3cr3t', null), 'allow')
})

test('secretGateEither accepts the secret from the query — the case a chained guard breaks', () => {
  // No header at all. A header-first guard would already have denied by here.
  assert.equal(secretGateEither('s3cr3t', null, 's3cr3t'), 'allow')
})

test('secretGateEither denies when neither channel carries it', () => {
  assert.equal(secretGateEither('s3cr3t', null, null), 'deny')
})

test('secretGateEither denies a wrong value in either channel', () => {
  assert.equal(secretGateEither('s3cr3t', 'wrong', null), 'deny')
  assert.equal(secretGateEither('s3cr3t', null, 'wrong'), 'deny')
})

test('a correct header wins over a wrong query param', () => {
  // The header is the preferred channel wherever a sender supports it.
  assert.equal(secretGateEither('s3cr3t', 's3cr3t', 'wrong'), 'allow')
})

test('an empty value in a channel is not a free pass, it falls through to the other', () => {
  // A sender that emits a bare `?secret=` must not authenticate, but must also not mask a
  // valid header.
  assert.equal(secretGateEither('s3cr3t', '', ''), 'deny')
  assert.equal(secretGateEither('s3cr3t', '', 's3cr3t'), 'allow')
})

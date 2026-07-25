import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timingSafeEqualStr, secretGate } from './authz.ts'

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

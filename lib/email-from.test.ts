import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resendFrom, FALLBACK_FROM_ADDRESS } from './email-from.ts'

const ORIGINAL = process.env.RESEND_FROM_EMAIL

function withFrom(value: string | undefined, fn: () => void) {
  if (value === undefined) delete process.env.RESEND_FROM_EMAIL
  else process.env.RESEND_FROM_EMAIL = value
  try { fn() } finally {
    if (ORIGINAL === undefined) delete process.env.RESEND_FROM_EMAIL
    else process.env.RESEND_FROM_EMAIL = ORIGINAL
  }
}

test('bare address gets the display name applied', () => {
  withFrom('alerts@example.com', () => {
    assert.equal(resendFrom('369 Command Center'), '369 Command Center <alerts@example.com>')
  })
})

test('already-formatted mailbox is NOT double-wrapped — the bug this module exists for', () => {
  withFrom('369 Systems Command <alerts@example.com>', () => {
    const result = resendFrom('369 Command Center')
    assert.equal(result, '369 Command Center <alerts@example.com>')
    // The regression: a nested header like `A <B <x@y>>` is what Resend rejected.
    assert.ok(!/<[^>]*</.test(result), `nested angle brackets present: ${result}`)
  })
})

test('falls back to the default address when the env var is unset', () => {
  withFrom(undefined, () => {
    assert.equal(resendFrom('369 Command Center'), `369 Command Center <${FALLBACK_FROM_ADDRESS}>`)
  })
})

test('surrounding whitespace does not leak into the header', () => {
  withFrom('  369 Systems <alerts@example.com>  ', () => {
    assert.equal(resendFrom('Ops'), 'Ops <alerts@example.com>')
  })
})

test('a display name with header-breaking characters is neutralised', () => {
  withFrom('alerts@example.com', () => {
    assert.equal(resendFrom('Evil" <x@y.com>'), 'Evil x@y.com <alerts@example.com>')
  })
})

test('an empty display name yields a bare address rather than an invalid header', () => {
  withFrom('alerts@example.com', () => {
    assert.equal(resendFrom(''), 'alerts@example.com')
  })
})

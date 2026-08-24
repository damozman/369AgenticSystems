import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { previewEnabled } from '@/lib/lead-engine/preview'

const KEY = 'LEAD_ENGINE_PREVIEW'
afterEach(() => { delete process.env[KEY] })

test('the gate is CLOSED by default', () => {
  delete process.env[KEY]
  assert.equal(previewEnabled(), false, 'an unset variable must not serve draft sites')
})

test('only the exact literal "true" opens the gate', () => {
  process.env[KEY] = 'true'
  assert.equal(previewEnabled(), true)
})

test('every near-miss stays CLOSED', () => {
  // This is the whole safety property of the review fixtures. If someone later "tidies" the check
  // with .trim().toLowerCase(), the two whitespace/case cases below are what should fail — and
  // they are exactly the ones a tidy-up would let through.
  //
  // The cost of failing open is eight fictional businesses, with fictional licence numbers and
  // fictional testimonials, publicly reachable on the production domain.
  for (const value of ['', ' ', 'false', 'False', '0', '1', 'yes', 'on', 'TRUE', 'True', ' true ', 'true ', 'truthy']) {
    process.env[KEY] = value
    assert.equal(
      previewEnabled(), false,
      `LEAD_ENGINE_PREVIEW=${JSON.stringify(value)} must NOT open the preview gate`,
    )
  }
})

test('the check reads the variable at call time, so a deploy cannot cache an open gate', () => {
  delete process.env[KEY]
  assert.equal(previewEnabled(), false)
  process.env[KEY] = 'true'
  assert.equal(previewEnabled(), true)
  process.env[KEY] = 'false'
  assert.equal(previewEnabled(), false)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decidePhotoUpload, decideBatchPhotoUpload, decideResolution, decideRevision, photoRefreshDue,
  MAX_PHOTOS_PER_SITE, MAX_PHOTO_BYTES, MIN_PHOTO_LONG_EDGE, WARN_PHOTO_LONG_EDGE,
  INCLUDED_REVISIONS, REVISION_WINDOW_DAYS,
} from '@/lib/lead-engine/limits'

const JPEG = 'image/jpeg'
const ONE_MB = 1024 * 1024

test('accepts a normal photo', () => {
  assert.deepEqual(decidePhotoUpload({ currentCount: 0, bytes: 2 * ONE_MB, contentType: JPEG }), { allowed: true })
  assert.deepEqual(decidePhotoUpload({ currentCount: MAX_PHOTOS_PER_SITE - 1, bytes: ONE_MB, contentType: 'image/webp' }), { allowed: true })
})

test('refuses the nineteenth photo', () => {
  const d = decidePhotoUpload({ currentCount: MAX_PHOTOS_PER_SITE, bytes: ONE_MB, contentType: JPEG })
  assert.equal(d.allowed, false)
  if (!d.allowed) assert.match(d.reason, new RegExp(String(MAX_PHOTOS_PER_SITE)))
})

test('the size limit is exact at the boundary', () => {
  assert.equal(decidePhotoUpload({ currentCount: 0, bytes: MAX_PHOTO_BYTES, contentType: JPEG }).allowed, true)
  assert.equal(decidePhotoUpload({ currentCount: 0, bytes: MAX_PHOTO_BYTES + 1, contentType: JPEG }).allowed, false)
})

test('accepts HEIC and HEIF at the gate — they are converted server-side, not rejected', () => {
  // Part B, 2026-08-24: an iPhone shoots HEIC by default regardless of what we ask for. Rejecting
  // it here would be asking a non-technical customer to convert a file format by hand; the
  // pipeline (lib/lead-engine/photo-pipeline.ts) converts it to JPEG before sharp ever sees it.
  assert.equal(decidePhotoUpload({ currentCount: 0, bytes: ONE_MB, contentType: 'image/heic' }).allowed, true)
  assert.equal(decidePhotoUpload({ currentCount: 0, bytes: ONE_MB, contentType: 'image/heif' }).allowed, true)
})

test('refuses an unsupported type and names the actual file, not the MIME string', () => {
  const d = decidePhotoUpload({ currentCount: 0, bytes: ONE_MB, contentType: 'application/pdf', filename: 'estimate.pdf' })
  assert.equal(d.allowed, false)
  if (!d.allowed) {
    assert.match(d.reason, /PDF/)
    assert.match(d.reason, /JPG|PNG|WebP/i, 'should say what DOES work, not just what failed')
  }
})

test('refuses an empty or nonsense file size', () => {
  for (const bytes of [0, -1, NaN, Infinity]) {
    assert.equal(decidePhotoUpload({ currentCount: 0, bytes, contentType: JPEG }).allowed, false)
  }
})

test('a batch that fits is allowed, one that overflows names the real numbers', () => {
  assert.equal(decideBatchPhotoUpload({ currentCount: 0, incomingCount: MAX_PHOTOS_PER_SITE }).allowed, true)
  const d = decideBatchPhotoUpload({ currentCount: 0, incomingCount: MAX_PHOTOS_PER_SITE + 4 })
  assert.equal(d.allowed, false)
  if (!d.allowed) {
    assert.match(d.reason, new RegExp(String(MAX_PHOTOS_PER_SITE + 4)))
    assert.match(d.reason, new RegExp(String(MAX_PHOTOS_PER_SITE)))
  }
})

test('a batch counts what the site already has, not just the new files', () => {
  // Ten already stored, ten more selected — 20 total is over 18, even though neither number alone is.
  const d = decideBatchPhotoUpload({ currentCount: 10, incomingCount: 10 })
  assert.equal(d.allowed, false)
})

test('resolution: below the floor rejects, below the warn line stores with a warning, at or above is silent', () => {
  assert.equal(decideResolution(MIN_PHOTO_LONG_EDGE - 1).status, 'reject')
  assert.equal(decideResolution(MIN_PHOTO_LONG_EDGE).status, 'warn')
  assert.equal(decideResolution(WARN_PHOTO_LONG_EDGE - 1).status, 'warn')
  assert.equal(decideResolution(WARN_PHOTO_LONG_EDGE).status, 'ok')
})

test('pre-launch change requests are part of the build, not revisions', () => {
  // Charging for the first version being right would penalise the customer who reads it carefully.
  const d = decideRevision({ revisionsUsed: 0, launchedAt: null })
  assert.equal(d.included, true)
  assert.equal(d.remaining, INCLUDED_REVISIONS)
})

test('both included revisions are usable inside the window', () => {
  const launchedAt = new Date('2026-08-01T00:00:00Z')
  const now = new Date('2026-08-10T00:00:00Z')
  const first  = decideRevision({ revisionsUsed: 0, launchedAt, now })
  const second = decideRevision({ revisionsUsed: 1, launchedAt, now })
  assert.equal(first.included, true)
  assert.equal(first.remaining, 1)
  assert.equal(second.included, true)
  assert.equal(second.remaining, 0)
  assert.match(second.message, /last included revision/i)
})

test('the third revision is billable, and says so before an invoice appears', () => {
  const d = decideRevision({
    revisionsUsed: INCLUDED_REVISIONS,
    launchedAt: new Date('2026-08-01T00:00:00Z'),
    now: new Date('2026-08-10T00:00:00Z'),
  })
  assert.equal(d.included, false)
  assert.equal(d.remaining, 0)
  assert.match(d.message, /confirm the cost/i)
})

test('a revision NEVER refuses — it is recorded and answered either way', () => {
  // Refusing loses the request and the conversation with it, and the request is often how we learn
  // the site is wrong.
  const cases = [
    { revisionsUsed: 0,  launchedAt: null },
    { revisionsUsed: 99, launchedAt: new Date('2026-01-01T00:00:00Z'), now: new Date('2026-08-10T00:00:00Z') },
    { revisionsUsed: 2,  launchedAt: new Date('2026-08-01T00:00:00Z'), now: new Date('2026-08-10T00:00:00Z') },
  ]
  for (const c of cases) {
    const d = decideRevision(c)
    assert.ok(d.message.length > 0)
    assert.ok(!/cannot|refus|denied|not allowed/i.test(d.message), `a refusal leaked into: ${d.message}`)
    assert.ok(/we'll still make this change|part of getting the first version right|included revision/i.test(d.message))
  }
})

test('the window closes on day 30, not gradually', () => {
  const launchedAt = new Date('2026-08-01T00:00:00Z')
  const inside  = new Date(launchedAt.getTime() + (REVISION_WINDOW_DAYS - 0.5) * 86400_000)
  const outside = new Date(launchedAt.getTime() + (REVISION_WINDOW_DAYS + 0.5) * 86400_000)
  assert.equal(decideRevision({ revisionsUsed: 0, launchedAt, now: inside  }).included, true)
  assert.equal(decideRevision({ revisionsUsed: 0, launchedAt, now: outside }).included, false)
})

test('an unparseable launch date is treated as not launched, not as long ago', () => {
  // The generous reading is the safe one: it costs us one revision, where the other way round
  // bills a customer for something they were promised.
  assert.equal(decideRevision({ revisionsUsed: 0, launchedAt: 'not a date' }).included, true)
})

test('the quarterly photo refresh comes due 90 days after launch', () => {
  const launchedAt = new Date('2026-05-01T00:00:00Z')
  assert.equal(photoRefreshDue({ launchedAt, now: new Date('2026-07-01T00:00:00Z') }), false)
  assert.equal(photoRefreshDue({ launchedAt, now: new Date('2026-08-01T00:00:00Z') }), true)
  // A refresh already taken restarts the clock.
  assert.equal(photoRefreshDue({
    launchedAt,
    lastRefreshAt: new Date('2026-07-25T00:00:00Z'),
    now: new Date('2026-08-01T00:00:00Z'),
  }), false)
})

test('a site that never launched is never due a refresh', () => {
  assert.equal(photoRefreshDue({ launchedAt: null }), false)
  assert.equal(photoRefreshDue({ launchedAt: 'nonsense' }), false)
})

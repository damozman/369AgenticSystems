/**
 * `photoFromRow` — the row-to-SitePhoto mapping that `loadPhotos` uses.
 *
 * This file exists because of a bug that nothing else could see. `loadPhotos` selected three
 * columns while the ingest wrote seven, so `is_primary`, `aspect_ratio`, `variants` and
 * `dominant_hex` were written on every upload and read back by nobody: the hero pick never fired,
 * the aspect preferences never fired, and the four-width srcSet reached no visitor. `tsc` was
 * clean and 601 tests passed, because every consumer treats those fields as optional BY DESIGN --
 * which is exactly what made the absence invisible.
 *
 * So the assertions here are about PRESENCE, not just shape.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { photoFromRow, PHOTO_BUCKET } from '@/lib/lead-engine/site'

const BASE = 'https://example.supabase.co'
const url = (p: string) => `${BASE}/storage/v1/object/public/${PHOTO_BUCKET}/${p}`

const variants = [
  { width: 480, webp: 'https://cdn/480.webp', jpg: 'https://cdn/480.jpg' },
  { width: 960, webp: 'https://cdn/960.webp', jpg: 'https://cdn/960.jpg' },
]

test('a fully ingested row carries every field the renderer branches on', () => {
  const p = photoFromRow({
    id: 'p1', storage_path: 'site/photo.jpg', caption: 'The crew',
    is_primary: true, aspect_ratio: 1.3333, variants, dominant_hex: '#4A6E8A',
  }, BASE)

  assert.equal(p.id, 'p1')
  assert.equal(p.url, url('site/photo.jpg'))
  assert.equal(p.caption, 'The crew')
  assert.deepEqual(p.variants, variants)
  assert.equal(p.aspectRatio, 1.3333)
  assert.equal(p.dominantHex, '#4A6E8A')
  assert.equal(p.isPrimary, true)
})

test('⚠ aspect_ratio arrives as a STRING from PostgREST and must become a number', () => {
  // Postgres `numeric` is returned as a string to preserve arbitrary precision. `allocatePhotos`
  // filters on `typeof p.aspectRatio === 'number'`, so passing it through unconverted leaves that
  // filter false forever -- the fix would look correct, this file would pass without this test,
  // and the hero/band aspect preference would stay exactly as dead as it was.
  const p = photoFromRow({ id: 'p', storage_path: 'a.jpg', caption: null, aspect_ratio: '1.7778' }, BASE)

  assert.equal(typeof p.aspectRatio, 'number', 'a string ratio did not become a number')
  assert.equal(p.aspectRatio, 1.7778)
})

test('a pre-pipeline photo still renders, with the optional fields ABSENT rather than defaulted', () => {
  // Photos uploaded before the Part B ingest have none of the four. They must produce a usable
  // SitePhoto, and must OMIT the keys rather than carry nulls -- `allocatePhotos` and
  // `SitePhotoImg` both branch on presence, and a present-but-null field is not the same thing.
  const p = photoFromRow({ id: 'old', storage_path: 'legacy.jpg', caption: null,
    is_primary: false, aspect_ratio: null, variants: null, dominant_hex: null }, BASE)

  assert.equal(p.url, url('legacy.jpg'))
  assert.equal(p.caption, null)
  assert.ok(!('variants' in p), 'variants should be absent, not null')
  assert.ok(!('aspectRatio' in p), 'aspectRatio should be absent, not NaN')
  assert.ok(!('dominantHex' in p), 'dominantHex should be absent')
  assert.ok(!('isPrimary' in p), 'is_primary false must not become a truthy key')
})

test('each field degrades on its own — one missing column does not cost the others', () => {
  const p = photoFromRow({ id: 'p', storage_path: 'a.jpg', caption: null,
    variants, aspect_ratio: null, dominant_hex: '#FFF', is_primary: true }, BASE)

  assert.deepEqual(p.variants, variants)
  assert.equal(p.dominantHex, '#FFF')
  assert.equal(p.isPrimary, true)
  assert.ok(!('aspectRatio' in p), 'a null ratio must not take the other three down with it')
})

test('junk values are refused rather than propagated', () => {
  const p = photoFromRow({ id: 'p', storage_path: 'a.jpg', caption: null,
    aspect_ratio: 'not-a-number', variants: {}, dominant_hex: 42, is_primary: 'yes' }, BASE)

  assert.ok(!('aspectRatio' in p), 'NaN must not reach the allocator')
  assert.ok(!('variants' in p), 'a non-array variants column must not become a variants list')
  assert.ok(!('dominantHex' in p), 'a non-string hex is not a colour')
  // A truthy non-boolean must NOT grant primary: the hero slot is a single winner, and the DB
  // column is a real boolean, so anything else is corruption rather than intent.
  assert.ok(!('isPrimary' in p), 'only a literal true is primary')
})

test('pixel dimensions are read back — the number the hero warning is about', () => {
  // Added after the first real use of the photo tool: the resolution rules judge PIXELS while a
  // person judges how big a photo looks on screen, and those are different numbers. Without these
  // two fields reaching the UI, "too small for the hero" is unfalsifiable and the only way to
  // learn the requirement is repeated failed uploads. That is exactly what happened.
  const p = photoFromRow({ id: 'p', storage_path: 'a.jpg', caption: null, width: 1600, height: 1200 }, BASE)
  assert.equal(p.width, 1600)
  assert.equal(p.height, 1200)
})

test('dimensions coerce from strings and refuse junk, same as the ratio', () => {
  const fromStrings = photoFromRow({ id: 'p', storage_path: 'a.jpg', caption: null, width: '2400', height: '1800' }, BASE)
  assert.equal(fromStrings.width, 2400)
  assert.equal(fromStrings.height, 1800)

  const junk = photoFromRow({ id: 'p', storage_path: 'a.jpg', caption: null, width: null, height: 'wide' }, BASE)
  assert.ok(!('width' in junk), 'a null width must be absent, not NaN')
  assert.ok(!('height' in junk), 'an unparseable height must be absent')
})

test('an empty variants array is treated as no variants', () => {
  const p = photoFromRow({ id: 'p', storage_path: 'a.jpg', caption: null, variants: [] }, BASE)
  assert.ok(!('variants' in p), 'an empty array would make SitePhotoImg build an empty srcSet')
})

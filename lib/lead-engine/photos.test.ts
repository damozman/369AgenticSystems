import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocatePhotos, servicesLayout, MAX_GALLERY_PHOTOS } from '@/lib/lead-engine/photos'
import type { SitePhoto } from '@/lib/lead-engine/types'

const photos = (n: number): SitePhoto[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, url: `/${i + 1}.jpg`, caption: null }))

/** Every id handed out, so overlap is checkable rather than assumed. */
const allIds = (a: ReturnType<typeof allocatePhotos>) => [
  ...(a.hero ? [a.hero.id] : []),
  ...(a.band ? [a.band.id] : []),
  ...a.ladder.map(p => p.id),
  ...a.gallery.map(p => p.id),
]

test('NO PHOTO IS EVER USED TWICE', () => {
  // The reason this module exists. Without one allocator each section reaches into the same array
  // from the top, and the same roof appears in the hero, the band and the gallery — the cheapest
  // possible tell that a site was generated, and invisible in tests of each section alone.
  for (const count of [1, 2, 3, 6, 9, 12]) {
    for (const need of [
      { hero: true, band: true },
      { hero: true, band: true, ladderRows: 4 },
      { hero: true, ladderRows: 6 },
      {},
    ]) {
      const a = allocatePhotos(photos(count), need)
      const ids = allIds(a)
      assert.equal(new Set(ids).size, ids.length, `duplicate with ${count} photos and ${JSON.stringify(need)}`)
    }
  }
})

test('allocates in priority order by sort_order', () => {
  const a = allocatePhotos(photos(12), { hero: true, band: true, ladderRows: 3 })
  assert.equal(a.hero?.id, 'p1')
  assert.equal(a.band?.id, 'p2')
  assert.deepEqual(a.ladder.map(p => p.id), ['p3', 'p4', 'p5'])
  assert.deepEqual(a.gallery.map(p => p.id), ['p6', 'p7', 'p8', 'p9', 'p10', 'p11'])
})

test('the gallery is capped at six however many are stored', () => {
  assert.equal(allocatePhotos(photos(12), {}).gallery.length, MAX_GALLERY_PHOTOS)
  assert.equal(allocatePhotos(photos(40), {}).gallery.length, MAX_GALLERY_PHOTOS)
})

test('THE LADDER WINS when there are not enough for both', () => {
  // A ladder row with a missing image is a broken layout; a shorter gallery is just shorter.
  // Degrade the decorative thing, never the structural one.
  const a = allocatePhotos(photos(6), { hero: true, band: true, ladderRows: 4 })
  assert.equal(a.ladder.length, 4, 'the ladder must be filled first')
  assert.equal(a.gallery.length, 0, 'the gallery gives way')
})

test('a ladder that cannot be filled takes what exists rather than throwing', () => {
  const a = allocatePhotos(photos(3), { hero: true, band: true, ladderRows: 5 })
  assert.equal(a.hero?.id, 'p1')
  assert.equal(a.band?.id, 'p2')
  assert.equal(a.ladder.length, 1)
  assert.equal(a.gallery.length, 0)
})

test('no photos at all yields nothing, not undefined holes', () => {
  const a = allocatePhotos([], { hero: true, band: true, ladderRows: 3 })
  assert.equal(a.hero, undefined)
  assert.equal(a.band, undefined)
  assert.deepEqual(a.ladder, [])
  assert.deepEqual(a.gallery, [])
})

test('the input array is not mutated', () => {
  const input = photos(5)
  allocatePhotos(input, { hero: true, band: true, ladderRows: 2 })
  assert.equal(input.length, 5, 'callers reuse this array')
})

test('the ladder layout is chosen only when it can actually be filled', () => {
  assert.equal(servicesLayout(4, 12), 'ladder')
  assert.equal(servicesLayout(6, 6), 'ladder')
  // Not enough photos for a row each.
  assert.equal(servicesLayout(6, 3), 'list')
  assert.equal(servicesLayout(4, 0), 'list')
  // Too many services: alternating images for eight rows is an enormous page.
  assert.equal(servicesLayout(8, 12), 'list')
  // Too few to read as a ladder.
  assert.equal(servicesLayout(2, 12), 'list')
})

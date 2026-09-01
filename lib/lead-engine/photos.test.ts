import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allocatePhotos, MAX_GALLERY_PHOTOS, mosaicPlan, mosaicSpans, servicesLayout,
} from '@/lib/lead-engine/photos'
import type { SitePhoto } from '@/lib/lead-engine/types'

const photos = (n: number): SitePhoto[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, url: `/${i + 1}.jpg`, caption: null }))

/** Every id handed out, so overlap is checkable rather than assumed. */
const allIds = (a: ReturnType<typeof allocatePhotos>) => [
  ...(a.hero ? [a.hero.id] : []),
  ...(a.band ? [a.band.id] : []),
  ...a.services.map(p => p.id),
  ...a.gallery.map(p => p.id),
]

test('NO PHOTO IS EVER USED TWICE', () => {
  // The reason this module exists. Without one allocator each section reaches into the same array
  // from the top, and the same roof appears in the hero, the band and the gallery — the cheapest
  // possible tell that a site was generated, and invisible in tests of each section alone.
  for (const count of [1, 2, 3, 6, 9, 12]) {
    for (const need of [
      { hero: true, band: true },
      { hero: true, band: true, serviceSlots: 4 },
      { hero: true, serviceSlots: 6 },
      {},
    ]) {
      const a = allocatePhotos(photos(count), need)
      const ids = allIds(a)
      assert.equal(new Set(ids).size, ids.length, `duplicate with ${count} photos and ${JSON.stringify(need)}`)
    }
  }
})

test('allocates in priority order by sort_order', () => {
  const a = allocatePhotos(photos(12), { hero: true, band: true, serviceSlots: 3 })
  assert.equal(a.hero?.id, 'p1')
  assert.equal(a.band?.id, 'p2')
  assert.deepEqual(a.services.map(p => p.id), ['p3', 'p4', 'p5'])
  assert.deepEqual(a.gallery.map(p => p.id), ['p6', 'p7', 'p8', 'p9', 'p10', 'p11'])
})

test('the gallery is capped at six however many are stored', () => {
  assert.equal(allocatePhotos(photos(12), {}).gallery.length, MAX_GALLERY_PHOTOS)
  assert.equal(allocatePhotos(photos(40), {}).gallery.length, MAX_GALLERY_PHOTOS)
})

test('THE LADDER WINS when there are not enough for both', () => {
  // A ladder row with a missing image is a broken layout; a shorter gallery is just shorter.
  // Degrade the decorative thing, never the structural one.
  const a = allocatePhotos(photos(6), { hero: true, band: true, serviceSlots: 4 })
  assert.equal(a.services.length, 4, 'the services section must be filled first')
  assert.equal(a.gallery.length, 0, 'the gallery gives way')
})

test('a ladder that cannot be filled takes what exists rather than throwing', () => {
  const a = allocatePhotos(photos(3), { hero: true, band: true, serviceSlots: 5 })
  assert.equal(a.hero?.id, 'p1')
  assert.equal(a.band?.id, 'p2')
  assert.equal(a.services.length, 1)
  assert.equal(a.gallery.length, 0)
})

test('no photos at all yields nothing, not undefined holes', () => {
  const a = allocatePhotos([], { hero: true, band: true, serviceSlots: 3 })
  assert.equal(a.hero, undefined)
  assert.equal(a.band, undefined)
  assert.deepEqual(a.services, [])
  assert.deepEqual(a.gallery, [])
})

test('the input array is not mutated', () => {
  const input = photos(5)
  allocatePhotos(input, { hero: true, band: true, serviceSlots: 2 })
  assert.equal(input.length, 5, 'callers reuse this array')
})

test('isPrimary overrides sort_order for the hero slot only', () => {
  const set = photos(5)
  set[3].isPrimary = true // p4, would otherwise land in the ladder
  const a = allocatePhotos(set, { hero: true, band: true, serviceSlots: 2 })
  assert.equal(a.hero?.id, 'p4')
  // Everything else keeps its original relative order, drawn from what's left.
  assert.equal(a.band?.id, 'p1')
  assert.deepEqual(a.services.map(p => p.id), ['p2', 'p3'])
  assert.deepEqual(a.gallery.map(p => p.id), ['p5'])
})

test('isPrimary is ignored when the hero slot is not needed', () => {
  const set = photos(3)
  set[1].isPrimary = true
  const a = allocatePhotos(set, { band: true, serviceSlots: 2 })
  assert.equal(a.hero, undefined)
  // p2 was never pulled out, so band still draws FIFO from the top.
  assert.equal(a.band?.id, 'p1')
})

test('band prefers the widest photo, hero the least-wide, when aspect ratio is known', () => {
  const set = photos(4)
  set[0].aspectRatio = 1.0   // p1 square
  set[1].aspectRatio = 2.4   // p2 widest — wants the band
  set[2].aspectRatio = 0.6   // p3 tallest — wants the hero
  set[3].aspectRatio = 1.5   // p4
  const a = allocatePhotos(set, { hero: true, band: true })
  assert.equal(a.hero?.id, 'p3')
  assert.equal(a.band?.id, 'p2')
})

test('aspect-ratio preference still leaves every remaining photo disjoint', () => {
  const set = photos(8)
  set.forEach((p, i) => { p.aspectRatio = (i % 3) + 0.5 })
  const a = allocatePhotos(set, { hero: true, band: true, serviceSlots: 3 })
  const ids = allIds(a)
  assert.equal(new Set(ids).size, ids.length)
})

test('with no aspectRatio data anywhere, hero/band fall back to plain sort_order (pre-Part-B behaviour)', () => {
  const a = allocatePhotos(photos(6), { hero: true, band: true, serviceSlots: 2 })
  assert.equal(a.hero?.id, 'p1')
  assert.equal(a.band?.id, 'p2')
})

test('a lone rated photo is still pickable when only band is being filled', () => {
  const set = photos(3) // none rated
  set[2].aspectRatio = 3.0 // p3, the only one with data
  const a = allocatePhotos(set, { band: true })
  assert.equal(a.band?.id, 'p3')
})

test('hero resolves before band, so a lone rated photo goes to hero when both are needed', () => {
  // Documents the resolution order rather than surprising a future reader: with only one photo
  // carrying aspectRatio, hero (computed first) has nothing to compare it against and takes it,
  // leaving band to fall back to plain sort_order on what's left.
  const set = photos(3)
  set[2].aspectRatio = 3.0
  const a = allocatePhotos(set, { hero: true, band: true })
  assert.equal(a.hero?.id, 'p3')
  assert.equal(a.band?.id, 'p1')
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

// ── The services mosaic ──────────────────────────────────────────────────────

test('EVERY MOSAIC ROW FILLS EXACTLY — no trailing half-empty row', () => {
  // The one property the span table exists to guarantee, and the failure the hand-built mockup
  // actually had: at six services it left a two-column tile beside a one-column gap.
  for (let n = 3; n <= 6; n++) {
    const spans = mosaicSpans(n)
    assert.equal(spans.length, n, `${n} services must produce ${n} tiles`)
    const units = spans.reduce((a, b) => a + b, 0)
    assert.equal(units % 3, 0, `${n} services: ${units} column units does not fill a 3-column grid`)
  }
})

test('the mosaic is opt-in — no other template can be given one by accident', () => {
  // Four templates share servicesLayout. A photo mosaic of "practice areas" is wrong for a law
  // firm, so the default must never return it however many photos exist.
  for (let n = 3; n <= 6; n++) {
    assert.notEqual(servicesLayout(n, 99), 'mosaic')
  }
  assert.equal(servicesLayout(6, 99, { allowMosaic: true }), 'mosaic')
})

test('THE MOSAIC RENDERS WHERE THE LADDER CANNOT — half the photos, not all of them', () => {
  // The band this layout exists for: too few photos for a ladder row each, too many to throw away
  // on the two-column list.
  assert.equal(servicesLayout(6, 3, { allowMosaic: true }), 'mosaic')
  assert.equal(servicesLayout(6, 3), 'list', 'without the mosaic that same site gets no photos at all')

  // Below half, a mosaic would be mostly flat colour, so it declines rather than degrading.
  assert.equal(servicesLayout(6, 2, { allowMosaic: true }), 'list')
  assert.equal(servicesLayout(5, 3, { allowMosaic: true }), 'mosaic')
  assert.equal(servicesLayout(5, 2, { allowMosaic: true }), 'list')
})

test('the mosaic never applies outside 3-6 services, mosaic allowed or not', () => {
  for (const n of [0, 1, 2, 7, 12]) {
    assert.equal(servicesLayout(n, 99, { allowMosaic: true }), 'list')
  }
})

test('the widest tiles take the photographs first', () => {
  // A flat colour block at feature size reads as a missing image; at one column it reads as a
  // deliberate change of pace.
  const plan = mosaicPlan(6, 3)
  const withPhoto = plan.filter(t => t.photoIndex !== null)
  assert.equal(withPhoto.length, 3)
  assert.ok(withPhoto.every(t => t.span === 2), 'the three photos must land on the three wide tiles')

  // And that produces the interleaved rhythm without anyone placing it by hand.
  assert.deepEqual(plan.map(t => t.photoIndex !== null), [true, false, true, false, true, false])
})

test('photo indexes are handed out widest-first, so photo 0 gets the biggest tile', () => {
  const plan = mosaicPlan(5, 5)
  assert.equal(plan[0].span, 2)
  assert.equal(plan[0].photoIndex, 0)
  // Every index used exactly once, none skipped.
  const used = plan.map(t => t.photoIndex).filter(i => i !== null).sort((a, b) => a! - b!)
  assert.deepEqual(used, [0, 1, 2, 3, 4])
})

test('colour tiles alternate, so two identical blocks never touch', () => {
  const fills = mosaicPlan(6, 0).map(t => t.fill)
  assert.deepEqual(fills, ['accent', 'structure', 'accent', 'structure', 'accent', 'structure'])
})

test('mosaicPlan never invents a tile or a photo it was not given', () => {
  for (let n = 3; n <= 6; n++) {
    for (let p = 0; p <= 8; p++) {
      const plan = mosaicPlan(n, p)
      assert.equal(plan.length, n)
      const photos = plan.filter(t => t.photoIndex !== null)
      assert.equal(photos.length, Math.min(p, n), `${n} services, ${p} photos`)
      // Every tile is either a photo or a fill, never both and never neither.
      assert.ok(plan.every(t => (t.photoIndex === null) !== (t.fill === null)))
    }
  }
})

test('mosaicPlan is safe on counts the layout would never send it', () => {
  assert.deepEqual(mosaicPlan(0, 3), [])
  assert.deepEqual(mosaicPlan(9, 3), [])
  assert.deepEqual(mosaicSpans(7), [])
})

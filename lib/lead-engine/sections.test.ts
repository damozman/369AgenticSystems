import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  coverageColumns, coverageRenders, galleryLayout, heroLede, pageDensity, proofBarRenders, proofFacts,
  sectionCount, servicesColumns, whyUsItems,
} from '@/lib/lead-engine/sections'
import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'

const base: SiteContent = {
  businessName: 'Northside Roofing Company',
  cta: { label: 'Call Now', kind: 'call' },
}
const photos = (n: number): SitePhoto[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, url: `/${i + 1}.jpg`, caption: null }))

// ── 1. Credentials must never be glued into a differentiator ─────────────────

test('CREDENTIALS NEVER APPEAR IN A WHY-US ITEM', () => {
  // The bug this exists to prevent shipped on five of eight pages: differentiator, credentials and
  // intro were joined with a space and split on sentence boundaries — but a credential rarely ends
  // in a full stop, so it glued itself to the front of the next sentence:
  //   "Licensed and insured in Texas Most people call us after a storm, worried about what..."
  const credentials = 'Licensed and insured in Texas'
  const content: SiteContent = {
    ...base,
    differentiator: 'We answer the phone at nine at night. We show up when we say we will.',
    credentials,
    intro: 'Most people call us after a storm, worried about what it will cost.',
  }

  const items = whyUsItems(content)
  assert.ok(items.length > 0)
  for (const item of items) {
    assert.ok(!item.includes(credentials), `credentials leaked into a why-us item: ${item}`)
  }
  // And nowhere in the joined output either, however the items get concatenated downstream.
  assert.ok(!items.join(' ').includes(credentials))
})

test('a credential with no trailing full stop still cannot merge into the next field', () => {
  // The specific shape of the original defect: no punctuation to split on.
  for (const credentials of ['State Bar of Texas', 'Texas Real Estate Commission licensed', 'ISO 9001']) {
    const items = whyUsItems({ ...base, credentials, intro: 'Most people come to us at a difficult moment and want to know what happens next.' })
    assert.ok(!items.some(i => i.includes(credentials)), `${credentials} leaked`)
  }
})

test('THE HERO LEDE IS NEVER REPEATED IN WHY US', () => {
  // Every hero renders the first differentiator sentence as its lede. Including it in Why us too
  // printed the same sentence twice on one page — and on a thin site it WAS the whole section,
  // which is how review-sparse ended up with a heading and one line in 128px of padding.
  const content: SiteContent = {
    ...base,
    differentiator: 'We answer the phone at nine at night. Every roof is inspected by the owner first.',
    intro: 'Most people call us after a storm, worried about what it will cost.',
  }
  const lede = heroLede(content)
  const items = whyUsItems(content)

  assert.equal(lede, 'We answer the phone at nine at night.')
  assert.ok(!items.includes(lede!), 'the hero lede was repeated in why us')
  assert.deepEqual(items, [
    'Every roof is inspected by the owner first.',
    'Most people call us after a storm, worried about what it will cost.',
  ])
})

test('a one-sentence differentiator becomes the lede and leaves Why us empty', () => {
  // Correct: with nothing left to say, the section does not render rather than repeating the hero.
  const content: SiteContent = { ...base, differentiator: 'One van, one plumber, and the same number you called last time.' }
  assert.equal(heroLede(content), 'One van, one plumber, and the same number you called last time.')
  assert.deepEqual(whyUsItems(content), [])
})

// ── 2. review-sparse: nothing renders with more space than content ───────────

test('one fact is not a proof bar', () => {
  // A single cell spanning full width between two rules is what made review-sparse read as broken.
  assert.equal(proofBarRenders({ ...base, serviceAreas: ['Fort Worth'] }), false)
  assert.equal(proofBarRenders({ ...base, yearsInBusiness: '12 years' }), false)
  assert.equal(proofBarRenders({ ...base, yearsInBusiness: '12 years', credentials: 'Licensed' }), true)
})

test('the proof bar never renders an empty cell', () => {
  const facts = proofFacts({ ...base, yearsInBusiness: '12 years', serviceAreas: ['Fort Worth'] })
  assert.equal(facts.length, 2)
  for (const [label, value] of facts) {
    assert.ok(label.length > 0 && value.length > 0)
  }
})

test('a Google Business Profile link is not a proof point', () => {
  // It was rendering under a REVIEWS label — a link name in a slot built for a number. Real proof
  // is "4.8 · 127 reviews". The link belongs in the footer, which already has it.
  const facts = proofFacts({ ...base, googleProfileUrl: 'https://g.page/x', yearsInBusiness: '12 years' })
  assert.equal(facts.length, 1)
  assert.ok(!JSON.stringify(facts).toLowerCase().includes('google'))
})

test('an odd short service list never orphans in two columns', () => {
  // Three items in a 2-col grid leaves the third beside an empty cell — the exact "more empty
  // space than content" failure.
  assert.equal(servicesColumns(3), 1)
  assert.equal(servicesColumns(2), 1)
  assert.equal(servicesColumns(4), 2)
  assert.equal(servicesColumns(8), 2)
})

test('a thin page gets tighter rhythm', () => {
  // 128px between sections holding three lines each reads as broken; the same page with tight
  // rhythm reads as deliberate.
  const sparse: SiteContent = {
    ...base,
    services: [{ name: 'Drain cleaning' }, { name: 'Water heaters' }, { name: 'Leak repair' }],
    serviceAreas: ['Fort Worth'],
    differentiator: 'One van, one plumber, and the same number you called last time.',
  }
  assert.equal(pageDensity({ content: sparse, galleryPhotos: [] }), 'compact')

  const full: SiteContent = {
    ...sparse,
    serviceAreas: ['Fort Worth', 'Arlington', 'Keller'],
    yearsInBusiness: '12 years',
    credentials: 'Licensed',
    testimonials: [{ quote: 'Excellent work throughout.', name: 'Marcus D.' }],
    faqs: [{ question: 'What does it cost?', answer: 'Between $9,000 and $22,000.' }],
  }
  assert.equal(pageDensity({ content: full, galleryPhotos: photos(6) }), 'full')
})

test('the section count matches what actually renders', () => {
  // Hero + CTA always render, so the floor is two.
  assert.equal(sectionCount({ content: base, galleryPhotos: [] }), 2)
})

// ── 3. The gallery reflows to what it actually has ───────────────────────────

test('THE GALLERY NEVER LEAVES AN EMPTY COLUMN', () => {
  // The allocator spends photos on the hero and band first, so the gallery routinely gets five —
  // and a fixed three-up rendering two left the right third of the grid empty on Ironclad and
  // Threshold. Every row must now sum to exactly 12 columns.
  for (let n = 1; n <= 6; n++) {
    const layout = galleryLayout(photos(n))
    assert.ok(layout, `${n} photos should render`)
    if (!layout) continue
    const bottomRow = layout.rest.length * layout.restSpan
    assert.equal(bottomRow, 12, `${n} photos leaves a gap: bottom row spans ${bottomRow}/12`)
  }
})

test('gallery shapes by count', () => {
  assert.equal(galleryLayout(photos(6))?.rest.length, 3)
  assert.equal(galleryLayout(photos(6))?.restSpan, 4)
  assert.equal(galleryLayout(photos(5))?.rest.length, 2)
  assert.equal(galleryLayout(photos(5))?.restSpan, 6)
  assert.equal(galleryLayout(photos(4))?.rest.length, 1)
  assert.equal(galleryLayout(photos(4))?.restSpan, 12)
  // Too few for a feature row — one balanced row instead.
  assert.equal(galleryLayout(photos(3))?.feature, undefined)
  assert.equal(galleryLayout(photos(3))?.restSpan, 4)
  assert.equal(galleryLayout(photos(2))?.restSpan, 6)
  assert.equal(galleryLayout(photos(1))?.restSpan, 12)
})

test('no photos renders no gallery', () => {
  assert.equal(galleryLayout([]), null)
})

test('a photo is never used twice within the gallery', () => {
  for (let n = 1; n <= 6; n++) {
    const l = galleryLayout(photos(n))!
    const ids = [...(l.feature ? [l.feature.id] : []), ...l.stack.map(p => p.id), ...l.rest.map(p => p.id)]
    assert.equal(new Set(ids).size, ids.length, `duplicate at ${n} photos`)
  }
})

// ── Coverage grid ────────────────────────────────────────────────────────────

test('coverage columns come from the item count, so the last row never orphans', () => {
  // Five counties in four columns leaves one alone on row two; six leaves two.
  assert.equal(coverageColumns(3), 3)
  assert.equal(coverageColumns(4), 4)
  assert.equal(coverageColumns(5), 3)
  assert.equal(coverageColumns(6), 3)
  assert.equal(coverageColumns(8), 4)
  assert.equal(coverageColumns(16), 4)
})

test('coverage needs three areas to earn a section', () => {
  assert.equal(coverageRenders({ ...base, serviceAreas: ['Fort Worth'] }), false)
  assert.equal(coverageRenders({ ...base, serviceAreas: ['Fort Worth', 'Keller', 'Arlington'] }), true)
})

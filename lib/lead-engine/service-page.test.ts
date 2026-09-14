/**
 * `serviceEarnsPage` — whether a service has enough of its own content to deserve a page.
 *
 * The rule exists because of a constraint Chris set directly: "I want the pages to feel complete
 * and provide value. So not looking for thin." A service today is a name plus one optional line —
 * about forty words — and a page built from that is unique content wrapped in boilerplate, which
 * works against the ranking these sites exist to earn.
 *
 * This is the only place the rule lives. The nav, the sitemap, the route and the admin readiness
 * display all read it, so they cannot disagree about which pages exist.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findServiceBySlug, serviceEarnsPage, servicePages, serviceReadiness, serviceSlug,
  SERVICE_PAGE_MIN_WORDS,
} from '@/lib/lead-engine/sections'
import type { SiteContent } from '@/lib/lead-engine/types'

/** Copy of a given word count, so the boundary tests say what they mean. */
const copy = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

const withPhoto = { photos: [{ slot: 'service', slotKey: 'Drain cleaning' }] }

test('a service with enough copy AND a supporting element earns a page', () => {
  const r = serviceEarnsPage({ name: 'Drain cleaning', involves: copy(SERVICE_PAGE_MIN_WORDS) }, withPhoto)
  assert.equal(r.earns, true)
  assert.deepEqual(r.missing, [])
})

test('⚠ the word count boundary — one word under does NOT earn a page', () => {
  const under = serviceEarnsPage({ name: 'Drain cleaning', involves: copy(SERVICE_PAGE_MIN_WORDS - 1) }, withPhoto)
  const at    = serviceEarnsPage({ name: 'Drain cleaning', involves: copy(SERVICE_PAGE_MIN_WORDS) }, withPhoto)
  assert.equal(under.earns, false, 'a thin page slipped through at the boundary')
  assert.equal(at.earns, true)
  assert.equal(under.wordsNeeded, 1)
})

test('words are counted across ALL the service fields, not just one', () => {
  // Someone who answers three questions briefly should clear the same bar as someone who writes
  // one long paragraph — the page is as full either way.
  const r = serviceEarnsPage({
    name: 'Drain cleaning',
    description: copy(20), involves: copy(50), signs: [copy(25), copy(15)], expect: copy(10),
  }, withPhoto)
  assert.equal(r.wordCount, 120)
  assert.equal(r.earns, true)
})

test('copy alone is NOT enough — a wall of text with nothing to corroborate it fails', () => {
  const r = serviceEarnsPage({ name: 'Drain cleaning', involves: copy(400) })
  assert.equal(r.earns, false)
  assert.ok(r.missing.some(m => m.includes('no photo')))
})

test('any ONE supporting element is enough', () => {
  const long = { name: 'Drain cleaning', involves: copy(SERVICE_PAGE_MIN_WORDS) }
  assert.equal(serviceEarnsPage(long, withPhoto).earns, true, 'photo')
  assert.equal(serviceEarnsPage(long, { faqs: [{ service: 'Drain cleaning' }] }).earns, true, 'faq')
  assert.equal(serviceEarnsPage(long, { testimonials: [{ jobType: 'Drain cleaning' }] }).earns, true, 'testimonial')
})

test('support must be tagged to THIS service, not just present somewhere', () => {
  const r = serviceEarnsPage(
    { name: 'Drain cleaning', involves: copy(SERVICE_PAGE_MIN_WORDS) },
    { photos: [{ slot: 'service', slotKey: 'Water heaters' }], faqs: [{ service: 'Leak repair' }] },
  )
  assert.equal(r.earns, false, 'another service’s photo counted as support')
})

test('a hero or band photo is not service support', () => {
  const r = serviceEarnsPage(
    { name: 'Drain cleaning', involves: copy(SERVICE_PAGE_MIN_WORDS) },
    { photos: [{ slot: 'hero' }, { slot: 'band' }] },
  )
  assert.equal(r.earns, false)
})

test('matching ignores case and surrounding whitespace', () => {
  const r = serviceEarnsPage(
    { name: 'Drain cleaning', involves: copy(SERVICE_PAGE_MIN_WORDS) },
    { faqs: [{ service: '  DRAIN CLEANING ' }] },
  )
  assert.equal(r.earns, true)
})

test('⚠ every service on every EXISTING site still fails, and that is correct', () => {
  // Today a service is a name plus one optional line. Nothing that exists right now should
  // suddenly sprout a page on deploy — the new pages appear only once someone answers the new
  // questions. This is the regression that would embarrass us on a live client.
  const today = { name: 'Drain cleaning', description: 'Cabling and jetting, with a camera survey if it keeps coming back.' }
  assert.equal(serviceEarnsPage(today, withPhoto).earns, false)
})

test('the readiness report says what is actually missing', () => {
  const r = serviceEarnsPage({ name: 'Leak repair', description: copy(46) })
  assert.equal(r.wordCount, 46)
  assert.equal(r.wordsNeeded, SERVICE_PAGE_MIN_WORDS - 46)
  assert.equal(r.missing.length, 2, 'both gaps should be reported, not just the first')
  assert.ok(r.missing[0].includes('46 words'))
})

test('servicePages lists only what earns a page, in content order', () => {
  const content = {
    businessName: 'Bell Avenue Plumbing',
    cta: { label: 'Call Now', kind: 'call' },
    services: [
      { name: 'Drain cleaning', involves: copy(130) },
      { name: 'Water heaters', description: 'Repair or replacement.' },
      { name: 'Leak repair', involves: copy(130) },
    ],
  } as SiteContent

  const pages = servicePages(content, {
    photos: [
      { slot: 'service', slotKey: 'Drain cleaning' },
      { slot: 'service', slotKey: 'Leak repair' },
    ],
  })
  assert.deepEqual(pages, ['Drain cleaning', 'Leak repair'], 'the nav must never offer a link that 404s')
})

test('a site with no services produces no pages rather than throwing', () => {
  const content = { businessName: 'X', cta: { label: 'Call', kind: 'call' } } as SiteContent
  assert.deepEqual(servicePages(content), [])
})

// ── URL resolution ───────────────────────────────────────────────────────────

test('a service slug is built the same way a site slug is', () => {
  assert.equal(serviceSlug('Drain cleaning'), 'drain-cleaning')
  assert.equal(serviceSlug('Heating & Air'), 'heating-and-air')
  assert.equal(serviceSlug("O'Brien inspections"), 'obrien-inspections')
})

test('a URL resolves to its service', () => {
  const content = {
    businessName: 'X', cta: { label: 'Call', kind: 'call' },
    services: [{ name: 'Drain cleaning', involves: copy(130) }],
  } as SiteContent
  const found = findServiceBySlug(content, 'drain-cleaning', withPhoto)
  assert.equal(found?.name, 'Drain cleaning')
})

test('⚠ a service that has NOT earned a page resolves to null, not to a thin page', () => {
  // The whole guarantee. Someone typing the URL by hand, or an old link, must get a 404 rather
  // than the forty-word page the threshold exists to prevent.
  const content = {
    businessName: 'X', cta: { label: 'Call', kind: 'call' },
    services: [{ name: 'Leak repair', description: 'Detection and repair.' }],
  } as SiteContent
  assert.equal(findServiceBySlug(content, 'leak-repair', withPhoto), null)
})

test('an unknown slug resolves to null', () => {
  const content = {
    businessName: 'X', cta: { label: 'Call', kind: 'call' },
    services: [{ name: 'Drain cleaning', involves: copy(130) }],
  } as SiteContent
  assert.equal(findServiceBySlug(content, 'roof-replacement', withPhoto), null)
})

test('the nav and the routes agree — every listed page resolves', () => {
  // The failure this guards: a nav offering a link that 404s, which is worse than no nav. Both
  // read servicePages, and this asserts they actually stay in step.
  const content = {
    businessName: 'X', cta: { label: 'Call', kind: 'call' },
    services: [
      { name: 'Drain cleaning', involves: copy(130) },
      { name: 'Water heaters', description: 'Repair or replacement.' },
      { name: 'Leak repair', involves: copy(130) },
    ],
  } as SiteContent
  const ctx = { photos: [
    { slot: 'service', slotKey: 'Drain cleaning' },
    { slot: 'service', slotKey: 'Leak repair' },
  ] }

  for (const name of servicePages(content, ctx)) {
    assert.ok(
      findServiceBySlug(content, serviceSlug(name), ctx),
      `the nav lists "${name}" but its URL does not resolve`,
    )
  }
})

// ── serviceReadiness — the operator's view, where the FAILURES are the point ──

test('readiness reports every service, including the ones with no page', () => {
  const content = {
    businessName: 'X', cta: { label: 'Call', kind: 'call' },
    services: [
      { name: 'Drain cleaning', involves: copy(130) },
      { name: 'Water heaters', description: 'Repair or replacement.' },
    ],
  } as SiteContent

  const report = serviceReadiness(content, withPhoto)

  assert.equal(report.length, 2, 'a service without a page must still be listed, or the gap is invisible')
  assert.deepEqual(report.map(r => r.name), ['Drain cleaning', 'Water heaters'])
  assert.equal(report[0].earns, true)
  assert.equal(report[1].earns, false)
})

test('readiness names what is missing, in words an operator can act on', () => {
  const content = {
    businessName: 'X', cta: { label: 'Call', kind: 'call' },
    services: [{ name: 'Water heaters', description: copy(60) }],
  } as SiteContent

  const [water] = serviceReadiness(content)

  assert.equal(water.wordCount, 60)
  assert.equal(water.wordsNeeded, SERVICE_PAGE_MIN_WORDS - 60)
  assert.equal(water.hasPhoto, false)
  assert.equal(water.missing.length, 2, 'short copy AND no supporting element are two separate asks')
})

test('readiness agrees with servicePages — one rule, two readers', () => {
  const content = {
    businessName: 'X', cta: { label: 'Call', kind: 'call' },
    services: [
      { name: 'Drain cleaning', involves: copy(130) },
      { name: 'Water heaters', involves: copy(130) },
      { name: 'Leak repair', description: 'Fast.' },
    ],
  } as SiteContent

  assert.deepEqual(
    serviceReadiness(content, withPhoto).filter(r => r.earns).map(r => r.name),
    servicePages(content, withPhoto),
  )
})

test('readiness slugs match the URLs the nav links to', () => {
  const content = {
    businessName: 'X', cta: { label: 'Call', kind: 'call' },
    services: [{ name: 'Drain Cleaning', involves: copy(130) }],
  } as SiteContent

  const [drain] = serviceReadiness(content, withPhoto)
  assert.equal(drain.slug, serviceSlug('Drain Cleaning'))
})

test('a site with no services reports nothing rather than throwing', () => {
  const content = { businessName: 'X', cta: { label: 'Call', kind: 'call' } } as SiteContent
  assert.deepEqual(serviceReadiness(content), [])
})

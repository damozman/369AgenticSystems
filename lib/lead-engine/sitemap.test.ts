import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sitePaths, sitemapXml } from '@/lib/lead-engine/sitemap'
import { SERVICE_PAGE_MIN_WORDS } from '@/lib/lead-engine/sections'
import type { SiteContent } from '@/lib/lead-engine/types'

/** Copy long enough to clear the word bar, so each test varies only the thing it is about. */
const longCopy = Array.from({ length: SERVICE_PAGE_MIN_WORDS }, () => 'word').join(' ')

function content(services: SiteContent['services']): SiteContent {
  return {
    businessName: 'Bell Avenue Plumbing',
    cta: { label: 'Call', kind: 'phone' },
    services,
  }
}

test('a site with no qualifying services publishes exactly one page', () => {
  const paths = sitePaths('bell-avenue', content([{ name: 'Drain cleaning', description: 'Fast.' }]))
  assert.deepEqual(paths, ['/sites/bell-avenue'])
})

test('a service that earns a page is listed, and one that does not is absent', () => {
  const paths = sitePaths(
    'bell-avenue',
    content([
      { name: 'Water heaters', involves: longCopy },
      { name: 'Drain cleaning', description: 'Fast.' },
    ]),
    { faqs: [{ service: 'Water heaters' }] },
  )

  assert.deepEqual(paths, ['/sites/bell-avenue', '/sites/bell-avenue/water-heaters'])
})

test('the sitemap never lists a page the nav would not — support is required, not just words', () => {
  // Word count alone. No photo, no FAQ, no testimonial tagged to it.
  const paths = sitePaths('bell-avenue', content([{ name: 'Water heaters', involves: longCopy }]))
  assert.deepEqual(paths, ['/sites/bell-avenue'])
})

test('home page always comes first', () => {
  const paths = sitePaths(
    'bell-avenue',
    content([
      { name: 'Water heaters', involves: longCopy },
      { name: 'Leak repair', involves: longCopy },
    ]),
    { photos: [
      { slot: 'service', slotKey: 'Water heaters' },
      { slot: 'service', slotKey: 'Leak repair' },
    ] },
  )
  assert.equal(paths[0], '/sites/bell-avenue')
  assert.equal(paths.length, 3)
})

test('the XML is a valid urlset with one loc per entry', () => {
  const xml = sitemapXml([
    { loc: 'https://example.com/sites/a' },
    { loc: 'https://example.com/sites/a/water-heaters' },
  ])

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.equal((xml.match(/<loc>/g) ?? []).length, 2)
  assert.match(xml, /<loc>https:\/\/example\.com\/sites\/a\/water-heaters<\/loc>/)
})

test('lastmod is omitted rather than guessed', () => {
  assert.ok(!sitemapXml([{ loc: 'https://example.com/x' }]).includes('lastmod'))
  assert.match(
    sitemapXml([{ loc: 'https://example.com/x', lastmod: '2026-09-14' }]),
    /<lastmod>2026-09-14<\/lastmod>/,
  )
})

test('changefreq and priority are not emitted — Google ignores both', () => {
  const xml = sitemapXml([{ loc: 'https://example.com/x' }])
  assert.ok(!xml.includes('changefreq'))
  assert.ok(!xml.includes('priority'))
})

test('an ampersand in a URL is escaped, not left to break the parse', () => {
  const xml = sitemapXml([{ loc: 'https://example.com/x?a=1&b=2' }])
  assert.match(xml, /a=1&amp;b=2/)
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml))
})

/**
 * Structured data — the claims made in a customer's name, to a search engine, about a real
 * business. The tests are mostly about what must NOT appear.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { businessSchema, businessType, faqSchema, pageTitle, serviceSchema } from '@/lib/lead-engine/structured-data'
import type { SiteContent } from '@/lib/lead-engine/types'

const base: SiteContent = {
  businessName: 'Bell Avenue Plumbing',
  cta: { label: 'Call Now', kind: 'call' },
  phone: '(817) 555-0175',
  headlineNoun: 'Plumbing',
  serviceAreas: ['Fort Worth', 'Arlington'],
  differentiator: 'One van, one plumber — the same number you called last time.',
}

test('⚠ NO rating is emitted unless a real one was supplied', () => {
  // The failure that matters: Google penalises a rating a visitor cannot verify, and an invented
  // star count is a lie told on the customer's behalf that they never see.
  const none = businessSchema({ content: base, url: 'https://x.com' })
  assert.ok(!('aggregateRating' in none))

  const nullish = businessSchema({ content: base, url: 'https://x.com', rating: null })
  assert.ok(!('aggregateRating' in nullish))

  const zero = businessSchema({ content: base, url: 'https://x.com', rating: { value: 0, count: 0 } })
  assert.ok(!('aggregateRating' in zero), 'an empty rating was emitted as a real one')
})

test('a real rating IS emitted', () => {
  const s = businessSchema({ content: base, url: 'https://x.com', rating: { value: 4.9, count: 47 } })
  const r = s.aggregateRating as Record<string, string>
  assert.equal(r.ratingValue, '4.9')
  assert.equal(r.reviewCount, '47')
})

test('a rating is never derived from the testimonials on the page', () => {
  // Hand-picked quotes would overstate every single time.
  const withQuotes = { ...base, testimonials: [
    { quote: 'Great', name: 'A' }, { quote: 'Good', name: 'B' }, { quote: 'Fine', name: 'C' },
  ] }
  const s = businessSchema({ content: withQuotes, url: 'https://x.com' })
  assert.ok(!('aggregateRating' in s))
})

test('absent fields are omitted rather than emitted empty', () => {
  const bare = businessSchema({
    content: { businessName: 'X', cta: { label: 'Call', kind: 'call' } },
    url: 'https://x.com',
  })
  for (const k of ['telephone', 'areaServed', 'description', 'sameAs', 'makesOffer']) {
    assert.ok(!(k in bare), `${k} was emitted with nothing behind it`)
  }
  assert.equal(bare.name, 'X')
})

test('the business type follows the trade, and an unknown trade stays generic', () => {
  assert.equal(businessType('plumbing'), 'Plumber')
  assert.equal(businessType('roofing'), 'RoofingContractor')
  // A wrong subtype is a wrong statement about the business; LocalBusiness is always true.
  assert.equal(businessType('underwater-basket-weaving'), 'LocalBusiness')
  assert.equal(businessType(null), 'LocalBusiness')
  assert.equal(businessType(undefined), 'LocalBusiness')
})

test('FAQ markup needs at least two questions', () => {
  assert.equal(faqSchema([]), null)
  assert.equal(faqSchema([{ question: 'One?', answer: 'Yes.' }]), null)
  const two = faqSchema([{ question: 'A?', answer: '1.' }, { question: 'B?', answer: '2.' }])
  assert.equal((two!.mainEntity as unknown[]).length, 2)
})

test('the title names the trade and the town', () => {
  assert.equal(pageTitle(base), 'Plumbing in Fort Worth | Bell Avenue Plumbing')
})

test('a service title names the service, not the generic trade', () => {
  assert.equal(
    pageTitle(base, { service: 'Drain cleaning' }),
    'Drain cleaning in Fort Worth | Bell Avenue Plumbing',
  )
})

test('⚠ the title degrades without a dangling separator', () => {
  // The failure this guards: "| Bell Avenue Plumbing" or "Plumbing in  | X" as a search result.
  const noArea = pageTitle({ ...base, serviceAreas: undefined })
  assert.equal(noArea, 'Plumbing | Bell Avenue Plumbing')

  const nothing = pageTitle({ businessName: 'Bell Avenue Plumbing', cta: { label: 'Call', kind: 'call' } })
  assert.equal(nothing, 'Bell Avenue Plumbing')
  assert.ok(!nothing.includes('|'), 'a title was emitted with a separator and nothing before it')
})

test('a service page names the business as the provider', () => {
  const s = serviceSchema({
    service: { name: 'Drain cleaning', involves: 'Cabling and jetting.' },
    content: base, url: 'https://x.com/drain-cleaning', vertical: 'plumbing',
  })
  assert.equal(s.name, 'Drain cleaning')
  assert.equal(s.description, 'Cabling and jetting.')
  const p = s.provider as Record<string, string>
  assert.equal(p['@type'], 'Plumber')
  assert.equal(p.name, 'Bell Avenue Plumbing')
})

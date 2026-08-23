import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentFrom, ctaFrom, profileUrlFrom, effectiveTemplate, telHref } from '@/lib/lead-engine/content'
import type { QuestionnaireAnswers } from '@/lib/lead-engine/types'

const FULL: QuestionnaireAnswers = {
  business_name: 'Northside Roofing Company',
  phone: '(817) 612-6757',
  services: ['Roof replacement', 'Storm damage repair', 'Gutter installation'],
  service_areas: 'Fort Worth, Arlington, Keller',
  differentiator: 'We answer the phone at 9pm.',
  credentials: 'Licensed and insured in Texas.',
  years_in_business: '12 years',
  primary_cta: 'call',
  google_profile_url: 'g.page/northside',
  has_photos: true,
  pain_points: 'We miss half our calls and my wife is doing the books at midnight.',
  visitor_message: 'We want people to feel they are in safe hands.',
  notify_email: 'owner@example.com',
  preferred_slug: 'northside',
}

test('carries every answered field onto the page', () => {
  const c = contentFrom(FULL, 'fallback')
  assert.equal(c.businessName, 'Northside Roofing Company')
  assert.equal(c.phone, '(817) 612-6757')
  assert.deepEqual(c.services, ['Roof replacement', 'Storm damage repair', 'Gutter installation'])
  assert.deepEqual(c.serviceAreas, ['Fort Worth', 'Arlington', 'Keller'])
  assert.equal(c.differentiator, 'We answer the phone at 9pm.')
  assert.equal(c.yearsInBusiness, '12 years')
})

test('PAIN POINTS NEVER REACH THE PAGE', () => {
  // The single most important assertion in this file. Pain points answer "what is going wrong in
  // your business" — sales intelligence, and the worst possible thing to print on the customer's
  // own shop window. The failure mode is silent: it would simply render, and look like copy.
  const c = contentFrom(FULL, 'fallback')
  const rendered = JSON.stringify(c).toLowerCase()
  assert.ok(!rendered.includes('miss half our calls'), 'pain points leaked into site content')
  assert.ok(!rendered.includes('midnight'), 'pain points leaked into site content')
  assert.ok(!('painPoints' in c), 'content must carry no pain-points field at all')

  // Also true when every other field is absent, which is when a mapper is most tempted to reach
  // for whatever text it has.
  const sparse = contentFrom({ pain_points: 'we miss half our calls' }, 'Acme')
  assert.ok(!JSON.stringify(sparse).toLowerCase().includes('miss half our calls'))
})

test('an unanswered question stays absent — it is never defaulted or invented', () => {
  // A mini-site is judged by strangers. An invented certification or a filler tagline is a claim
  // made on the business's behalf, and the templates omit a section rather than fill it.
  const c = contentFrom({ business_name: 'Acme Plumbing' }, 'fallback')
  assert.equal(c.businessName, 'Acme Plumbing')
  assert.equal(c.services, undefined)
  assert.equal(c.serviceAreas, undefined)
  assert.equal(c.credentials, undefined)
  assert.equal(c.differentiator, undefined)
  assert.equal(c.yearsInBusiness, undefined)
  assert.equal(c.googleProfileUrl, undefined)
  assert.equal(c.intro, undefined)
  assert.equal(c.phone, undefined)
})

test('whitespace-only answers are absent, not empty strings', () => {
  const c = contentFrom({ business_name: 'Acme', credentials: '   ', differentiator: '\n\n' }, 'fallback')
  assert.equal(c.credentials, undefined)
  assert.equal(c.differentiator, undefined)
})

test('falls back to the business name on the record when the form omits it', () => {
  assert.equal(contentFrom({}, 'Acme Plumbing').businessName, 'Acme Plumbing')
})

test('reads a list however the customer typed it', () => {
  const commas   = contentFrom({ service_areas: 'Fort Worth, Arlington, Keller' }, 'x').serviceAreas
  const newlines = contentFrom({ service_areas: 'Fort Worth\nArlington\nKeller' }, 'x').serviceAreas
  const andWord  = contentFrom({ service_areas: 'Fort Worth and Arlington and Keller' }, 'x').serviceAreas
  assert.deepEqual(commas, ['Fort Worth', 'Arlington', 'Keller'])
  assert.deepEqual(newlines, ['Fort Worth', 'Arlington', 'Keller'])
  assert.deepEqual(andWord, ['Fort Worth', 'Arlington', 'Keller'])
})

test('drops duplicates but keeps the customer capitalisation', () => {
  // "HVAC" is not "Hvac", and a business that writes its own trade in capitals means it.
  const c = contentFrom({ services: ['HVAC repair', 'hvac repair', 'Duct cleaning'] }, 'x')
  assert.deepEqual(c.services, ['HVAC repair', 'Duct cleaning'])
})

test('a long paste cannot wreck the layout', () => {
  const c = contentFrom({
    services: Array.from({ length: 40 }, (_, i) => `Service number ${i}`),
    differentiator: 'x'.repeat(5000),
  }, 'x')
  assert.ok((c.services?.length ?? 0) <= 8)
  assert.ok((c.differentiator?.length ?? 0) <= 600)
})

test('"Call Now" degrades to the form when there is no dialable number', () => {
  // A tel: link built from a blank field opens an empty dialler — broken on exactly the click the
  // whole page exists to earn.
  assert.deepEqual(ctaFrom({ primary_cta: 'call' }, '(817) 612-6757'), { label: 'Call Now', kind: 'call' })
  assert.deepEqual(ctaFrom({ primary_cta: 'call' }, undefined), { label: 'Get a Free Estimate', kind: 'form' })
  assert.deepEqual(ctaFrom({ primary_cta: 'call' }, 'call us!'), { label: 'Get a Free Estimate', kind: 'form' })
})

test('the other call-to-action choices resolve to the form', () => {
  assert.deepEqual(ctaFrom({ primary_cta: 'estimate' }, '8176126757'), { label: 'Get a Free Estimate', kind: 'form' })
  assert.deepEqual(ctaFrom({ primary_cta: 'availability' }, '8176126757'), { label: 'Check Availability', kind: 'form' })
  assert.deepEqual(ctaFrom({ primary_cta: 'other', primary_cta_other: 'Book a Site Visit' }, '8176126757'),
    { label: 'Book a Site Visit', kind: 'form' })
})

test('an unanswered call-to-action defaults to the form, which always works', () => {
  assert.deepEqual(ctaFrom({}, undefined), { label: 'Get a Free Estimate', kind: 'form' })
  // 'other' with nothing typed is the same as unanswered — never a button labelled "other".
  assert.deepEqual(ctaFrom({ primary_cta: 'other' }, undefined), { label: 'Get a Free Estimate', kind: 'form' })
})

test('tel: strips the formatting a business prints on its truck', () => {
  assert.equal(telHref('(817) 612-6757'), 'tel:8176126757')
  assert.equal(telHref('+1 817-612-6757'), 'tel:+18176126757')
})

test('only http(s) survives the Google profile field', () => {
  assert.equal(profileUrlFrom('https://g.page/northside'), 'https://g.page/northside')
  assert.equal(profileUrlFrom('g.page/northside'), 'https://g.page/northside')
  // The customer is not the attacker, but the questionnaire is reachable with a signed link and
  // this href lands on a public page.
  assert.equal(profileUrlFrom('javascript:alert(1)'), undefined)
  assert.equal(profileUrlFrom('data:text/html,<script>'), undefined)
  assert.equal(profileUrlFrom('   '), undefined)
  assert.equal(profileUrlFrom(undefined), undefined)
})

test('a site with no photos falls back to the copy-forward template', () => {
  // trade_classic opens on a photo and showcase_grid leads with a grid. With nothing to show, both
  // render empty frames — so the right answer is a different page, not a placeholder image.
  assert.equal(effectiveTemplate('showcase_grid', 0), 'service_clean')
  assert.equal(effectiveTemplate('trade_classic', 0), 'service_clean')
  assert.equal(effectiveTemplate('showcase_grid', 4), 'showcase_grid')
  assert.equal(effectiveTemplate('trade_classic', 1), 'trade_classic')
})

test('an unset or unknown template renders rather than throwing', () => {
  // A site row whose template was never chosen must still serve a page; a 500 on a live customer
  // site is worse than a plainer layout.
  assert.equal(effectiveTemplate(null, 5), 'service_clean')
  assert.equal(effectiveTemplate('nonsense', 5), 'service_clean')
})

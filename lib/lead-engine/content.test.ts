import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentFrom, ctaFrom, profileUrlFrom, telHref } from '@/lib/lead-engine/content'
import type { QuestionnaireAnswers } from '@/lib/lead-engine/types'

const FULL: QuestionnaireAnswers = {
  business_name: 'Northside Roofing Company',
  phone: '(817) 612-6757',
  services: ['Roof replacement', 'Storm damage repair', 'Gutter installation'],
  service_areas: 'Fort Worth, Arlington, Keller',
  differentiator: 'We answer the phone at 9pm.',
  customer_impression: 'People always say we actually turn up when we say we will.',
  credentials: 'Licensed and insured in Texas.',
  years_in_business: '12 years',
  primary_cta: 'call',
  google_profile_url: 'g.page/northside',
  has_photos: true,
  pain_points: 'We miss half our calls and my wife is doing the books at midnight.',
  notify_email: 'owner@example.com',
  preferred_slug: 'northside',
}

test('carries every answered field onto the page', () => {
  const c = contentFrom(FULL, 'fallback')
  assert.equal(c.businessName, 'Northside Roofing Company')
  assert.equal(c.phone, '(817) 612-6757')
  assert.deepEqual(c.services, [
    { name: 'Roof replacement' }, { name: 'Storm damage repair' }, { name: 'Gutter installation' },
  ])
  assert.deepEqual(c.serviceAreas, ['Fort Worth', 'Arlington', 'Keller'])
  assert.equal(c.differentiator, 'We answer the phone at 9pm.')
  assert.equal(c.customerImpression, 'People always say we actually turn up when we say we will.')
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
  assert.equal(c.customerImpression, undefined)
  assert.equal(c.yearsInBusiness, undefined)
  assert.equal(c.googleProfileUrl, undefined)
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
  assert.deepEqual(c.services, [{ name: 'HVAC repair' }, { name: 'Duct cleaning' }])
})

test('service descriptions are carried through, never generated', () => {
  // A description is a claim about what a business does. "Full tear-off and re-roof" on a roofer
  // who subcontracts tear-offs is a false statement on their own site, which is why Q2 asks for it
  // rather than a phrase bank inventing one.
  const c = contentFrom({
    services: [
      { name: 'Roof replacement', description: 'Full tear-off and re-roof.' },
      { name: 'Gutter installation' },
    ],
  }, 'x')
  assert.deepEqual(c.services, [
    { name: 'Roof replacement', description: 'Full tear-off and re-roof.' },
    { name: 'Gutter installation' },
  ])
  // A service with no description stays without one. Nothing fills the gap.
  assert.equal(c.services?.[1].description, undefined)
})

test('the old flat string shape still submits', () => {
  // A browser holding a cached copy of the form keeps posting the old shape long after a deploy,
  // and a service list is worth more than a tidy contract.
  const c = contentFrom({ services: ['Drain cleaning', 'Water heaters'] }, 'x')
  assert.deepEqual(c.services, [{ name: 'Drain cleaning' }, { name: 'Water heaters' }])
})

test('an unattributed testimonial is dropped, not shown', () => {
  // A quote with no name is indistinguishable from one we wrote ourselves, and a fabricated review
  // is the worst thing this product could publish.
  const c = contentFrom({
    testimonials: [
      { quote: 'They were excellent.', name: 'Marcus D.', city: 'Keller' },
      { quote: 'No name on this one.', name: '' },
      { quote: '', name: 'Nobody' },
    ] as never,
  }, 'x')
  assert.equal(c.testimonials?.length, 1)
  assert.equal(c.testimonials?.[0].name, 'Marcus D.')
})

test('testimonials and faqs are absent when never supplied', () => {
  const c = contentFrom({ business_name: 'Acme' }, 'x')
  assert.equal(c.testimonials, undefined)
  assert.equal(c.faqs, undefined)
})

test('a faq needs both halves', () => {
  const c = contentFrom({
    faqs: [
      { question: 'What does it cost?', answer: 'Between $9,000 and $22,000.' },
      { question: 'Half a question?', answer: '' },
    ] as never,
  }, 'x')
  assert.equal(c.faqs?.length, 1)
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

// ── Practice-only answers (Q9–Q11) ───────────────────────────────────────────

test('AN UNANSWERED "ACCEPTING NEW PATIENTS" STAYS UNANSWERED THROUGH THE MAPPING', () => {
  // The whole field hinges on this. A practice that skipped the question has not said no, and the
  // one-character version of this line — `!!answers.accepting_new_patients` — would make every
  // such practice publish "Not taking new patients right now" on its own website.
  assert.equal(contentFrom({ business_name: 'X' }, 'X').access, undefined)
  assert.equal(
    contentFrom({ business_name: 'X', location: 'Fort Worth' }, 'X').access?.acceptingNewPatients,
    undefined,
  )
  // Both real answers survive as themselves.
  assert.equal(contentFrom({ business_name: 'X', accepting_new_patients: false }, 'X').access?.acceptingNewPatients, false)
  assert.equal(contentFrom({ business_name: 'X', accepting_new_patients: true }, 'X').access?.acceptingNewPatients, true)
})

test('HOURS ARE NOT SPLIT ON COMMAS', () => {
  // "Mon, Wed, Fri 8-5" is one line. The generic list splitter would shred it into "Mon", "Wed" and
  // "Fri 8-5" — three rows, two of which are meaningless, on the field a patient reads to find out
  // when they can come in.
  const c = contentFrom({ business_name: 'X', hours: 'Mon, Wed, Fri 8:00-5:00; Sat 9:00-noon' }, 'X')
  assert.deepEqual(c.access?.hours, ['Mon, Wed, Fri 8:00-5:00', 'Sat 9:00-noon'])
})

test('a team member with no role is dropped rather than rendered unattributed', () => {
  const c = contentFrom({
    business_name: 'X',
    team: [
      { name: 'Dr Elena Ruiz', role: 'Principal dentist', credentials: 'DDS' },
      { name: 'Someone', role: '' },
      { role: 'Hygienist' },
    ],
  } as never, 'X')
  assert.equal(c.team?.length, 1)
  assert.equal(c.team?.[0].name, 'Dr Elena Ruiz')
})

test('the new-patient forms link is held to the same http(s) rule as every other href', () => {
  assert.equal(
    contentFrom({ business_name: 'X', patient_forms_url: 'javascript:alert(1)' }, 'X').newPatientInfo,
    undefined,
  )
  assert.equal(
    contentFrom({ business_name: 'X', patient_forms_url: 'example.com/forms' }, 'X').newPatientInfo?.formsUrl,
    'https://example.com/forms',
  )
})

test('a non-practice questionnaire produces no practice fields at all', () => {
  const c = contentFrom({ business_name: 'Northside Roofing', phone: '(817) 555-0100' }, 'Northside Roofing')
  assert.equal(c.access, undefined)
  assert.equal(c.team, undefined)
  assert.equal(c.newPatientInfo, undefined)
})

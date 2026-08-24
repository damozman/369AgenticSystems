import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TEMPLATE_RENDERS_GALLERY, accessBarRenders, accessFacts, coverageColumns, coverageRenders,
  editorialHeroCentred, editorialHeroFacts, galleryLayout, heroCarriesProof, heroLede,
  newPatientRenders, pageDensity, proofBarRenders, proofFacts, sectionCount, servicesColumns,
  bandPlan, insuranceLine, teamColumns, teamRenders, whyUsItems,
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

// ── The editorial hero's right-hand columns ──────────────────────────────────

test('THE EDITORIAL HERO NEVER LEAVES FOUR COLUMNS EMPTY', () => {
  // It rendered in columns 1-8 with 9-12 empty. On Counsel and Ledger that was half the first
  // viewport blank — one more empty column than the composition rule allows.
  const full: SiteContent = { ...base, yearsInBusiness: '15 years', credentials: 'State Bar of Texas' }
  assert.equal(editorialHeroFacts(full).length, 2, 'two facts fill 9-12')
  assert.equal(editorialHeroCentred(full), false)

  // Below two facts there is no column worth building, so the block centres and the margin is
  // balanced instead of all being on one side.
  assert.deepEqual(editorialHeroFacts({ ...base, yearsInBusiness: '15 years' }), [])
  assert.equal(editorialHeroCentred({ ...base, yearsInBusiness: '15 years' }), true)
  assert.equal(editorialHeroCentred(base), true)
})

test('the hero taking the proof facts is not the same facts printed twice', () => {
  // Only the two templates whose hero has no image carry them — and those two drop their proof bar.
  assert.equal(heroCarriesProof('service_clean'), true)
  assert.equal(heroCarriesProof('supply'), true)
  for (const t of ['trade_classic', 'showcase_grid', 'practice'] as const) {
    assert.equal(heroCarriesProof(t), false, `${t} keeps its proof bar and must not double it`)
  }

  const content: SiteContent = { ...base, yearsInBusiness: '15 years', credentials: 'State Bar of Texas' }
  const counted = sectionCount({ content, galleryPhotos: [], template: 'service_clean' })
  assert.equal(
    counted,
    sectionCount({ content, galleryPhotos: [], template: 'service_clean' }),
    'the count must be stable',
  )
  // The bar is absorbed, so it is not counted as a section of its own.
  assert.equal(counted, sectionCount({ content: base, galleryPhotos: [], template: 'service_clean' }))
})

// ── Templates that render no gallery ─────────────────────────────────────────

test('SERVICE CLEAN AND SUPPLY RENDER NO GALLERY, AND THE DENSITY COUNT KNOWS IT', () => {
  // A solicitor and a trade supplier are chosen on what they do, not on six photographs of an
  // office. The count has to agree with the templates: a page credited with a gallery it does not
  // render gets full 128px rhythm on a page that is one section shorter than counted.
  assert.equal(TEMPLATE_RENDERS_GALLERY.service_clean, false)
  assert.equal(TEMPLATE_RENDERS_GALLERY.supply, false)
  assert.equal(TEMPLATE_RENDERS_GALLERY.trade_classic, true)
  assert.equal(TEMPLATE_RENDERS_GALLERY.showcase_grid, true)
  assert.equal(TEMPLATE_RENDERS_GALLERY.practice, true)

  const content: SiteContent = { ...base, services: [{ name: 'Wills' }], differentiator: 'We answer the phone at nine at night, every night of the week.' }
  assert.equal(
    sectionCount({ content, galleryPhotos: photos(6), template: 'service_clean' }),
    sectionCount({ content, galleryPhotos: [], template: 'service_clean' }),
    'photos must not change the section count on a template with no gallery',
  )
  assert.equal(
    sectionCount({ content, galleryPhotos: photos(6), template: 'trade_classic' }),
    sectionCount({ content, galleryPhotos: [], template: 'trade_classic' }) + 1,
  )
})

// ── Practice ─────────────────────────────────────────────────────────────────

test('AN UNANSWERED "ACCEPTING NEW PATIENTS" NEVER RENDERS AS AN ANSWER', () => {
  // The dangerous half of this field. `!!answers.accepting_new_patients` — the obvious line —
  // turns every practice that skipped the question into "Not taking new patients right now", which
  // is a false statement on their own website that costs them the patient reading it.
  const unanswered = accessFacts({ ...base, access: { location: '2140 Camp Bowie Boulevard' } })
  assert.equal(unanswered.length, 1)
  assert.ok(!JSON.stringify(unanswered).toLowerCase().includes('patient'))

  // Both real answers DO render. "Not taking new patients right now" is useful to the person it
  // applies to, and it is true.
  const no = accessFacts({ ...base, access: { acceptingNewPatients: false } })
  assert.equal(no.length, 1)
  assert.ok(no[0][1].toLowerCase().includes('not taking'))

  const yes = accessFacts({ ...base, access: { acceptingNewPatients: true } })
  assert.ok(yes[0][1].toLowerCase().includes('accepting'))
})

test('the access bar follows the proof bar rule: one cell is not a bar', () => {
  assert.equal(accessBarRenders({ ...base, access: { location: 'Fort Worth' } }), false)
  assert.equal(accessBarRenders({ ...base, access: { location: 'Fort Worth', hours: ['Mon-Thu 8-5'] } }), true)
  assert.equal(accessBarRenders(base), false, 'a non-practice site has no access data at all')
})

test('the access bar never renders an empty cell', () => {
  const facts = accessFacts({
    ...base,
    access: { acceptingNewPatients: true, insuranceAccepted: ['Delta Dental'], hours: ['Mon-Thu 8-5'], location: 'Fort Worth' },
  })
  assert.equal(facts.length, 4)
  for (const [label, value] of facts) assert.ok(label.length > 0 && value.length > 0)
})

test('a team member with no role is not rendered as a bare name', () => {
  // A list of names does not tell a patient which one is the dentist.
  assert.equal(teamRenders(base), false)
  assert.equal(teamRenders({ ...base, team: [{ name: 'Dr Elena Ruiz', role: 'Principal dentist' }] }), true)
})

test('the team grid never orphans its last row', () => {
  assert.equal(teamColumns(3), 3)
  assert.equal(teamColumns(4), 4)
  assert.equal(teamColumns(5), 3)   // 3 + 2, not 4 + 1
  assert.equal(teamColumns(6), 3)
  assert.equal(teamColumns(1), 1)
})

test('new-patient information needs three elements to earn a section', () => {
  // A heading over one line is the void the three-element rule exists to remove, and the FAQ
  // already answers that shape of question.
  assert.equal(newPatientRenders({ ...base, newPatientInfo: { firstVisit: 'We take 45 minutes.' } }), false)
  assert.equal(newPatientRenders({ ...base, newPatientInfo: { firstVisit: 'We take 45 minutes.', whatToBring: ['Insurance card'] } }), false)
  assert.equal(newPatientRenders({
    ...base,
    newPatientInfo: { firstVisit: 'We take 45 minutes.', whatToBring: ['Insurance card', 'Medications'] },
  }), true)
  assert.equal(newPatientRenders(base), false)
})

test('the practice sections are counted only on the practice template', () => {
  // They render nowhere else, so counting them elsewhere would give a short page full rhythm.
  const content: SiteContent = {
    ...base,
    access: { acceptingNewPatients: true, location: 'Fort Worth' },
    team: [{ name: 'Dr Elena Ruiz', role: 'Principal dentist' }],
    newPatientInfo: { firstVisit: 'We take 45 minutes.', whatToBring: ['Insurance card', 'Medications'] },
  }
  const practice = sectionCount({ content, galleryPhotos: [], template: 'practice' })
  const trade = sectionCount({ content, galleryPhotos: [], template: 'trade_classic' })
  assert.equal(practice - trade, 3, 'access bar, team and new patients')
})

test('THE INSURANCE LIST NEVER TRUNCATES SILENTLY', () => {
  // It showed the first four of six and read as complete, so a patient on the fifth plan concluded
  // they were not covered and rang somewhere else. Every other truncation here costs a reader some
  // detail; this one costs the practice a patient who WAS covered.
  const six = ['Delta Dental', 'Cigna', 'MetLife', 'Aetna', 'Guardian', 'United Concordia']
  const line = insuranceLine(six)
  for (const plan of six) assert.ok(line.includes(plan), `${plan} vanished from the line`)

  const nine = [...six, 'Humana', 'Ameritas', 'Principal']
  const cut = insuranceLine(nine)
  assert.ok(/and 3 more/.test(cut), `a cut list must say it was cut: ${cut}`)
  assert.ok(cut.includes('ask when you ring'))
})

// ── Background rhythm ─────────────────────────────────────────────────────────

test('THE FIRST BAND PLACEMENT BROKE ON THE FIRST REAL PAGE IT MET', () => {
  // review-sparse has one service area, so Coverage does not render at all. Hand-picking "band
  // WhyUs and Trust" put nothing between them the moment Coverage dropped out, and the two bands
  // sat directly against each other — one large dark block instead of alternation. bandPlan must
  // never produce two true values back to back, whatever the render pattern.
  const slots = [
    { key: 'services', renders: true, bandable: false },
    { key: 'whyus', renders: true, bandable: true },
    { key: 'coverage', renders: false, bandable: true }, // the dropped section
    { key: 'trust', renders: true, bandable: true },
    { key: 'faq', renders: true, bandable: false },
  ]
  const plan = bandPlan(slots)
  for (let i = 0; i < plan.length - 1; i++) {
    assert.ok(!(plan[i] && plan[i + 1]), `adjacent bands at ${slots[i].key}/${slots[i + 1].key}`)
  }
  // And it must still band SOMETHING rather than silently giving up because one candidate vanished.
  assert.ok(plan.some(Boolean), 'no band placed at all')
})

test('bandPlan never lets more than two renderable paper sections run together', () => {
  const slots = [
    { key: 'a', renders: true, bandable: false },
    { key: 'b', renders: true, bandable: false },
    { key: 'c', renders: true, bandable: true },
    { key: 'd', renders: true, bandable: false },
    { key: 'e', renders: true, bandable: false },
    { key: 'f', renders: true, bandable: true },
    { key: 'g', renders: true, bandable: false },
  ]
  const plan = bandPlan(slots)
  let run = 0
  for (const banded of plan) {
    if (banded) { run = 0; continue }
    run++
    assert.ok(run <= 2, `paper run exceeded 2: ${JSON.stringify(plan)}`)
  }
})

test('a section that does not render is never marked band and never breaks the run', () => {
  // Skipped sections contribute nothing in either direction — they are not on the page at all.
  const slots = [
    { key: 'a', renders: false, bandable: true },
    { key: 'b', renders: true, bandable: false },
    { key: 'c', renders: false, bandable: true },
    { key: 'd', renders: true, bandable: false },
    { key: 'e', renders: true, bandable: true },
  ]
  const plan = bandPlan(slots)
  assert.equal(plan[0], false)
  assert.equal(plan[2], false)
})

test('with no bandable candidates at all, nothing bands rather than throwing', () => {
  const slots = [
    { key: 'a', renders: true, bandable: false },
    { key: 'b', renders: true, bandable: false },
    { key: 'c', renders: true, bandable: false },
  ]
  assert.deepEqual(bandPlan(slots), [false, false, false])
})

test('an empty candidate list returns an empty plan', () => {
  assert.deepEqual(bandPlan([]), [])
})

test('startingPaperRun accounts for a fixed prefix that already spent paper sections', () => {
  // Practice's fallback proof bar (shown only when AccessBar does not render) is not itself
  // band-wrapped. A page that opens Hero -> fallback ProofBar (paper) has already spent one paper
  // section before the dynamic candidates begin, so the very next bandable candidate after ONE
  // more paper section should flip — not after two, which would be the case for a page whose fixed
  // prefix ended in a band (or rendered nothing at all).
  const slots = [
    { key: 'services', renders: true, bandable: false },
    { key: 'whyus', renders: true, bandable: true },
  ]
  const freshStart = bandPlan(slots, 0)
  assert.deepEqual(freshStart, [false, false], 'only one paper section so far, should not band yet')

  const afterPaperPrefix = bandPlan(slots, 1)
  assert.deepEqual(afterPaperPrefix, [false, true], 'the prefix already spent one, so this is the second')
})

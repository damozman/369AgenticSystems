import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CANONICAL_VERTICALS } from '@/lib/verticals/index'
import {
  ALL_VERTICAL_OPTIONS, footerNoteFor, headlineNounFor, labelFor, LEAD_ENGINE_ONLY_VERTICALS, LEAD_ENGINE_VERTICALS, normaliseVertical, VERTICAL_FOOTER_NOTES, VERTICAL_KEY_FORMAT, VERTICAL_NOUNS, VERTICAL_OPTION_GROUPS,
} from '@/lib/lead-engine/verticals'

test('every Lead Engine vertical is canonical or explicitly Lead-Engine-only', () => {
  // The point of deriving from CANONICAL_VERTICALS rather than redeclaring: a key cannot appear
  // here in a spelling the rest of the repo does not use. `real-estate` has already been filed
  // under three spellings once, and nothing errored while it happened.
  const allowed = new Set<string>([...CANONICAL_VERTICALS, ...LEAD_ENGINE_ONLY_VERTICALS])
  for (const v of LEAD_ENGINE_VERTICALS) {
    assert.ok(allowed.has(v), `${v} is offered but is neither canonical nor Lead-Engine-only`)
  }
})

test('every vertical key is hyphen-cased — an underscore never reaches a customer', () => {
  // This is the check that rejects the design brief's `real_estate` spelling at the boundary.
  for (const v of [...LEAD_ENGINE_VERTICALS, ...LEAD_ENGINE_ONLY_VERTICALS]) {
    assert.match(v, VERTICAL_KEY_FORMAT, `${v} is not lowercase hyphen-separated`)
  }
})

test('canon is not exhausted, and that is deliberate', () => {
  // Lead Engine is for local service businesses. A SaaS company is not one, so `saas` is canonical
  // and deliberately not offered. The rule is one-directional: every Lead Engine key must be
  // allowed, not every canonical key must be offered.
  assert.ok(CANONICAL_VERTICALS.includes('saas'))
  assert.ok(!LEAD_ENGINE_VERTICALS.includes('saas'))
})

test('the select offers every vertical exactly once', () => {
  const values = ALL_VERTICAL_OPTIONS.map(o => o.value)
  assert.equal(new Set(values).size, values.length, 'a vertical is listed twice')
  assert.deepEqual([...values].sort(), [...LEAD_ENGINE_VERTICALS].sort())
})

test('there is no blank and no "Other" option', () => {
  // An unmapped vertical resolves to the default pair, so offering "Other" is offering "make it
  // look like a law firm" without saying so.
  for (const { value, label } of ALL_VERTICAL_OPTIONS) {
    assert.ok(value.length > 0, 'a blank option would silently select the fallback')
    assert.ok(!/^other$/i.test(label), '"Other" is the fallback wearing a friendly name')
  }
})

test('every option has a human-readable label', () => {
  for (const { value, label } of ALL_VERTICAL_OPTIONS) {
    assert.ok(label.length > 0, `${value} has no label`)
    assert.ok(!label.includes('-'), `${label} still reads like a key`)
    assert.ok(!label.includes('_'), `${label} still reads like a key`)
  }
  // The ones a title-case rule alone would get wrong.
  assert.equal(labelFor('hvac'), 'HVAC')
  assert.equal(labelFor('real-estate'), 'Real Estate')
  assert.equal(labelFor('b2b-supply'), 'B2B Supply')
  assert.equal(labelFor('event-rentals'), 'Event & Party Rentals')
  // And one that it gets right, so the override map does not quietly become mandatory.
  assert.equal(labelFor('plumbing'), 'Plumbing')
})

test('groups are non-empty and every option belongs to one', () => {
  assert.ok(VERTICAL_OPTION_GROUPS.length > 1, 'a flat list of 26 is a scroll, not a choice')
  for (const g of VERTICAL_OPTION_GROUPS) {
    assert.ok(g.group.length > 0)
    assert.ok(g.options.length > 0, `group ${g.group} is empty`)
  }
})

test('normalising accepts the design brief spelling without adopting it', () => {
  // Tolerance on input, one spelling on output — the same shape as getVerticalConfig accepting
  // both real-estate spellings.
  assert.equal(normaliseVertical('real_estate'), 'real-estate')
  assert.equal(normaliseVertical('event_rentals'), 'event-rentals')
  assert.equal(normaliseVertical('  Real Estate '), 'real-estate')
  assert.equal(normaliseVertical('ROOFING'), 'roofing')
  assert.equal(normaliseVertical(null), '')
  assert.equal(normaliseVertical(undefined), '')
})

// ── Headline nouns ───────────────────────────────────────────────────────────

test('EVERY VERTICAL AN OPERATOR CAN PICK HAS A HEADLINE NOUN', () => {
  // Without one the hero silently falls back to the business name, which is the exact defect the
  // noun exists to fix — and it would fail quietly, on one vertical, months later. Adding a
  // vertical should fail here loudly instead.
  const missing = ALL_VERTICAL_OPTIONS.filter(o => !headlineNounFor(o.value)).map(o => o.value)
  assert.deepEqual(missing, [])
})

test('no headline noun is left as a filing label', () => {
  // `labelFor` names a vertical for an operator reading a select; this names it for a customer
  // reading a sentence. "Legal in Fort Worth" is not English, which is why the two differ.
  assert.equal(headlineNounFor('legal'), 'Legal counsel')
  assert.equal(headlineNounFor('b2b-supply'), 'B2B supply')
  assert.equal(headlineNounFor('hvac'), 'Heating and air conditioning')
  assert.notEqual(headlineNounFor('legal'), labelFor('legal'))
})

test('headlineNounFor tolerates the design brief spelling, like everything else here', () => {
  assert.equal(headlineNounFor('real_estate'), VERTICAL_NOUNS['real-estate'])
  assert.equal(headlineNounFor('  Event_Rentals  '), VERTICAL_NOUNS['event-rentals'])
})

test('an unknown vertical yields no noun rather than a guess', () => {
  // The hero then prints the business name, exactly as it always did. Inventing "Services in Fort
  // Worth" would be a headline that says nothing while looking like it says something.
  for (const raw of ['saas', 'not-a-vertical', '', null, undefined]) {
    assert.equal(headlineNounFor(raw), undefined)
  }
})

// ── Footer notes ─────────────────────────────────────────────────────────────

test('THE ATTORNEY DISCLAIMER NEVER REACHES ANOTHER TRADE ON THE SAME TEMPLATE', () => {
  // The plan called this "template-scoped fixed copy". It is not: `service_clean` serves legal,
  // insurance, accounting AND consulting, so scoping by template would print an attorney-client
  // disclaimer on an accountant's website. This test is the disproof.
  //
  // It was named for cleaning until 2026-09-01, when cleaning moved off this template entirely --
  // which is a MOVED example, not a closed hole. The reason the test exists is that one template
  // serves several trades, and that is still true of the four below.
  assert.ok(footerNoteFor('legal')?.includes('attorney-client'))
  for (const v of ['insurance', 'accounting', 'consulting']) {
    assert.equal(footerNoteFor(v), undefined, `${v} shares a template with legal but not its note`)
  }
  // Belt and braces on the vertical that prompted the rule in the first place: it no longer shares
  // legal's template, and it must not have picked up legal's note on the way out either.
  assert.equal(footerNoteFor('cleaning'), undefined)
})

test('most verticals carry no footer note at all', () => {
  // Absence is the common case. A roofer needs no disclaimer -- many need a licence NUMBER, which
  // no map can know, and which is what the operator override exists for.
  for (const v of ['roofing', 'hvac', 'plumbing', 'wholesale', 'hauling', 'real-estate']) {
    assert.equal(footerNoteFor(v), undefined)
  }
})

test('a health practice disclaims advice and says nothing about privacy', () => {
  // A claim about how data is handled has to be true of the system handling it, and this form's
  // handling is the same as every other vertical's.
  for (const v of ['dental', 'medical', 'chiropractic', 'optometry']) {
    const note = footerNoteFor(v)
    assert.ok(note?.includes('not medical advice'), v)
    assert.ok(!/privacy|confidential|HIPAA|secure|encrypted/i.test(note ?? ''), `${v} must claim nothing about data`)
  }
  assert.ok(footerNoteFor('veterinary')?.includes('not veterinary advice'))
})

test('every footer note is a real vertical, spelled the way the rest of the repo spells it', () => {
  const known = new Set(ALL_VERTICAL_OPTIONS.map(o => o.value))
  for (const key of Object.keys(VERTICAL_FOOTER_NOTES)) {
    assert.ok(known.has(key), `${key} is not a vertical an operator can pick`)
    assert.ok(VERTICAL_KEY_FORMAT.test(key), `${key} breaks the spelling rule`)
  }
})

test('footerNoteFor tolerates the brief spelling and unknown input', () => {
  assert.equal(footerNoteFor('  LEGAL  '), VERTICAL_FOOTER_NOTES.legal)
  for (const raw of ['not-a-vertical', '', null, undefined]) {
    assert.equal(footerNoteFor(raw), undefined)
  }
})

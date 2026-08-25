import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify, validateSlug, proposeSlug, SLUG_MAX_LENGTH } from '@/lib/lead-engine/slug'

test('turns a real business name into a usable slug', () => {
  assert.equal(slugify('Northside Roofing Company'), 'northside-roofing-company')
  assert.equal(slugify("O'Brien & Sons HVAC"), 'obrien-and-sons-hvac')
  assert.equal(slugify('  Ace   Plumbing,  Inc.  '), 'ace-plumbing-inc')
  assert.equal(slugify('3SIX9 Media'), '3six9-media')
})

test('folds accents rather than deleting them', () => {
  // 'bcker-roofing' would be a different, worse word — and the customer would notice.
  assert.equal(slugify('Bäcker Roofing'), 'backer-roofing')
  assert.equal(slugify('Café Fixtures'), 'cafe-fixtures')
})

test('returns empty when nothing usable survives, rather than a fake slug', () => {
  // A business named in a non-Latin script is a real case. Inventing 'site-1' here would give a
  // customer a URL that says nothing about them and looks like a system default, which it is.
  assert.equal(slugify('株式会社'), '')
  assert.equal(slugify('!!!'), '')
  assert.equal(slugify(''), '')
})

test('never produces a slug that its own validator rejects', () => {
  const names = [
    'Northside Roofing', 'A&B', "O'Brien", 'X'.repeat(200), 'Ace   ---   Plumbing',
    'Bäcker', '3SIX9 Media Masters LLC', 'The Very Long Business Name That Goes On And On Forever',
  ]
  for (const name of names) {
    const s = slugify(name)
    if (!s) continue // an empty result is handled by the caller, not by the validator
    assert.equal(validateSlug(s).valid, true, `slugify(${JSON.stringify(name)}) produced ${s}, which validateSlug rejects`)
    assert.ok(s.length <= SLUG_MAX_LENGTH)
  }
})

test('refuses malformed slugs rather than repairing them', () => {
  // Quietly fixing a slug means the URL shown on the form is not the URL the customer gets, and
  // they find out once a card is printed.
  for (const bad of ['', 'ab', 'Has-Capitals', 'has space', 'has_underscore', '-leading', 'trailing-', 'double--hyphen', 'x'.repeat(60)]) {
    assert.equal(validateSlug(bad).valid, false, `expected ${JSON.stringify(bad)} to be refused`)
  }
})

test('reserved slugs are refused, including the ones that only matter as subdomains', () => {
  // These cannot collide today under /sites/, but the plan is to move to <slug>.369... later, and
  // taking a slug back from a customer whose signage carries it costs a customer.
  for (const reserved of ['www', 'mail', 'app', 'admin', 'api', 'login', 'sites']) {
    assert.equal(validateSlug(reserved).valid, false, `expected ${reserved} to be reserved`)
  }
})

test('a refusal explains itself in words a business owner can act on', () => {
  const check = validateSlug('Has Capitals')
  assert.equal(check.valid, false)
  if (!check.valid) {
    assert.ok(check.reason.length > 20, 'reason should be a sentence, not a code')
    assert.ok(!/regex|pattern|invalid input/i.test(check.reason))
  }
})

test('proposes the customer preference first, then the business name', () => {
  assert.equal(proposeSlug('Northside Roofing Company', 'northside'), 'northside')
  // An unusable preference falls through to the name rather than being repaired into something
  // the customer did not ask for.
  assert.equal(proposeSlug('Northside Roofing Company', 'www'), 'northside-roofing-company')
  assert.equal(proposeSlug('Northside Roofing Company', ''), 'northside-roofing-company')
  assert.equal(proposeSlug('Northside Roofing Company', null), 'northside-roofing-company')
})

test('proposes null when neither input yields anything, so the caller asks', () => {
  assert.equal(proposeSlug('株式会社', null), null)
  assert.equal(proposeSlug('!!!', '???'), null)
})

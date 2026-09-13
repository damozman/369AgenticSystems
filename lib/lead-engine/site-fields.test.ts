/**
 * `siteFieldsPatch` — absent vs empty on the two columns that live outside `content`.
 *
 * `headline_noun` and `footer_note` are columns rather than questionnaire content precisely so a
 * re-submitted questionnaire cannot clear them: `contentFrom` rebuilds that jsonb wholesale and
 * knows nothing about either. That makes THIS function the only place they change, and the
 * absent/empty distinction the only behaviour it has.
 *
 * Getting it wrong fails silently and publicly: a footer note an operator deliberately cleared
 * reappears on a real business's page, or an untouched field is wiped by a save that never
 * mentioned it. Nothing errors either way.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { siteFieldsPatch } from '@/lib/lead-engine/site'

test('an omitted field is left completely alone', () => {
  // Not "set to null" — absent from the patch entirely, so the UPDATE cannot touch the column.
  const patch = siteFieldsPatch({ headlineNoun: 'Roofing' })
  assert.equal(patch.headline_noun, 'Roofing')
  assert.ok(!('footer_note' in patch), 'an unmentioned column must not appear in the patch')
})

test('an EMPTY string clears the column — this is deliberate, not a mistake', () => {
  // The shipped footer notes are placeholders (Chris, 2026-09-01). Clearing one is a real action
  // and must store null, so no default can reappear behind the operator.
  const patch = siteFieldsPatch({ headlineNoun: '', footerNote: '' })
  assert.equal(patch.headline_noun, null)
  assert.equal(patch.footer_note, null)
})

test('whitespace is the same as empty', () => {
  // A field someone selected-all-and-spacebarred reads as cleared, not as a one-space value that
  // renders an empty footer line.
  const patch = siteFieldsPatch({ footerNote: '   \n  ' })
  assert.equal(patch.footer_note, null)
})

test('values are trimmed', () => {
  const patch = siteFieldsPatch({ headlineNoun: '  Dumpster rental  ' })
  assert.equal(patch.headline_noun, 'Dumpster rental')
})

test('nothing supplied produces an empty patch, not a write', () => {
  // updateSiteFields short-circuits on this. An UPDATE with no columns still fires the updated_at
  // trigger and would reorder the admin list for a save that changed nothing.
  assert.deepEqual(siteFieldsPatch({}), {})
})

test('both fields move independently', () => {
  const patch = siteFieldsPatch({ headlineNoun: 'Legal counsel', footerNote: '' })
  assert.equal(patch.headline_noun, 'Legal counsel')
  assert.equal(patch.footer_note, null, 'clearing one must not depend on the other')
})

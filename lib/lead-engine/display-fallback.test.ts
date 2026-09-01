/**
 * Every display face a kit can resolve to must have a fallback stack.
 *
 * The bug this closes: all seven kits shared one hardcoded `Georgia, serif` in the stylesheet, so a
 * webfont that failed to load rendered a roofing or rental-yard site in a book serif. The fix keys
 * the fallback off the RESOLVED face rather than the kit, because `tokensFor` lets an operator pick
 * any of the kit's three alternates and Clinic's are not all one classification.
 *
 * That fix has a hole only a test can hold shut: adding a kit, or a fourth alternate to an existing
 * one, silently falls through to the SERIF default and reintroduces exactly the defect for that
 * face. `tsc` cannot see it -- the map is `Record<string, string>` and a missing key is a legal
 * lookup returning undefined. Same guard shape as `theme.test.ts`'s CHECK-constraint parse, and for
 * the same reason: nothing else in the pipeline would notice.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DISPLAY_FALLBACKS, THEMES, tokensFor, fontsFor } from '@/lib/lead-engine/theme'

test('every face every kit can resolve to has a fallback stack', () => {
  for (const theme of THEMES) {
    for (const face of fontsFor(theme)) {
      assert.ok(
        DISPLAY_FALLBACKS[face],
        `${theme}: display face "${face}" has no entry in DISPLAY_FALLBACKS, so it would fall back `
        + 'to a serif regardless of the kit',
      )
    }
  }
})

test('DISPLAY_FALLBACKS carries nothing no kit can reach', () => {
  const reachable = new Set(THEMES.flatMap((t) => fontsFor(t)))
  for (const face of Object.keys(DISPLAY_FALLBACKS)) {
    assert.ok(reachable.has(face), `DISPLAY_FALLBACKS has "${face}", which no kit offers -- stale entry`)
  }
})

test('the token is emitted, and a serif kit and a sans kit do not share a fallback', () => {
  const forge = tokensFor('forge')['--le-font-display-fallback']
  const counsel = tokensFor('counsel')['--le-font-display-fallback']

  assert.ok(forge, 'forge emits no --le-font-display-fallback')
  assert.ok(counsel, 'counsel emits no --le-font-display-fallback')
  // The whole point of the change: these were identical before it.
  assert.notEqual(forge, counsel)
  assert.match(forge, /sans-serif$/)
  assert.match(counsel, /serif$/)
})

test('an operator-chosen alternate gets ITS classification, not the kit default', () => {
  // Clinic is the kit that proves a per-kit fallback would have been wrong: Fraunces is a serif,
  // Nunito is a sans, and both are legal choices on the same kit.
  const fraunces = tokensFor('clinic', { display_font: 'Fraunces' })['--le-font-display-fallback']
  const nunito = tokensFor('clinic', { display_font: 'Nunito' })['--le-font-display-fallback']

  assert.match(fraunces, /^Georgia/)
  assert.match(nunito, /sans-serif$/)
  assert.notEqual(fraunces, nunito)
})

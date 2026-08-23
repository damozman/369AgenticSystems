import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_TEMPLATE, DEFAULT_THEME, INTENTIONAL_DEFAULT_PAIR_VERTICALS, TEMPLATES, THEMES,
  VERTICAL_MAP, contrastRatio, effectiveTemplate, fontsFor, resolveForVertical, tokensFor,
  validateAccent,
} from '@/lib/lead-engine/theme'
import { ALL_VERTICAL_OPTIONS } from '@/lib/lead-engine/verticals'
import type { Theme } from '@/lib/lead-engine/theme'

// ── The two assertions that guard the admin select ───────────────────────────

test('every option the admin can pick is an explicit key in VERTICAL_MAP', () => {
  // The real bug this catches: a select offering a value the resolver does not know, which
  // silently falls through to the default pair. Every site then looks like a law firm and nothing
  // errors.
  for (const { value } of ALL_VERTICAL_OPTIONS) {
    assert.ok(value in VERTICAL_MAP, `${value} is offered in the select but is not mapped`)
  }
})

test('only the intended verticals resolve to the default pair', () => {
  // If this fails because you added a vertical: confirm that landing on service_clean + counsel is
  // deliberate for it, and if so add it to INTENTIONAL_DEFAULT_PAIR_VERTICALS. This should read as
  // a prompt, not a puzzle.
  //
  // It exists because an option resolving to the default pair is indistinguishable from an option
  // nobody remembered to map — naming the intended ones is what makes the unintended ones visible.
  const landingOnDefault = ALL_VERTICAL_OPTIONS
    .map(o => o.value)
    .filter(v => {
      const { template, theme } = resolveForVertical(v)
      return template === DEFAULT_TEMPLATE && theme === DEFAULT_THEME
    })

  assert.deepEqual(
    [...landingOnDefault].sort(),
    [...INTENTIONAL_DEFAULT_PAIR_VERTICALS].sort(),
    'a vertical drifted onto the default pair — see INTENTIONAL_DEFAULT_PAIR_VERTICALS',
  )
})

// ── resolveForVertical ───────────────────────────────────────────────────────

test('every vertical in the mapping returns its documented pair', () => {
  assert.deepEqual(resolveForVertical('roofing'),         { template: 'trade_classic', theme: 'ironclad' })
  assert.deepEqual(resolveForVertical('tree-service'),    { template: 'trade_classic', theme: 'ironclad' })
  assert.deepEqual(resolveForVertical('real-estate'),     { template: 'trade_classic', theme: 'threshold' })
  assert.deepEqual(resolveForVertical('legal'),           { template: 'service_clean', theme: 'counsel' })
  assert.deepEqual(resolveForVertical('event-rentals'),   { template: 'showcase_grid', theme: 'yard' })
  assert.deepEqual(resolveForVertical('wholesale'),       { template: 'supply',        theme: 'ledger' })
  assert.deepEqual(resolveForVertical('dental'),          { template: 'practice',      theme: 'clinic' })
})

test('an unknown vertical returns the safe pair and does not throw', () => {
  for (const junk of ['', '   ', 'unicorn-grooming', 'saas', null, undefined]) {
    assert.deepEqual(
      resolveForVertical(junk as string),
      { template: DEFAULT_TEMPLATE, theme: DEFAULT_THEME },
      `expected the default pair for ${JSON.stringify(junk)}`,
    )
  }
})

test('the design brief underscore spelling still resolves', () => {
  // A caller who copies a key out of LEAD-ENGINE-DESIGN-BRIEF.md must not silently get a law firm.
  assert.deepEqual(resolveForVertical('real_estate'), resolveForVertical('real-estate'))
  assert.deepEqual(resolveForVertical('event_rentals'), resolveForVertical('event-rentals'))
})

// ── effectiveTemplate ────────────────────────────────────────────────────────

test('no photos renders Service Clean, for all five templates', () => {
  for (const t of TEMPLATES) {
    assert.equal(effectiveTemplate(t, 0), 'service_clean', `${t} with no photos should degrade`)
  }
})

test('with photos, the stated template is what renders, for all five', () => {
  for (const t of TEMPLATES) {
    assert.equal(effectiveTemplate(t, 1), t)
    assert.equal(effectiveTemplate(t, 12), t)
  }
})

test('a missing or nonsense template still renders a page rather than throwing', () => {
  // A 500 on a live customer's site is worse than a plainer layout.
  assert.equal(effectiveTemplate(null, 5), DEFAULT_TEMPLATE)
  assert.equal(effectiveTemplate('nonsense', 5), DEFAULT_TEMPLATE)
  assert.equal(effectiveTemplate(undefined, 0), 'service_clean')
})

// ── validateAccent ───────────────────────────────────────────────────────────

test("Yard's equipment yellow is surface-only, not text-safe", () => {
  // #E0A526 fails 4.5:1 on Yard's paper. It is a real answer a rental yard will give us, and using
  // it as text colour produces unreadable links on a live site.
  const r = validateAccent('yard', '#E0A526')
  assert.equal(r.accent_mode, 'surface_only')
  assert.equal(r.accent, '#E0A526')
  assert.equal(r.accent_derived, '#E0A526')
})

test('a pure yellow is derived down until it clears 4.5:1', () => {
  const r = validateAccent('counsel', '#FFE500')
  assert.equal(r.accent_mode, 'derived')
  assert.equal(r.accent, '#FFE500', 'the original must survive for the logo')
  assert.notEqual(r.accent_derived, r.accent)
  assert.ok(
    contrastRatio(r.accent_derived, '#FAFAF8') >= 4.5,
    `derived ${r.accent_derived} still fails contrast`,
  )
})

test('a derived accent keeps the customer hue within 5 degrees', () => {
  // Darkening in OKLCH rather than HSL is the whole reason this is worth sixty lines: the
  // customer must still recognise their own colour.
  const hue = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
    if (d === 0) return 0
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return ((h * 60) + 360) % 360
  }
  for (const input of ['#FFE500', '#00E5FF', '#FF00E5']) {
    const r = validateAccent('counsel', input)
    if (r.accent_mode !== 'derived') continue
    const drift = Math.abs(hue(r.accent) - hue(r.accent_derived))
    assert.ok(Math.min(drift, 360 - drift) <= 5, `${input} drifted ${drift.toFixed(1)} degrees`)
  }
})

test('malformed accent input returns the theme default and never throws', () => {
  for (const junk of ['', 'red', '#GGG', '#12', null, undefined, 42, {}, []]) {
    const r = validateAccent('ironclad', junk)
    assert.equal(r.accent, '#C8542B', `expected Ironclad's own accent for ${JSON.stringify(junk)}`)
    assert.equal(r.accent_mode, 'text_safe')
  }
})

test('shorthand hex is accepted and both values are always returned', () => {
  const r = validateAccent('counsel', '#036')
  assert.equal(r.accent, '#003366')
  assert.ok(r.accent_derived.length === 7)
  assert.ok(['text_safe', 'surface_only', 'derived'].includes(r.accent_mode))
})

// ── fontsFor ─────────────────────────────────────────────────────────────────

test('each theme permits its default plus exactly two alternates', () => {
  for (const t of THEMES) {
    const fonts = fontsFor(t)
    assert.equal(fonts.length, 3, `${t} should offer a default and two alternates`)
    assert.equal(new Set(fonts).size, 3, `${t} lists a font twice`)
  }
  assert.equal(fontsFor('ironclad')[0], 'Archivo Black')
  assert.equal(fontsFor('clinic')[0], 'Fraunces')
})

test('the font list is a copy, so a caller cannot mutate the allowlist', () => {
  const a = fontsFor('yard')
  a.push('Comic Sans MS')
  assert.ok(!fontsFor('yard').includes('Comic Sans MS'))
})

// ── tokensFor ────────────────────────────────────────────────────────────────

const REQUIRED_TOKENS = [
  '--le-ink', '--le-structure', '--le-paper', '--le-edge', '--le-accent', '--le-accent-derived',
  '--le-font-display', '--le-font-body', '--le-font-utility',
  '--le-display-weight', '--le-display-tracking', '--le-body-line',
  '--le-utility-weight', '--le-utility-tracking', '--le-utility-transform',
  '--le-radius-button', '--le-radius-card', '--le-radius-image', '--le-shadow-card',
  '--le-display-xl', '--le-display-l', '--le-display-m', '--le-body-l', '--le-body', '--le-utility',
  '--le-space-anchor', '--le-space-connector', '--le-space-anchor-m', '--le-space-connector-m',
]

test('every theme emits every documented token', () => {
  for (const t of THEMES) {
    const tokens = tokensFor(t)
    for (const key of REQUIRED_TOKENS) {
      assert.ok(key in tokens, `${t} is missing ${key}`)
      assert.ok(String(tokens[key]).length > 0, `${t} emits an empty ${key}`)
    }
  }
})

test('no theme emits a token that is not documented', () => {
  // Catches a token added to one kit and forgotten in the others, which is how a template ends up
  // reading a var that resolves to nothing on five of six themes.
  for (const t of THEMES) {
    for (const key of Object.keys(tokensFor(t))) {
      assert.ok(REQUIRED_TOKENS.includes(key), `${t} emits undocumented token ${key}`)
    }
  }
})

test('brand cannot override anything the SKILL marks non-overridable', () => {
  // These are what keep a customised site still looking designed. `brand` is read key by key and
  // never spread, so junk keys cannot become tokens.
  const polluted = {
    accent: '#C8542B',
    // None of the following may have any effect, whatever a caller puts in the jsonb column.
    '--le-ink': '#FF0000', ink: '#FF0000', structure: '#FF0000', edge: '#FF0000',
    '--le-display-xl': '99rem', radius_card: '40px', shadow: 'none', spacing: '1px',
  } as never

  const base = tokensFor('ironclad')
  const branded = tokensFor('ironclad', polluted)

  for (const key of ['--le-ink', '--le-structure', '--le-edge', '--le-display-xl',
                     '--le-radius-card', '--le-shadow-card', '--le-space-anchor']) {
    assert.equal(branded[key], base[key], `${key} was overridden by brand and must not be`)
  }
  assert.deepEqual(Object.keys(branded).sort(), Object.keys(base).sort())
})

test('brand overrides the three things it is allowed to', () => {
  const branded = tokensFor('ironclad', {
    accent: '#1F6F8B',
    display_font: 'Oswald',
    paper_shade: 'warm',
  })
  assert.equal(branded['--le-accent'], '#1F6F8B')
  assert.equal(branded['--le-font-display'], '"Oswald"')
  assert.equal(branded['--le-paper'], '#F2F1EC')
})

test('a display font outside the theme allowlist is ignored, not rendered', () => {
  // Free-text font input produces broken sites and unlicensed fonts.
  const branded = tokensFor('ironclad', { display_font: 'Comic Sans MS' })
  assert.equal(branded['--le-font-display'], '"Archivo Black"')
})

test('an unknown theme falls back rather than emitting empty tokens', () => {
  const tokens = tokensFor('not-a-theme' as Theme)
  for (const key of REQUIRED_TOKENS) {
    assert.ok(String(tokens[key]).length > 0, `missing ${key} on an unknown theme`)
  }
})

test('body text clears 4.5:1 on paper in every theme', () => {
  // The quality gate requires it, and a kit whose ink fails on its own paper is unshippable.
  for (const t of THEMES) {
    const tokens = tokensFor(t)
    const ratio = contrastRatio(tokens['--le-ink'], tokens['--le-paper'])
    assert.ok(ratio >= 4.5, `${t}: ink on paper is only ${ratio.toFixed(2)}:1`)
  }
})

test("every kit's own accent survives its own validator", () => {
  // A kit shipping an accent that its own validator darkens is a kit with a bug — the signature
  // colour would never appear on a site using that kit unmodified.
  for (const t of THEMES) {
    const kitAccent = tokensFor(t)['--le-accent']
    const { accent_mode } = validateAccent(t, kitAccent)
    assert.notEqual(accent_mode, 'derived', `${t}: its own accent ${kitAccent} gets derived down`)
  }
})

test('a surface-only accent is genuinely usable as a fill', () => {
  // The two things a fill needs, asserted directly rather than via a contrast threshold that
  // happens to correlate: dark text on it must be readable, and it must be visible against paper.
  const yardInk = tokensFor('yard')['--le-ink']
  const yardPaper = tokensFor('yard')['--le-paper']
  const r = validateAccent('yard', '#E0A526')
  assert.equal(r.accent_mode, 'surface_only')
  // 3:1 is WCAG's large-text threshold, and a button label is large or bold text.
  assert.ok(contrastRatio(yardInk, r.accent) >= 3.0, 'a button label on the fill must be readable')
  assert.ok(contrastRatio(r.accent, yardPaper) >= 1.5, 'the fill must be visible against paper')
})

test('a colour that is invisible as a fill is derived, not called surface-only', () => {
  // #FFE500 is readable under dark ink but is nearly invisible against near-white paper, so it
  // fails as a fill AND as text. This is the case a single 3.0:1 threshold gets wrong.
  const r = validateAccent('counsel', '#FFE500')
  assert.equal(r.accent_mode, 'derived')
  assert.ok(contrastRatio(r.accent, tokensFor('counsel')['--le-paper']) < 1.5)
})

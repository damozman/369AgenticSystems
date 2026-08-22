import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PAIN_LABELS, painLabel } from '@/lib/dossier-labels'

/**
 * The pages are the source of truth; this map is a copy of them.
 *
 * A copy can only be checked against its source, so this test re-reads all twelve forms and fails
 * on any drift. Without it, editing a checkbox label on a page would leave the dossier quoting a
 * prospect words they never saw — a silent wrong, which is the shape this repo keeps paying for.
 *
 * Regenerate with: node scripts/generate-dossier-labels.mjs
 */
const TAG_TO_VERTICAL: Record<string, string> = {
  '369AS_ROOFING_INTAKE': 'roofing',
  '369AS_HVAC_INTAKE': 'hvac',
  '369AS_PLUMBING_INTAKE': 'plumbing',
  '369AS_LEGAL_INTAKE': 'legal',
  '369AS_REAL_ESTATE_INTAKE': 'real-estate',
  '369AS_INSURANCE_INTAKE': 'insurance',
  '369AS_SAAS_INTAKE': 'saas',
  '369AS_WHOLESALE_INTAKE': 'wholesale',
  '369AS_EVENT_RENTALS_INTAKE': 'event-rentals',
  '369AS_DUMPSTER_RENTAL_INTAKE': 'dumpster-rental',
  '369AS_EQUIPMENT_RENTAL_INTAKE': 'equipment-rental',
  '369AS_UNLISTED_INTAKE': 'unlisted',
}

function labelsFromPages(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  const dirs = ['.', ...readdirSync('public', { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name)]
  for (const dir of dirs) {
    const path = dir === '.' ? 'public/index.html' : `public/${dir}/index.html`
    let html: string
    try { html = readFileSync(path, 'utf8') } catch { continue }
    if (!html.includes('pain-grid')) continue
    const tag = html.match(/source_tag:\s*'([A-Z_0-9]+)'/)?.[1] ?? ''
    const vertical = TAG_TO_VERTICAL[tag]
    if (!vertical) continue
    const block = html.match(/<fieldset class="pain-grid"[\s\S]*?<\/fieldset>/)![0]
    out[vertical] = Object.fromEntries(
      [...block.matchAll(/value="([^"]+)"\s*\/>\s*<span>([\s\S]*?)<\/span>/g)]
        .map(m => [m[1], m[2].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()]))
  }
  return out
}

test('every intake form is covered', () => {
  const fromPages = labelsFromPages()
  assert.equal(Object.keys(fromPages).length, 12, 'expected all 12 forms to carry a pain group')
  for (const vertical of Object.keys(fromPages)) {
    assert.ok(PAIN_LABELS[vertical], `no labels for ${vertical} — regenerate the map`)
  }
})

test('no label has drifted from the page it came from', () => {
  const fromPages = labelsFromPages()
  for (const [vertical, keys] of Object.entries(fromPages)) {
    assert.deepEqual(
      PAIN_LABELS[vertical], keys,
      `${vertical} has drifted. Run: node scripts/generate-dossier-labels.mjs`)
  }
})

test('"All of the above" never came across', () => {
  // It was the option that destroyed the most information, and dropping it is the point.
  for (const keys of Object.values(PAIN_LABELS)) {
    assert.ok(!('all' in keys))
    assert.ok(!Object.values(keys).some(v => /all of the above/i.test(v)))
  }
})

test('an unknown key is null, never a raw key printed at a prospect', () => {
  assert.equal(painLabel('roofing', 'not_a_key'), null)
})

test('an unknown vertical falls back rather than losing the label', () => {
  // A page can be added before this map is regenerated; a shared key should still resolve.
  assert.equal(painLabel('brand-new-vertical', 'afterhours'), PAIN_LABELS.unlisted.afterhours)
})

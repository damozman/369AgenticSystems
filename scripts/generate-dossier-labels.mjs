import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
const TAG_TO_VERTICAL = {
  '369AS_ROOFING_INTAKE':'roofing','369AS_HVAC_INTAKE':'hvac','369AS_PLUMBING_INTAKE':'plumbing',
  '369AS_LEGAL_INTAKE':'legal','369AS_REAL_ESTATE_INTAKE':'real-estate','369AS_INSURANCE_INTAKE':'insurance',
  '369AS_SAAS_INTAKE':'saas','369AS_WHOLESALE_INTAKE':'wholesale','369AS_EVENT_RENTALS_INTAKE':'event-rentals',
  '369AS_DUMPSTER_RENTAL_INTAKE':'dumpster-rental','369AS_EQUIPMENT_RENTAL_INTAKE':'equipment-rental',
  '369AS_UNLISTED_INTAKE':'unlisted',
}
const out = {}
const dirs = ['.', ...readdirSync('public',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name)]
for (const dir of dirs) {
  const path = dir === '.' ? 'public/index.html' : `public/${dir}/index.html`
  let html; try { html = readFileSync(path,'utf8') } catch { continue }
  if (!html.includes('pain-grid')) continue
  const tag = html.match(/source_tag:\s*'([A-Z_0-9]+)'/)?.[1]
  const v = TAG_TO_VERTICAL[tag]; if (!v) continue
  const block = html.match(/<fieldset class="pain-grid"[\s\S]*?<\/fieldset>/)[0]
  out[v] = Object.fromEntries([...block.matchAll(/value="([^"]+)"\s*\/>\s*<span>([\s\S]*?)<\/span>/g)]
    .map(([,k,t]) => [k, t.replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()]))
}
const body = Object.keys(out).sort().map(v =>
  `  '${v}': {\n` + Object.entries(out[v]).map(([k,t]) => `    ${k}: ${JSON.stringify(t)},`).join('\n') + `\n  },`
).join('\n')

writeFileSync('lib/dossier-labels.ts', `/**
 * What each bottleneck checkbox actually SAID on the page the prospect filled in.
 *
 * \`pain_points\` stores keys — \`afterhours\`, \`doublebook\` — because a key is stable and a
 * sentence is not. The dossier has to print the sentence, and it has to be the same sentence they
 * read, in the same words. Reflecting someone's own answer back at them in different language is
 * the fastest way to make a report feel generated.
 *
 * **Generated from the pages, which are the source of truth**, and guarded by
 * \`lib/dossier-labels.test.ts\`, which re-reads every form at test time and fails on any drift.
 * Editing a checkbox label on a page without regenerating this map is exactly the two-writers
 * problem that keeps costing this project real data.
 *
 * Regenerate: node scripts/generate-dossier-labels.mjs
 */

export type PainLabels = Record<string, Record<string, string>>

export const PAIN_LABELS: PainLabels = {
${body}
}

/**
 * The label for one checked key, or null.
 *
 * Null when the key is unknown — a page edited after a submission, or a key from a vertical this
 * prospect does not belong to. The dossier omits what it cannot name rather than printing a raw
 * key like "doublebook" at someone.
 */
export function painLabel(vertical: string, key: string): string | null {
  return PAIN_LABELS[vertical]?.[key] ?? PAIN_LABELS.unlisted?.[key] ?? null
}
`)
console.log('verticals:', Object.keys(out).length, '· keys:', Object.values(out).reduce((n,o)=>n+Object.keys(o).length,0))

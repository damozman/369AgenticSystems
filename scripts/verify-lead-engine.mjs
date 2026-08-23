/**
 * Lead Engine's verification gate.
 *
 * Two jobs, deliberately in one script so neither gets skipped:
 *
 *   1. **The hardcoded-style check.** No hex literal, no literal font-family, no literal radius or
 *      shadow anywhere under `components/lead-engine/`. This is the only thing standing between the
 *      theme system and drift, because `next.config.mjs` sets `ignoreBuildErrors: true` and nothing
 *      else in the toolchain will ever notice a stray `#0A0A0A`. One of those and a site stops
 *      being themed — on one kit, invisibly, for whoever bought that kit.
 *
 *   2. **The live schema and render check**, against production Supabase and the real route.
 *
 * Part 1 needs no database and no server, so it runs first and always.
 *
 *   node scripts/verify-lead-engine.mjs                       # style check only
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-lead-engine.mjs --live
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const LIVE = process.argv.includes('--live')

let failures = 0
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++ }
const pass = (msg) => console.log(`  ✓ ${msg}`)

// ── 1. Hardcoded style ───────────────────────────────────────────────────────

const COMPONENT_DIR = 'components/lead-engine'

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Strip comments and the `SITE_CSS` template literal before scanning.
 *
 * The CSS block legitimately contains `1px` hairlines and structural values, and the file header
 * explains the palette in prose — neither is a design decision escaping into a component, and
 * flagging them would train everyone to ignore this check. What it must catch is a literal in
 * MARKUP: a `style={{ color: '#0A0A0A' }}` on a template.
 */
function scannable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/^\s*\/\/.*$/gm, '')          // line comments
    .replace(/const SITE_CSS = `[\s\S]*?`\n/, '')  // the one authored stylesheet
}

const RULES = [
  {
    name: 'hex colour literal',
    re: /#[0-9a-fA-F]{3,8}\b/g,
    hint: 'use var(--le-ink) / var(--le-accent) etc. from tokensFor()',
  },
  {
    name: 'literal font-family',
    re: /font-?[Ff]amily\s*[:=]\s*['"`][^'"`]*['"`]/g,
    hint: 'use var(--le-font-display) / var(--le-font-body)',
  },
  {
    name: 'literal radius',
    re: /border-?[Rr]adius\s*[:=]\s*['"`]?\d+(px|rem)/g,
    hint: 'use var(--le-radius-button) / --le-radius-card / --le-radius-image',
  },
  {
    name: 'literal shadow',
    re: /box-?[Ss]hadow\s*[:=]\s*['"`]?\d/g,
    hint: 'use var(--le-shadow-card)',
  },
]

console.log('\nHardcoded-style check — components/lead-engine/')
let styleClean = true
for (const file of walk(COMPONENT_DIR)) {
  const source = scannable(readFileSync(file, 'utf8'))
  for (const rule of RULES) {
    const hits = source.match(rule.re)
    if (hits) {
      styleClean = false
      fail(`${relative('.', file)} — ${rule.name}: ${[...new Set(hits)].slice(0, 4).join(', ')}`)
      console.error(`      ${rule.hint}`)
    }
  }
}
if (styleClean) pass(`no hardcoded colours, fonts, radii or shadows in ${walk(COMPONENT_DIR).length} files`)

// ── 2. Live checks ───────────────────────────────────────────────────────────

if (!LIVE) {
  console.log('\n(style check only — pass --live with --env-file to check schema and rendering)')
  process.exitCode = failures ? 1 : 0
} else {
  const { createClient } = await import('@supabase/supabase-js')
  const { TEMPLATES, THEMES, resolveForVertical } = await import('@/lib/lead-engine/theme')
  const { ALL_VERTICAL_OPTIONS } = await import('@/lib/lead-engine/verticals')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  console.log('\nSchema — production Supabase')
  const { data: row, error } = await supabase
    .from('lead_engine_sites')
    .select('id, slug, status, template, theme, brand, content')
    .limit(1)

  if (error) {
    fail(`lead_engine_sites: ${error.message}`)
    if (error.code === 'PGRST205' || error.code === '42P01') {
      console.error('      apply supabase/migrations/2026-08-23-lead-engine.sql')
    }
  } else {
    pass('lead_engine_sites has template, theme and brand')
    if (row?.[0] && !THEMES.includes(row[0].theme)) {
      fail(`a row carries theme "${row[0].theme}", which is not one of the six`)
    }
  }

  // Every template must have a component, or a vertical resolves to a page that cannot render.
  console.log('\nTemplates')
  const files = walk(join(COMPONENT_DIR, 'templates')).map(f => f.replace(/\\/g, '/'))
  const EXPECTED = {
    trade_classic: 'TradeClassic', service_clean: 'ServiceClean', showcase_grid: 'ShowcaseGrid',
    practice: 'Practice', supply: 'Supply',
  }
  for (const t of TEMPLATES) {
    const hit = files.some(f => f.endsWith(`/${EXPECTED[t]}.tsx`))
    hit ? pass(`${t} -> ${EXPECTED[t]}.tsx`) : fail(`${t} has no component`)
  }

  // Every vertical an operator can pick must resolve to a template that exists.
  console.log('\nVertical mapping')
  let unmapped = 0
  for (const { value } of ALL_VERTICAL_OPTIONS) {
    const { template, theme } = resolveForVertical(value)
    if (!TEMPLATES.includes(template) || !THEMES.includes(theme)) {
      fail(`${value} resolves to ${template} + ${theme}, which is not a real pair`)
      unmapped++
    }
  }
  if (!unmapped) pass(`all ${ALL_VERTICAL_OPTIONS.length} selectable verticals resolve to a real pair`)

  // The rendered pages, read as a visitor would get them.
  const base = process.env.BASE_URL ?? 'http://localhost:3001'
  console.log(`\nRendering — ${base}`)
  const { data: live } = await supabase
    .from('lead_engine_sites')
    .select('slug, questionnaire')
    .eq('status', 'live')
    .like('slug', 'review-%')

  for (const site of live ?? []) {
    let html = ''
    try {
      const res = await fetch(`${base}/sites/${site.slug}`)
      html = await res.text()
      if (!res.ok) { fail(`/sites/${site.slug} returned ${res.status}`); continue }
    } catch (e) {
      fail(`/sites/${site.slug} — ${e.message}`)
      continue
    }

    // The assertion a template author is most likely to break, restated here because it is silent:
    // pain points would simply render, and look like copy.
    const pain = site.questionnaire?.pain_points
    if (pain && html.toLowerCase().includes(pain.slice(0, 24).toLowerCase())) {
      fail(`/sites/${site.slug} LEAKS PAIN POINTS into rendered output`)
    } else {
      pass(`/sites/${site.slug} renders, no pain-point leak`)
    }

    // Nothing may claim a capability that does not exist. Twilio is unconfigured everywhere.
    for (const claim of ['text you', 'we\'ll text', 'instant quote', 'book online', 'live availability', 'pay a deposit']) {
      if (html.toLowerCase().includes(claim)) fail(`/sites/${site.slug} claims "${claim}", which does not exist`)
    }
  }

  process.exitCode = failures ? 1 : 0
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nAll checks passed.\n')

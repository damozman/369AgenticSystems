/**
 * Lead Engine's verification gate.
 *
 * Three jobs, deliberately in one script so neither gets skipped:
 *
 *   1. **The hardcoded-style check.** No hex literal, no literal font-family, no literal radius or
 *      shadow anywhere under `components/lead-engine/`. This is the only thing standing between the
 *      theme system and drift, because `next.config.mjs` sets `ignoreBuildErrors: true` and nothing
 *      else in the toolchain will ever notice a stray `#0A0A0A`. One of those and a site stops
 *      being themed — on one kit, invisibly, for whoever bought that kit.
 *
 *   2. **The live schema and render check**, against production Supabase and the real route.
 *
 *   3. **Chunk B: a real questionnaire round-trip, a real lead submission, and the owner
 *      notification path** — writes and cleans up ONE throwaway site (slug prefixed
 *      `verify-lead-engine-`), separate from the `review-` fixtures Job 2 reads. Refuses to touch
 *      anything not carrying that prefix, and refuses a `status = 'live'` row even then.
 *
 * Part 1 needs no database and no server, so it runs first and always.
 *
 *   node scripts/verify-lead-engine.mjs                       # style check only
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-lead-engine.mjs --live
 *
 * What Job 3 deliberately does NOT cover, and why:
 *   - **The photo cap.** `decidePhotoUpload`'s refusal is already asserted directly in
 *     `lib/lead-engine/limits.test.ts`, and the upload route itself (sign → direct-to-Storage →
 *     process) was proven end to end on 2026-08-24 with a real HEIC photo — see
 *     `docs/LEAD-ENGINE-PLAN.md`'s own handoff. Re-proving it here would mean re-building that
 *     harness for no new information.
 *   - **The change-request route.** `decideRevision` — the only real decision in it — already has
 *     its own thorough unit coverage in `lib/lead-engine/limits.test.ts`. The route itself needs an
 *     authenticated owner session, which this script has no way to mint without a real login; that
 *     is worth a manual click-through, not a scripted one.
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
  let out = source
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/^\s*\/\/.*$/gm, '')          // line comments
  for (const line of PX_EXEMPT) out = out.split(line).join('')
  return out
}

/**
 * The colour, font, radius and shadow rules skip the authored stylesheet — it is where the tokens
 * are consumed, and it legitimately contains hairlines and structural values. The two px rules do
 * NOT skip it: a fixed column track or a px measure inside that block is exactly the drift they
 * exist to catch.
 */
function scannableNoCss(source) {
  return scannable(source).replace(/const SITE_CSS = `[\s\S]*?`\n/, '')
}

const RULES_SCAN_CSS = new Set(['grid-template-columns with a literal px', 'max-width in px'])

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
  {
    // A px column track is a fixed-width layout wearing a grid's clothes: it does not respond, and
    // it is what makes a section leave dead columns at one breakpoint and overflow at another.
    name: 'grid-template-columns with a literal px',
    re: /grid-?[Tt]emplate-?[Cc]olumns\s*[:=][^;\n]*\d+px/g,
    hint: 'use fr units, repeat(12, 1fr), or a token',
  },
  {
    // Measure belongs in ch (it tracks the font) or in a token. A px max-width silently stops
    // tracking the type scale the moment a theme changes its display face.
    //
    // The lookbehind excludes `@media (max-width: 720px)` — a breakpoint is a viewport fact, not a
    // measure, and px is the only sane unit for one. Only a max-width applied to an ELEMENT is
    // caught.
    name: 'max-width in px',
    re: /(?<!\()max-?[Ww]idth\s*[:=]\s*['"`]?\d+px/g,
    hint: 'use ch for measure, % for media, or a token — px only in the container and the logo cap',
  },
]

/**
 * Lines the px rules do not apply to.
 *
 * The container itself is a real pixel measurement — 1280px is the design's canvas width, not a
 * measure — and a logo's maximum height is a physical constraint on someone else's artwork.
 * Exempting them by exact string keeps the rule honest rather than toothless.
 */
const PX_EXEMPT = [
  '.le-wrap { max-width: 1280px;',
  '.le-header-logo { max-height: 40px;',
]

console.log('\nHardcoded-style check — components/lead-engine/')
let styleClean = true
for (const file of walk(COMPONENT_DIR)) {
  const raw = readFileSync(file, 'utf8')
  const withCss = scannable(raw)
  const withoutCss = scannableNoCss(raw)
  for (const rule of RULES) {
    const source = RULES_SCAN_CSS.has(rule.name) ? withCss : withoutCss
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
  const { previewEnabled } = await import('@/lib/lead-engine/preview')
  const { createSite } = await import('@/lib/lead-engine/site')
  const { questionnaireUrl } = await import('@/lib/lead-engine/questionnaire-url')
  const { SUBMIT_THROTTLE_MAX } = await import('@/lib/lead-engine/rate-limit')
  const previewOn = previewEnabled()

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

  // ── The fixtures must never be publicly reachable ──────────────────────────
  // A `review-` row at status 'live' puts eight fictional businesses, with fictional licence
  // numbers and fictional testimonials, on the production domain the moment this branch deploys.
  console.log('\nReview fixtures')
  const { data: fixtures } = await supabase
    .from('lead_engine_sites')
    .select('slug, status, questionnaire')
    .like('slug', 'review-%')
    .order('slug')

  const notDraft = (fixtures ?? []).filter(s => s.status !== 'draft')
  if (notDraft.length) {
    for (const s of notDraft) fail(`${s.slug} is status "${s.status}" — review fixtures must be draft`)
  } else {
    pass(`all ${fixtures?.length ?? 0} review fixtures are draft, so production serves none of them`)
  }

  if (!previewOn) {
    console.error('      LEAD_ENGINE_PREVIEW is not "true", so drafts will 404 — set it in .env.local to review locally')
  }

  // The rendered pages, read as a visitor would get them.
  const base = process.env.BASE_URL ?? 'http://localhost:3001'
  console.log(`\nRendering — ${base}`)
  const live = fixtures

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

    // The composition rule, asked mechanically: a section renders only with three or more content
    // ELEMENTS. Counting elements rather than characters is the point — a gallery of six photos is
    // dense and carries almost no text, so a character threshold flagged every gallery on every
    // site while missing a coverage section holding one city.
    //
    // input|textarea|button|select added when Chunk B's real LeadForm replaced the inert
    // placeholder: this rule predates a genuine form ever sitting in the Contact section, so it
    // only ever counted the LEFT column's own intro <p> — a real form with six controls and no
    // <p>/<li>/<img> of its own read as "near-empty" by this regex alone, which is backwards for
    // the single most action-oriented section on the page.
    const CONTENT_EL = /<(?:img|li|p|details|blockquote|dd|input|textarea|button|select)\b/g
    const emptySections = [...html.matchAll(/<section[^>]*id="([^"]+)"[\s\S]*?<\/section>/g)]
      .filter(([block]) => (block.match(CONTENT_EL) ?? []).length < 3)
      .map(([, id]) => id)
    if (emptySections.length) {
      fail(`/sites/${site.slug} has near-empty section(s): ${emptySections.join(', ')}`)
    }
  }

  // ── 320px: no horizontal scroll, on every fixture ──────────────────────────
  //
  // This is the regression test for layout overflow, and it has to render rather than read source.
  // The defect it exists to catch produced a 9px sideways scroll on a page where EVERY element
  // measured inside the viewport — the boxes fit and the text painted outside them — so no
  // static check and no element-bounds check could see it.
  //
  // It also covers the case the CSS cannot: `min-width: 0` is applied to an enumerated list of
  // layout containers, so a grid section added later is not on that list. This assertion does not
  // care what caused the overflow.
  let browser
  try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
  } catch (e) {
    fail(`could not launch Playwright: ${e.message} — this check did NOT run`)
  }

  // ── Every button a visitor can see is readable ─────────────────────────────
  //
  // This is the regression test for the defect that hid for the entire build: the rule deciding
  // button colour is `.le-site[data-accent-mode=...]`, and the attribute was set on a wrapper div
  // OUTSIDE .le-site, so it had never once matched. Every unit test still passed, because they
  // assert the CONTRACT — what colour a given mode SHOULD produce — and the contract was right.
  // Nothing asked what the browser actually painted.
  //
  // So this reads getComputedStyle off the real element. It fails if the attribute moves, if the
  // selector is edited, if a theme's accent regresses, or if a new button class is added without
  // the correction — none of which a pure test can see.
  if (browser) {
    console.log('\nButton contrast, as painted')
    for (const site of fixtures ?? []) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
      try {
        await page.goto(`${base}/sites/${site.slug}`, { waitUntil: 'networkidle', timeout: 30000 })
        const buttons = await page.evaluate(() => {
          const lum = (c) => {
            const [r, g, b] = c.map(v => {
              const s = v / 255
              return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
            })
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
          const parse = (s) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
          // The painted background, walking up through any transparent ancestors — exactly what
          // the eye resolves when a button sits on a section that sits on the page.
          const behind = (el) => {
            for (let n = el; n; n = n.parentElement) {
              const bg = getComputedStyle(n).backgroundColor
              if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return parse(bg)
            }
            return [255, 255, 255]
          }
          return [...document.querySelectorAll('.le-btn, .le-submit')].map(el => {
            const cs = getComputedStyle(el)
            const fg = parse(cs.color)
            const bg = behind(el)
            const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
            return {
              text: (el.textContent ?? '').trim().slice(0, 28),
              ratio: (a + 0.05) / (b + 0.05),
              fg: cs.color, bg: cs.backgroundColor,
            }
          })
        })

        const mode = await page.$eval('.le-site', el => el.dataset.accentMode ?? null).catch(() => null)
        if (!mode) {
          fail(`${site.slug}: .le-site carries no data-accent-mode — the button-contrast rules cannot match`)
        }

        // 3:1 is WCAG's large-text threshold, and a button label is large or bold text.
        const unreadable = buttons.filter(b => b.ratio < 3.0)
        if (!buttons.length) {
          fail(`${site.slug}: no buttons found — this check silently proved nothing`)
        } else if (unreadable.length) {
          for (const b of unreadable) {
            fail(`${site.slug} [${mode}] "${b.text}" is ${b.ratio.toFixed(2)}:1 — ${b.fg} on ${b.bg}`)
          }
        } else {
          const worst = Math.min(...buttons.map(b => b.ratio))
          pass(`${site.slug} [${mode}] — ${buttons.length} buttons, worst ${worst.toFixed(2)}:1`)
        }
      } catch (e) {
        fail(`${site.slug} button contrast — ${e.message}`)
      } finally {
        await page.close()
      }
    }
  }

  if (browser) {
    console.log('\nNo horizontal scroll at 320px')
    for (const site of fixtures ?? []) {
      const page = await browser.newPage({ viewport: { width: 320, height: 800 } })
      try {
        await page.goto(`${base}/sites/${site.slug}`, { waitUntil: 'networkidle', timeout: 30000 })
        const { vw, sw } = await page.evaluate(() => ({
          vw: document.documentElement.clientWidth,
          sw: document.documentElement.scrollWidth,
        }))
        sw <= vw
          ? pass(`${site.slug} — ${sw}px in ${vw}px`)
          : fail(`${site.slug} scrolls sideways at 320px: ${sw}px in ${vw}px (+${sw - vw})`)
      } catch (e) {
        fail(`${site.slug} at 320px — ${e.message}`)
      } finally {
        await page.close()
      }
    }
    await browser.close()
  }

  // ── 3. Chunk B: questionnaire round-trip, submission, notification ────────
  //
  // Its own throwaway site, deliberately separate from the `review-` fixtures above — those are
  // read-only reference pages for a human to look at, and this job WRITES (a submission row, an
  // owner-notification email if RESEND_API_KEY is set). Reusing a fixture for that would risk a
  // real reviewer opening a page mid-write, or a cleanup step here touching content someone is
  // relying on to stay put.
  console.log('\nChunk B — questionnaire, submission, notification')
  const CHUNK_B_PREFIX = 'verify-lead-engine-'
  const OWNER = 'chris@369agenticsystems.com'
  let chunkBSiteId

  async function cleanupChunkBSite(siteId) {
    if (!siteId) return
    const { data: site } = await supabase.from('lead_engine_sites').select('slug, status').eq('id', siteId).maybeSingle()
    if (!site) return
    if (!site.slug.startsWith(CHUNK_B_PREFIX)) { fail(`REFUSING to delete ${site.slug} — not a Chunk B verify site`); return }
    if (site.status === 'live') { fail(`REFUSING to delete ${site.slug} — status is live`); return }
    // Submissions cascade from the site row (ON DELETE CASCADE).
    await supabase.from('lead_engine_sites').delete().eq('id', siteId)
    pass(`cleaned up ${site.slug}`)
  }

  try {
    const created = await createSite({
      ownerEmail: OWNER,
      businessName: 'Verify Lead Engine Co',
      vertical: 'roofing',
      preferredSlug: `${CHUNK_B_PREFIX}${Date.now()}`,
      notifyEmail: OWNER,
    })
    if (!created.ok) {
      fail(`createSite() failed: ${created.error}`)
    } else {
      chunkBSiteId = created.id
      pass(`createSite() -> ${created.slug}`)

      // questionnaireUrl() returns the PUBLIC PAGE a customer opens (/lead-engine/questionnaire/[id]),
      // not the API. It returns HTML, not JSON — fetching it directly and calling .json() on the
      // result silently swallows a parse error via `.catch(() => ({}))`, which is exactly how the
      // first version of this check failed: `beforeBody.answers` was never "not null", it was
      // `undefined` from parsing a React page as JSON. `apiUrl` is the actual endpoint; `qUrl` is
      // kept only so the token in its query string can be reused on `apiUrl` below.
      const qUrl = questionnaireUrl(chunkBSiteId, base)
      const token = new URL(qUrl).searchParams.get('t')
      token ? pass('a questionnaire token was minted (ONBOARDING_TOKEN_SECRET is set)')
            : fail('no token minted — ONBOARDING_TOKEN_SECRET is unset, the link would be unsigned')

      const apiUrl = `${base}/api/lead-engine/questionnaire/${chunkBSiteId}?t=${encodeURIComponent(token ?? '')}`

      const getBefore = await fetch(apiUrl)
      const beforeBody = await getBefore.json().catch(() => ({}))
      getBefore.status === 200 ? pass('GET /questionnaire/[id] returns 200') : fail(`GET /questionnaire/[id] returned ${getBefore.status}`)
      beforeBody.answers === null
        ? pass('answers are null before any submission')
        : fail(`answers were not null on a brand-new site: ${JSON.stringify(beforeBody.answers)}`)

      const answers = {
        t: token,
        business_name: 'Verify Lead Engine Co',
        phone: '(817) 555-0100',
        differentiator: 'Every roof we replace is inspected by the owner before we ask for the final payment.',
        customer_impression: 'That we actually answered the phone at nine at night.',
        credentials: 'Licensed and insured in Texas',
        notify_email: OWNER,
        services: [{ name: 'Roof replacement', description: 'Full tear-off and re-roof.' }],
      }
      const post = await fetch(`${base}/api/lead-engine/questionnaire/${chunkBSiteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      const postBody = await post.json().catch(() => ({}))
      post.status === 200 ? pass('POST /questionnaire/[id] returns 200') : fail(`POST /questionnaire/[id] returned ${post.status}: ${JSON.stringify(postBody)}`)
      postBody.authorizedBy === 'signed-link' ? pass('authorizedBy is signed-link') : fail(`authorizedBy was "${postBody.authorizedBy}"`)

      const { data: afterRow } = await supabase
        .from('lead_engine_sites')
        .select('status, needs_review, questionnaire')
        .eq('id', chunkBSiteId)
        .single()
      afterRow?.status === 'in_build' ? pass('status moved draft -> in_build') : fail(`status is "${afterRow?.status}", expected in_build`)
      afterRow?.needs_review === true ? pass('needs_review is true') : fail('needs_review was not set')
      afterRow?.questionnaire?.differentiator === answers.differentiator
        ? pass('questionnaire.differentiator round-tripped')
        : fail('questionnaire.differentiator did not match what was posted')

      const getAfter = await fetch(apiUrl)
      const afterBody = await getAfter.json().catch(() => ({}))
      afterBody.answers?.differentiator === answers.differentiator
        ? pass('answers.differentiator round-trips through the read path')
        : fail(`the read path did not return what was saved — got ${JSON.stringify(afterBody.answers?.differentiator)}`)

      const badGet = await fetch(`${base}/api/lead-engine/questionnaire/${chunkBSiteId}?t=not-a-real-token`)
      badGet.status === 403 ? pass('a bad token is refused with 403') : fail(`a bad token returned ${badGet.status}, expected 403`)

      console.log('\nChunk B — honeypot and throttle')

      const honeypot = await fetch(`${base}/api/lead-engine/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: chunkBSiteId, name: 'Bot', email: 'bot@example.com', hp_field: 'a bot filled this in',
        }),
      })
      const honeypotBody = await honeypot.json().catch(() => ({}))
      honeypot.status === 200 && honeypotBody.ok === true
        ? pass('a tripped honeypot still returns a fake 200 success')
        : fail(`a tripped honeypot returned ${honeypot.status}: ${JSON.stringify(honeypotBody)}`)

      const { count: afterHoneypot } = await supabase
        .from('lead_engine_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', chunkBSiteId)
      afterHoneypot === 0
        ? pass('the honeypot submission wrote no row')
        : fail(`the honeypot submission wrote ${afterHoneypot} row(s) — it should write none`)

      const submit = await fetch(`${base}/api/lead-engine/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: chunkBSiteId, name: 'Test Prospect', email: 'prospect@example.com', phone: '(817) 555-0199',
          message: 'Verification script — safe to ignore.',
        }),
      })
      const submitBody = await submit.json().catch(() => ({}))
      submit.status === 200 ? pass('POST /submit returns 200') : fail(`POST /submit returned ${submit.status}: ${JSON.stringify(submitBody)}`)

      const { data: submissionRow } = await supabase
        .from('lead_engine_submissions')
        .select('id, name, email, notified_at, notify_error')
        .eq('site_id', chunkBSiteId)
        .maybeSingle()
      submissionRow ? pass('the submission row exists') : fail('no submission row was written')
      submissionRow?.name === 'Test Prospect' && submissionRow?.email === 'prospect@example.com'
        ? pass('name and email were captured')
        : fail('the submission row does not carry what was posted')
      submissionRow?.notified_at || submissionRow?.notify_error
        ? pass(`the notification path resolved one way or the other — ${submissionRow.notified_at ? `sent at ${submissionRow.notified_at}` : `failed: ${submissionRow.notify_error}`}`)
        : fail('notified_at and notify_error are BOTH null — a submission that vanished silently')

      // One real submission already landed above. Fire enough more to reach SUBMIT_THROTTLE_MAX,
      // then confirm the NEXT one past it is refused with 429.
      for (let i = 1; i < SUBMIT_THROTTLE_MAX; i++) {
        await fetch(`${base}/api/lead-engine/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId: chunkBSiteId, name: `Filler ${i}`, email: `filler${i}@example.com` }),
        })
      }
      const throttled = await fetch(`${base}/api/lead-engine/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: chunkBSiteId, name: 'One too many', email: 'toomany@example.com' }),
      })
      throttled.status === 429
        ? pass(`submission ${SUBMIT_THROTTLE_MAX + 1} in the window is refused with 429`)
        : fail(`submission ${SUBMIT_THROTTLE_MAX + 1} returned ${throttled.status}, expected 429`)
      throttled.headers.get('retry-after')
        ? pass(`429 carries a Retry-After header (${throttled.headers.get('retry-after')}s)`)
        : fail('429 response has no Retry-After header')

      const badSubmit = await fetch(`${base}/api/lead-engine/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: '00000000-0000-0000-0000-000000000000', name: 'X', email: 'x@example.com' }),
      })
      badSubmit.status === 404 ? pass('a submission against a nonexistent site returns 404') : fail(`a nonexistent siteId returned ${badSubmit.status}, expected 404`)
    }
  } finally {
    await cleanupChunkBSite(chunkBSiteId)
  }

  // ── Sweep ──────────────────────────────────────────────────────────────────
  if (process.argv.includes('--sweep')) {
    console.log('\nSweeping review fixtures')
    for (const site of fixtures ?? []) {
      if (!site.slug.startsWith('review-')) continue  // belt and braces on a prefix delete
      const { error: delErr } = await supabase.from('lead_engine_sites').delete().eq('slug', site.slug)
      delErr ? fail(`${site.slug}: ${delErr.message}`) : pass(`removed ${site.slug}`)
    }
  }

  process.exitCode = failures ? 1 : 0
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nAll checks passed.\n')

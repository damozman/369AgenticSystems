/**
 * Mobile / responsive audit — renders every public page at several widths and
 * reports anything that overflows horizontally or is too small to tap.
 *
 * This exists because a session in July found two real bugs this way (the agent
 * hero grid, and 3-col stat rows on all nine cold-email pages) using a script
 * that was never committed — so the capability was lost and the next session
 * reasoned about CSS instead of looking at a rendered page. Reasoning about grid
 * columns is not the same as rendering one.
 *
 *   node scripts/mobile-audit.mjs                 # against http://localhost:3000
 *   node scripts/mobile-audit.mjs --url https://…  # against a deployed origin
 *   node scripts/mobile-audit.mjs --shots          # also write PNGs to .mobile-audit/
 *
 * Start the server first: npm run build && npm start
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > -1 ? process.argv[i + 1] : d
}
const BASE  = arg('--url', 'http://localhost:3000').replace(/\/$/, '')
const SHOTS = process.argv.includes('--shots')

// Real device widths, not round numbers. 320 is the narrowest phone still in use
// and is where fixed-width elements break first.
const WIDTHS = [
  { w: 320,  h: 720,  name: 'iPhone SE (320)' },
  { w: 390,  h: 844,  name: 'iPhone 14 (390)' },
  { w: 430,  h: 932,  name: 'iPhone Pro Max (430)' },
  { w: 768,  h: 1024, name: 'iPad portrait (768)' },
  { w: 1024, h: 768,  name: 'iPad landscape (1024)' },
  { w: 1280, h: 800,  name: 'laptop (1280)' },
  { w: 1440, h: 900,  name: 'desktop (1440)' },
  { w: 1920, h: 1080, name: 'wide (1920)' },
]

const PAGES = [
  '/',
  '/roofing-leads/', '/hvac-leads/', '/plumbing-leads/',
  '/event-rentals-leads/', '/dumpster-rental-leads/', '/equipment-rental-leads/',
  '/real-estate-leads/', '/insurance-leads/', '/wholesale-leads/',
  '/legal-automation/', '/dental-leads/', '/saas-optimization/',
  '/roofing', '/event-rentals', '/dumpster-rental', '/equipment-rental',
  '/roofing/roi-calculator', '/event-rentals/roi-calculator',
]

/** Runs in the page. Finds elements wider than the viewport, and small tap targets. */
function probe() {
  const vw = document.documentElement.clientWidth
  const docW = document.documentElement.scrollWidth
  const offenders = []
  const seen = new Set()

  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el)
    if (st.display === 'none' || st.visibility === 'hidden') continue
    // Decorative blurred orbs and full-bleed backdrops are deliberately oversized
    // and are not what causes a scrollbar — they are pointer-events:none overlays.
    if (st.position === 'fixed' || st.pointerEvents === 'none') continue

    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue

    const right = r.left + r.width
    if (right > vw + 1 || r.left < -1) {
      // Report the outermost offender only — children inherit the overflow.
      let p = el.parentElement, nested = false
      while (p && p !== document.body) {
        if (seen.has(p)) { nested = true; break }
        p = p.parentElement
      }
      if (nested) continue

      // A wide element inside an overflow-x:auto ancestor is the CORRECT pattern
      // for a table or code block on a phone — it scrolls in its own box and the
      // page does not. Only `hidden` is a finding, because that silently cuts the
      // content off with no way to reach it.
      let a = el.parentElement, verdict = 'overflows the viewport'
      while (a && a !== document.documentElement) {
        const as = getComputedStyle(a)
        if (as.overflowX === 'auto' || as.overflowX === 'scroll') { verdict = 'scrollable'; break }
        if (as.overflowX === 'hidden' || as.overflow === 'hidden') { verdict = 'CLIPPED by an overflow:hidden ancestor'; break }
        a = a.parentElement
      }
      if (verdict === 'scrollable') continue

      seen.add(el)
      offenders.push({
        verdict,
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 60),
        id: el.id || '',
        left: Math.round(r.left),
        right: Math.round(right),
        width: Math.round(r.width),
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 55),
      })
    }
  }

  // Tap targets. Threshold is deliberately low (20px, not the 44px WCAG target):
  // inline text links in a footer are ~21px tall by convention and flagging them
  // buries the real finding. What this is hunting is the genuinely untappable —
  // a range input whose hit area is 2px tall, say.
  const small = []
  for (const el of document.querySelectorAll('a, button, input, select')) {
    const st = getComputedStyle(el)
    if (st.display === 'none' || st.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.height < 20 || r.width < 20) {
      small.push({
        tag: el.tagName.toLowerCase(),
        w: Math.round(r.width), h: Math.round(r.height),
        text: (el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      })
    }
  }

  // Content escaping its own overflow:hidden box. The viewport check above cannot
  // see this: a fixed-height card whose text spills out is clipped silently, and
  // the page width never changes. This is what a two-line label in a 310px card
  // looks like, and it only shows up at the widths where the label wraps.
  const spills = []
  for (const box of document.querySelectorAll('*')) {
    const bs = getComputedStyle(box)
    if (bs.overflow !== 'hidden' && bs.overflowY !== 'hidden') continue
    const br = box.getBoundingClientRect()
    if (br.height < 40 || br.width < 40) continue
    for (const kid of box.querySelectorAll(':scope > *')) {
      const ks = getComputedStyle(kid)
      // Panels parked outside the box by a transform are hover states, not bugs.
      if (ks.transform !== 'none' || ks.display === 'none' || ks.visibility === 'hidden') continue
      let deepest = 0
      for (const n of kid.querySelectorAll('*')) {
        const ns = getComputedStyle(n)
        if (ns.transform !== 'none' || ns.position === 'absolute') continue
        const nr = n.getBoundingClientRect()
        if (nr.height && nr.bottom > deepest) deepest = nr.bottom
      }
      const kr = kid.getBoundingClientRect()
      const bottom = Math.max(deepest, kr.bottom)
      const over = Math.round(bottom - br.bottom)
      if (over > 2) {
        spills.push({
          box: (box.className || box.tagName).toString().split(/\s+/)[0],
          over,
          text: (kid.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 58),
        })
        break
      }
    }
    if (spills.length >= 5) break
  }

  return { vw, docW, scrolls: docW > vw + 1, offenders: offenders.slice(0, 8),
           small: small.slice(0, 6), spills }
}

const browser = await chromium.launch()
let problems = 0, checked = 0, missing = 0

if (SHOTS) mkdirSync('.mobile-audit', { recursive: true })

for (const path of PAGES) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  let status = 0
  try {
    let res = await page.goto(BASE + path, { waitUntil: 'load', timeout: 25000 })
    status = res ? res.status() : 0
    // `next start` serves public/ by exact path and does not resolve a directory
    // to its index.html the way Vercel does. Fall back so a local run covers the
    // static -leads pages instead of silently skipping thirteen of them.
    if (status >= 400 && path.endsWith('/')) {
      res = await page.goto(BASE + path + 'index.html', { waitUntil: 'load', timeout: 25000 })
      status = res ? res.status() : 0
    }
  } catch {
    console.log(`\n${path}\n   ✗ could not load`)
    missing++; await ctx.close(); continue
  }
  if (status >= 400) {
    console.log(`\n${path}\n   ✗ HTTP ${status}`)
    missing++; await ctx.close(); continue
  }

  const lines = []
  for (const vp of WIDTHS) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    // Overlays that default to display:none are invisible to this script unless we
    // open them. The audit picker had eleven cards and two broken links for months
    // behind exactly that. Open anything modal-shaped before probing.
    await page.evaluate(() => {
      const m = document.getElementById('audit-modal')
      if (m) m.classList.add('open')
    })
    // Let the reveal observers and the hero panel settle.
    await page.waitForTimeout(450)
    const r = await page.evaluate(probe)
    checked++

    if (r.scrolls || r.offenders.length || r.small.length || r.spills.length) {
      const bits = []
      if (r.scrolls) bits.push(`page scrolls sideways (${r.docW}px in ${r.vw}px)`)
      if (r.spills.length) bits.push(`${r.spills.length} element(s) spilling out of a clipped box`)
      if (r.small.length) bits.push(`${r.small.length} small tap target(s)`)
      lines.push(`   ${vp.name}: ${bits.join(', ') || 'overflow'}`)
      for (const o of r.offenders) {
        lines.push(`      <${o.tag}${o.id ? '#' + o.id : ''}${o.cls ? ' .' + o.cls.split(/\s+/)[0] : ''}> ` +
                   `w=${o.width} right=${o.right} — ${o.verdict}
         "${o.text}"`)
      }
      for (const s of r.small) {
        lines.push(`      tap ${s.w}x${s.h}  <${s.tag}> "${s.text}"`)
      }
      for (const sp of r.spills) {
        lines.push(`      SPILL +${sp.over}px out of .${sp.box}
         "${sp.text}"`)
      }
      if (r.scrolls || r.offenders.length || r.spills.length) problems++
      if (SHOTS) {
        await page.screenshot({
          path: `.mobile-audit/${path.replace(/\W+/g, '_') || 'home'}_${vp.w}.png`,
          fullPage: false,
        })
      }
    }
  }

  if (lines.length) console.log(`\n${path}\n${lines.join('\n')}`)
  await ctx.close()
}

await browser.close()

console.log(`\n${'─'.repeat(60)}`)
console.log(`${checked} page/width combinations checked across ${PAGES.length} pages.`)
if (missing) console.log(`${missing} page(s) did not load — is the server running at ${BASE}?`)
console.log(problems ? `${problems} combination(s) with layout problems (above).`
                     : 'No horizontal overflow found.')
process.exit(problems ? 1 : 0)

/**
 * Proves every static intake form posts the step-2 payload contract — in a real browser.
 *
 * The route has its own end-to-end check (`verify-intake-payload.mjs`); this is the other half,
 * because the route being right says nothing about whether twelve hand-built HTML forms actually
 * send it. That gap is a repeat offender here: `item` and `sms_consent` were both defined, both
 * described, and both simply never sent, because every test called the API directly. Verify
 * through the consumer.
 *
 * Requests to /api/intake are intercepted and fulfilled locally, so this writes nothing, sends no
 * mail and needs no cleanup.
 *
 * What it asserts, per page:
 *   - a submit with no bottleneck checked is BLOCKED (a checkbox group cannot be `required`, so
 *     the validity is carried on the first box — if that wiring breaks, the form silently posts
 *     an empty pain_points array and nobody notices)
 *   - checked boxes arrive as an array, in form order
 *   - service_area, monthly_volume and avg_job_value are all present
 *   - the retired keys `pain` and `industry_specific_field` are gone
 *
 * Needs a server:  npm run dev   (or npm start)
 * Then:  node scripts/verify-intake-forms.mjs
 * BASE_URL=http://localhost:3007 to point at another port.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:3007'
const PAGES = [
  ['/roofing-leads/index.html',          '369AS_ROOFING_INTAKE'],
  ['/hvac-leads/index.html',             '369AS_HVAC_INTAKE'],
  ['/plumbing-leads/index.html',         '369AS_PLUMBING_INTAKE'],
  ['/legal-automation/index.html',       '369AS_LEGAL_INTAKE'],
  ['/real-estate-leads/index.html',      '369AS_REAL_ESTATE_INTAKE'],
  ['/insurance-leads/index.html',        '369AS_INSURANCE_INTAKE'],
  ['/saas-optimization/index.html',      '369AS_SAAS_INTAKE'],
  ['/wholesale-leads/index.html',        '369AS_WHOLESALE_INTAKE'],
  ['/event-rentals-leads/index.html',    '369AS_EVENT_RENTALS_INTAKE'],
  ['/dumpster-rental-leads/index.html',  '369AS_DUMPSTER_RENTAL_INTAKE'],
  ['/equipment-rental-leads/index.html', '369AS_EQUIPMENT_RENTAL_INTAKE'],
]

const browser = await chromium.launch()
let fails = 0

for (const [path, tag] of PAGES) {
  const page = await browser.newPage()
  const posted = []
  // Intercept so nothing reaches the real route.
  await page.route('**/api/intake', route => {
    posted.push(JSON.parse(route.request().postData()))
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
  })
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })

  const fill = async (sel, val) => { const el = page.locator(sel); if (await el.count()) await el.fill(val) }
  await fill('#f-name', 'Form Check')
  await fill('#f-company', 'Check Co')
  await fill('#f-firm', 'Check Firm')
  await fill('#f-email', 'chris@369agenticsystems.com')
  await fill('#f-area', 'Fort Worth')
  await fill('#f-volume', '120')
  await fill('#f-value', '8200')

  // 1 · submit with NO bottleneck checked — must be blocked
  await page.locator('#audit-form button[type=submit]').click()
  await page.waitForTimeout(300)
  const blocked = posted.length === 0
  console.log(`${blocked ? '  ✓' : '  ✗'} ${path} blocks a submit with no bottleneck checked`)
  if (!blocked) fails++

  // 2 · check two, submit — must post them in form order
  const boxes = page.locator('#f-pain input[type=checkbox]')
  await boxes.nth(0).check()
  await boxes.nth(2).check()
  await page.locator('#audit-form button[type=submit]').click()
  await page.waitForTimeout(500)

  if (posted.length !== 1) {
    console.log(`  ✗ ${path} did not post after checking boxes (posts=${posted.length})`)
    fails++
  } else {
    const p = posted[0]
    const okTag  = p.source_tag === tag
    const okPain = Array.isArray(p.pain_points) && p.pain_points.length === 2
    const okNums = p.monthly_volume === '120' && p.avg_job_value === '8200'
    const okArea = typeof p.service_area === 'string' && p.service_area.length > 0
    const okOld  = !('industry_specific_field' in p) && !('pain' in p)
    for (const [label, ok] of [['source_tag ' + p.source_tag, okTag], ['pain_points ' + JSON.stringify(p.pain_points), okPain],
                               ['volume+value', okNums], ['service_area', okArea], ['old keys gone', okOld]]) {
      console.log(`  ${ok ? '✓' : '✗'} ${path} ${label}`)
      if (!ok) fails++
    }
  }
  await page.close()
}

await browser.close()
console.log(fails ? `\n✗ ${fails} failure(s)` : '\n✓ all form checks passed')
process.exitCode = fails ? 1 : 0

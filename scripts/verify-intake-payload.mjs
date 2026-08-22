/**
 * Proves the intake payload contract end to end, through the real route.
 *
 * Dossier steps 0 and 2. Step 0 shipped on 2026-08-21 and its write path was never actually
 * exercised — the newest `system_audits` row predated the deploy by a day, so "verified against
 * production" meant the migration had been applied, not that the route wrote anything. This is the
 * script that closes that gap, and it checks the consumer's view (what is in the table) rather
 * than the producer's (what the route says it did).
 *
 * What it asserts:
 *   - every field the forms now post lands in its own column
 *   - `service_area` holds a service area, not a volume — the defect this contract replaces
 *   - a number it cannot read becomes NULL, never 0 and never a guess
 *   - an out-of-range number becomes NULL rather than being clamped to something plausible
 *   - the old cached-page shape (`pain`, `industry_specific_field`) still submits
 *   - the homepage's business type files the row under the trade, not under 'unlisted'
 *
 * ⚠ Writes to PRODUCTION Supabase — there is no sandbox below the app layer — and sends real
 * email through Resend. Submissions use the owner's own address per the project's email policy,
 * and every row it creates is deleted at the end, including on failure.
 *
 * Needs the dev server:  npm run dev
 * Then:  node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-intake-payload.mjs
 * BASE_URL=http://localhost:3001 to point at another port.
 */
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL    = 'chris@369agenticsystems.com'
const STAMP    = `verify-intake-${Date.now()}`

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const created = []
let passed = 0
const failures = []

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { passed++; console.log(`  ✓ ${label}`) }
  else {
    failures.push(label)
    console.log(`  ✗ ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`)
  }
}

async function submit(payload) {
  const res = await fetch(`${BASE_URL}/api/intake`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ client_email: EMAIL, ...payload }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`POST /api/intake -> ${res.status} ${JSON.stringify(body)}`)
  const { data, error } = await db.from('system_audits')
    .select('*').eq('client_domain', payload.website_content_domain).order('created_at', { ascending: false }).limit(1)
  if (error) throw error
  if (!data.length) throw new Error(`no row written for ${payload.website_content_domain}`)
  created.push(data[0].id)
  return data[0]
}

async function main() {
  console.log(`\n369 · intake payload contract — ${BASE_URL}\n`)

  // Refuse to run against production. This script writes rows and sends mail.
  if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
    throw new Error('BASE_URL must be a local dev server — this script submits real leads')
  }

  const { error: reachable } = await db.from('system_audits').select('id', { head: true, count: 'exact' })
  if (reachable) throw new Error(`Supabase unreachable: ${reachable.message}`)

  // Does the pain_points column exist yet? The route degrades without it, and so does this check.
  const { error: colErr } = await db.from('system_audits').select('pain_points').limit(1)
  const hasPainPoints = !colErr
  if (!hasPainPoints) {
    console.log('  ⚠ pain_points column is NOT applied — apply 2026-08-22-intake-pain-points.sql')
    console.log('    (the route degrades to the joined string; those checks are skipped)\n')
  }

  // ── 1 · A full, well-formed submission from a leads page ────────────────────
  console.log('1 · a complete submission')
  const domain1 = `${STAMP}-full.example.com`
  const row1 = await submit({
    source_tag:      '369AS_ROOFING_INTAKE',
    client_name:     'Verification Run',
    client_company:  'Verify Roofing Co',
    website_content: `https://${domain1}`,
    website_content_domain: domain1,
    service_area:    'Fort Worth, TX',
    monthly_volume:  '~120/mo',
    avg_job_value:   '$8,200',
    pain_points:     ['speed', 'afterhours', 'tracking'],
  })
  check('client_industry is the clean vertical', row1.client_industry, 'roofing')
  check('client_company persisted',              row1.client_company, 'Verify Roofing Co')
  check('service_area holds a SERVICE AREA',     row1.service_area, 'Fort Worth, TX')
  check('monthly_volume parsed from "~120/mo"',  row1.monthly_volume, 120)
  check('avg_job_value parsed from "$8,200"',    Number(row1.avg_job_value), 8200)
  check('website_url persisted',                 row1.website_url, `https://${domain1}`)
  check('pain_point mirrors the joined string',  row1.pain_point, 'speed, afterhours, tracking')
  if (hasPainPoints) {
    check('pain_points keeps form order', row1.pain_points, ['speed', 'afterhours', 'tracking'])
  }

  // ── 2 · Numbers it cannot read must be NULL, not 0 ──────────────────────────
  // The dossier omits a section it has no number for. A 0 would render as a real figure and
  // quietly claim the prospect books nothing — the Gumloop failure this whole design replaces.
  console.log('\n2 · unreadable and out-of-range numbers')
  const domain2 = `${STAMP}-junk.example.com`
  const row2 = await submit({
    source_tag:      '369AS_EVENT_RENTALS_INTAKE',
    client_name:     'Verification Run',
    client_company:  'Verify Rentals',
    website_content: `https://${domain2}`,
    website_content_domain: domain2,
    service_area:    'Dallas, TX',
    monthly_volume:  'quite a few',
    avg_job_value:   '9'.repeat(40),
    pain_points:     ['afterhours'],
  })
  check('unreadable volume is NULL, not 0',      row2.monthly_volume, null)
  check('overflowing value is NULL, not clamped', row2.avg_job_value, null)
  check('the rest of the lead still landed',     row2.service_area, 'Dallas, TX')
  check('rental vertical resolved',              row2.client_industry, 'event-rentals')

  // ── 3 · A cached page still posting the old shape ───────────────────────────
  // Pages are static and CDN-cached; a browser keeps posting the pre-deploy payload for a while.
  // Losing those leads would be the expensive kind of tidy.
  console.log('\n3 · the old cached-page shape')
  const domain3 = `${STAMP}-legacy.example.com`
  const row3 = await submit({
    source_tag:              '369AS_REALESTATE_INTAKE',   // the old, never-matching spelling
    client_name:             'Verification Run',
    client_company:          'Verify Realty',
    website_content:         `https://${domain3}`,
    website_content_domain:  domain3,
    pain:                    'afterhours',
    industry_specific_field: 'Arlington, TX',
  })
  check('old REALESTATE tag now maps correctly', row3.client_industry, 'real-estate')
  check('industry_specific_field still fills service_area', row3.service_area, 'Arlington, TX')
  check('single pain value still stored',        row3.pain_point, 'afterhours')
  if (hasPainPoints) check('single pain becomes a one-item array', row3.pain_points, ['afterhours'])

  // ── 4 · The homepage catch-all ──────────────────────────────────────────────
  console.log('\n4 · the homepage "Not Listed?" modal')
  const domain4 = `${STAMP}-unlisted.example.com`
  const row4 = await submit({
    source_tag:             '369AS_UNLISTED_INTAKE',
    client_name:            'Verification Run',
    client_company:         'Verify Med Spa LLC',
    client_industry_detail: 'Med Spa',
    website_content:        `https://${domain4}`,
    website_content_domain: domain4,
    service_area:           'Plano, TX',
    monthly_volume:         '80',
    avg_job_value:          '2500',
    pain_points:            ['busy'],
  })
  check('filed under the trade, not "unlisted"', row4.client_industry, 'Med Spa')
  check('company is the company, not the trade', row4.client_company, 'Verify Med Spa LLC')
  check('volume persisted',                      row4.monthly_volume, 80)
  check('value persisted',                       Number(row4.avg_job_value), 2500)
}

async function cleanup() {
  if (!created.length) return
  const { error } = await db.from('system_audits').delete().in('id', created)
  console.log(error
    ? `\n⚠ cleanup FAILED for ${created.length} row(s): ${error.message}`
    : `\ncleaned up ${created.length} verification row(s)`)
}

main()
  .then(cleanup, async err => {
    await cleanup()
    console.error(`\n✗ ${err.message}`)
    process.exitCode = 1
  })
  .then(() => {
    if (failures.length) {
      console.log(`\n✗ ${passed} passed, ${failures.length} FAILED:`)
      for (const f of failures) console.log(`    · ${f}`)
      process.exitCode = 1
    } else if (process.exitCode !== 1) {
      console.log(`\n✓ all ${passed} checks passed`)
    }
  })

/**
 * Verifies that a ZERO-DOLLAR checkout (a 100%-off coupon) provisions a client.
 *
 * Why this script exists: Stripe reports `payment_status: 'no_payment_required'` — not
 * 'paid' — when a coupon zeroes the amount due. The webhook used to gate on 'paid' alone,
 * so a free pilot signup returned HTTP 200, showed as a SUCCESSFUL delivery in Stripe's
 * dashboard, and provisioned nothing at all. Only an end-to-end run proves the fix: a unit
 * test cannot tell you that Stripe really sends that status for this checkout shape.
 *
 * It drives the REAL test-mode Payment Link, because that is the production path —
 * components/verticals/VerticalPricing.tsx sends buyers to
 * `{link}?client_reference_id={vertical}`.
 *
 * DRY RUN BY DEFAULT. Without --apply it spends nothing, writes nothing, and creates no
 * Stripe objects. Read the preflight output before you pass --apply.
 *
 *   node --env-file=.env.local scripts/verify-zero-dollar-checkout.mjs
 *   node --env-file=.env.local scripts/verify-zero-dollar-checkout.mjs --apply
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Retell } from 'retell-sdk'

const APPLY = process.argv.includes('--apply')

// The throwaway identity this test provisions under. Deliberately unmistakable: if one of
// these ever shows up in a dashboard or an invoice, it is this script's litter, not a client.
const TEST_VERTICAL  = 'roofing'
const TEST_DOMAIN    = 'zero-dollar-test.369agenticsystems.com'
const TEST_BUSINESS  = 'ZERO DOLLAR TEST — DELETE ME'
const TEST_TIER_ENV  = 'NEXT_PUBLIC_STRIPE_LINK_STARTER'
const TEST_PRICE_ENV = 'STRIPE_PRICE_ID_STARTER'
const COUPON_NAME    = 'Zero-dollar provisioning test (100% off)'
const PROMO_CODE     = 'ZERODOLLARTEST'

// Nothing in this script may touch the one real subscription.
const PROTECTED = ['northsideroofing.com', 'www.northsideroofing.com', 'damozman@yahoo.com']

let failures = 0
let warnings = 0
const ok   = (m) => console.log(`  [ok]   ${m}`)
const bad  = (m) => { failures++; console.log(`  [FAIL] ${m}`) }
const warn = (m) => { warnings++; console.log(`  [warn] ${m}`) }

function heading(t) { console.log(`\n${t}\n${'-'.repeat(t.length)}`) }

// --- 1. Stripe must be in TEST mode ----------------------------------------------------
heading('1. Stripe mode')
const key = process.env.STRIPE_SECRET_KEY || ''
if (key.startsWith('sk_test')) {
  ok('STRIPE_SECRET_KEY is a TEST key')
} else if (key.startsWith('sk_live')) {
  bad('STRIPE_SECRET_KEY is a LIVE key — refusing. This script creates a 100%-off coupon, which would let a real customer check out for free.')
  process.exit(1)
} else {
  bad('STRIPE_SECRET_KEY is missing or unrecognised')
  process.exit(1)
}
const stripe = new Stripe(key)

// --- 2. The Payment Link must be shaped so the webhook can succeed ---------------------
heading('2. Payment Link (the production path)')
const linkUrl = process.env[TEST_TIER_ENV]
if (!linkUrl) { bad(`${TEST_TIER_ENV} is not set`); process.exit(1) }
ok(`${TEST_TIER_ENV} = ${linkUrl}`)

const links = await stripe.paymentLinks.list({ limit: 100 })
const link = links.data.find(l => l.url === linkUrl || linkUrl.startsWith(l.url))
if (!link) {
  bad(`No test-mode Payment Link matches that URL. Found ${links.data.length} link(s) on this account.`)
  process.exit(1)
}
ok(`resolved to ${link.id}`)

if (link.allow_promotion_codes) ok('promotion codes are already enabled on the link')
else warn('promotion codes are DISABLED — the code cannot be entered at checkout (--apply enables it)')

if (link.payment_method_collection === 'if_required') {
  ok("payment_method_collection is 'if_required' — a zero-dollar checkout will not ask for a card")
} else {
  warn(`payment_method_collection is '${link.payment_method_collection}' — Stripe would still ask for a card at $0 (--apply sets it to 'if_required')`)
}

// The three custom fields the webhook reads back. A missing key is a hard 400 in the route,
// which is a DIFFERENT failure from the one under test — rule it out before spending.
const wantFields = ['business_name', 'website_domain', 'preferred_area_code']
const haveFields = (link.custom_fields || []).map(f => f.key)
for (const k of wantFields) {
  if (haveFields.includes(k)) ok(`custom field '${k}' present`)
  else bad(`custom field '${k}' MISSING on the link — the webhook rejects this checkout at the missing-fields check, not at the gate under test`)
}
if (link.phone_number_collection?.enabled) ok('phone number collection enabled')
else warn('phone number collection disabled — phone will be undefined (not fatal)')

// --- 3. Tier resolution ----------------------------------------------------------------
heading('3. Tier resolution')
const priceId = process.env[TEST_PRICE_ENV]
if (!priceId) {
  bad(`${TEST_PRICE_ENV} is not set — the webhook could not map the line item to a tier`)
} else {
  const items = await stripe.paymentLinks.listLineItems(link.id, { expand: ['data.price'] })
  const ids = items.data.map(i => i.price?.id)
  if (ids.includes(priceId)) ok(`link's price ${priceId} maps to tier Starter`)
  else bad(`link's price(s) ${ids.join(', ')} do not match ${TEST_PRICE_ENV}=${priceId} — the webhook would 400 on 'Unknown price / tier'`)
  if (items.data.some(i => i.price?.recurring)) {
    ok('price is recurring — checkout is subscription mode and yields a real stripe_subscription_id')
  } else {
    bad('price is NOT recurring — no subscription id, which is the whole point of onboarding through checkout')
  }
}

// --- 4. Downstream reality check -------------------------------------------------------
heading('4. Downstream (these are REAL — Retell has no test mode)')
if (process.env.RETELL_TEMPLATE_AGENT_ROOFING) ok('RETELL_TEMPLATE_AGENT_ROOFING is set (the agent is cloned from it)')
else bad('RETELL_TEMPLATE_AGENT_ROOFING is not set — provisioning would throw')

if (!process.env.RETELL_API_KEY) {
  bad('RETELL_API_KEY is not set')
} else {
  const retell = new Retell({ apiKey: process.env.RETELL_API_KEY })
  // retell-sdk returns { items, has_more } here, not an array.
  const numbers = (await retell.phoneNumber.list()).items ?? []
  ok(`Retell reachable — ${numbers.length} phone number(s) on the account right now (cleanup baseline)`)
  for (const n of numbers) console.log(`         ${n.phone_number}`)
  warn('a completed checkout BUYS ONE MORE NUMBER on this account. cleanup-zero-dollar-test.mjs releases it.')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  bad('Supabase env not set — provisioning would fail on the insert')
} else {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await supabase.from('agent_subscriptions').select('client_domain, business_name, user_email')
  if (error) {
    bad(`Supabase query failed: ${error.message}`)
  } else {
    ok(`Supabase reachable — ${data.length} agent_subscriptions row(s) right now (cleanup baseline)`)
    for (const r of data) console.log(`         ${r.client_domain} — ${r.business_name}`)
    warn('this writes to PRODUCTION Supabase. There is no staging database.')
    if (data.some(r => PROTECTED.includes(String(r.client_domain || '').toLowerCase()))) {
      ok('the real Northside row is present, and neither this script nor the cleanup touches it')
    }
    if (data.some(r => String(r.client_domain || '').toLowerCase() === TEST_DOMAIN)) {
      bad(`a row for ${TEST_DOMAIN} already exists — run cleanup-zero-dollar-test.mjs before re-testing`)
    }
  }
}

// --- 5. Local receiver ------------------------------------------------------------------
heading('5. Local webhook receiver')
try {
  const res = await fetch('http://localhost:3001/api/stripe-webhook', { method: 'POST', body: '{}' })
  // 400 is the CORRECT answer: no signature, so constructEvent rejects it. It proves the
  // route is up, is running this branch's code, and is reachable by `stripe listen`.
  if (res.status === 400) ok('dev server is up on :3001 and rejects an unsigned POST with 400 — as it should')
  else warn(`dev server answered ${res.status} (expected 400 for an unsigned POST)`)
} catch {
  warn('nothing listening on :3001 — start `npm run dev` and `stripe listen` before completing a checkout')
}

// --- Verdict -----------------------------------------------------------------------------
heading('Verdict')
console.log(`  ${failures} blocking, ${warnings} warning(s)`)
if (failures) {
  console.log('\n  BLOCKED. Fix the [FAIL] items above before spending anything.')
  process.exit(1)
}
if (!APPLY) {
  console.log(`
  DRY RUN — nothing was created and nothing was spent.

  Re-run with --apply to create the 100%-off coupon + promotion code and print the
  checkout URL. That step still spends nothing; the Retell number is bought only when
  the checkout is actually completed in the browser.`)
  process.exit(0)
}

// --- Apply -------------------------------------------------------------------------------
heading('Applying')
if (!link.allow_promotion_codes || link.payment_method_collection !== 'if_required') {
  await stripe.paymentLinks.update(link.id, {
    allow_promotion_codes: true,
    payment_method_collection: 'if_required',
  })
  ok('enabled promotion codes + set payment_method_collection=if_required on the TEST link')
}

const coupons = await stripe.coupons.list({ limit: 100 })
let coupon = coupons.data.find(c => c.name === COUPON_NAME && c.percent_off === 100)
if (!coupon) {
  coupon = await stripe.coupons.create({ name: COUPON_NAME, percent_off: 100, duration: 'forever' })
  ok(`created coupon ${coupon.id} (100% off, forever)`)
} else {
  ok(`reusing coupon ${coupon.id}`)
}

const promos = await stripe.promotionCodes.list({ code: PROMO_CODE, limit: 1 })
let promo = promos.data[0]
if (!promo) {
  promo = await stripe.promotionCodes.create({ coupon: coupon.id, code: PROMO_CODE })
  ok(`created promotion code ${promo.code}`)
} else {
  ok(`reusing promotion code ${promo.code}`)
}

console.log(`
=========================================================================
  Open this URL and complete the checkout:

  ${linkUrl}?client_reference_id=${TEST_VERTICAL}

  Promotion code:      ${PROMO_CODE}
  Business name:       ${TEST_BUSINESS}
  Website domain:      ${TEST_DOMAIN}
  Preferred area code: 817
  Email:               chris@369agenticsystems.com

  The total must read $0.00 and no card should be requested. If Stripe asks for
  a card, STOP — payment_method_collection did not take, the session would come
  through as 'paid', and the run would test the wrong thing.

  Watch the \`npm run dev\` window. Expect:
     [ONBOARD] Provisioning Retell agent for ${TEST_BUSINESS}...
     [ONBOARD] Retell agent provisioned: agent_... -> +1...

  Then clean up:
     node --env-file=.env.local scripts/cleanup-zero-dollar-test.mjs
=========================================================================`)

/**
 * Proves the ownership gate on /api/questionnaire/submit. Writes only to the review sandbox.
 *
 * The hole it closes: until 2026-08-19 the route checked that a client_domain EXISTED and
 * nothing else, then wrote that client's questionnaire, hours and stock and rewrote the
 * general_prompt of their LIVE Retell agent. Chris reproduced it by accident during a layout
 * review, against his only real client.
 *
 * Run against a server started with ONBOARDING_TOKEN_SECRET set. Pass the same secret here so
 * the script can mint the tokens a real link would carry:
 *
 *   ONBOARDING_TOKEN_SECRET=<same> node --env-file=.env.local --import ./scripts/test-resolver.mjs \
 *     scripts/verify-questionnaire-auth.mjs
 *
 * Reports what the server is actually doing rather than assuming which mode it is in — a gate
 * that is deployed but not armed looks identical to a working one unless you check.
 */

import { createClient } from '@supabase/supabase-js'
import { mintOnboardingToken } from '../lib/security/onboarding-token.ts'

const URL_ = 'http://localhost:3001/api/questionnaire/submit'
const SANDBOX = 'review-sandbox.369agenticsystems.com'
const OTHER   = 'www.Northsideroofing.com'

if (!process.env.ONBOARDING_TOKEN_SECRET) {
  console.error('ONBOARDING_TOKEN_SECRET must be set, and must match the running server.')
  process.exit(1)
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let failures = 0
const ok  = (m) => console.log(`  [ok]   ${m}`)
const bad = (m) => { failures++; console.log(`  [FAIL] ${m}`) }
const heading = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`)

// Minimal but realistic body. Only ever aimed at the sandbox domain.
function body(domain, token) {
  return {
    client_domain: domain,
    respondent_role: 'Auth test',
    ...(token !== undefined ? { onboarding_token: token } : {}),
    schedule: {
      timezone: 'America/Chicago',
      business_hours: { mon: { open: '09:00', close: '17:00' } },
      slot_duration_minutes: 60, max_concurrent_per_slot: 1,
    },
  }
}

async function post(domain, token) {
  const res = await fetch(URL_, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body(domain, token)),
  })
  let json = {}
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

const { data: sandbox } = await supabase
  .from('agent_subscriptions').select('client_domain').eq('client_domain', SANDBOX).maybeSingle()
if (!sandbox) {
  console.error(`The review sandbox does not exist. Create it first:\n  node --env-file=.env.local scripts/review-sandbox-client.mjs --create`)
  process.exit(1)
}

// --- Which mode is the server in? -----------------------------------------------------------
heading('0. Is the gate armed?')
const noToken = await post(SANDBOX, undefined)
const enforcing = noToken.status === 403
console.log(`  unauthenticated POST -> ${noToken.status}`)
if (enforcing) ok('server is ENFORCING (ONBOARDING_AUTH_ENFORCED=true)')
else console.log('  [warn] server is REPORTING-ONLY — it allowed an unauthenticated write and logged a warning.')

// --- The attack that actually happened -------------------------------------------------------
heading('1. A stranger who knows the domain')
if (enforcing) {
  if (noToken.status === 403) ok('refused with 403 — cannot rewrite hours, stock, or the live agent prompt')
  else bad(`expected 403, got ${noToken.status}`)
} else {
  if (noToken.status === 200) ok('allowed, as reporting-only mode intends (check the server log for "WOULD REFUSE")')
  else bad(`expected 200 in reporting-only mode, got ${noToken.status}`)
}

// --- A token minted for someone else ----------------------------------------------------------
heading("2. A valid token, but for a DIFFERENT client")
{
  // The real risk once tokens exist: one client's link authorising writes to another.
  const wrong = mintOnboardingToken(OTHER)
  const res = await post(SANDBOX, wrong)
  if (enforcing) {
    if (res.status === 403) ok(`a token minted for ${OTHER} does not authorise ${SANDBOX}`)
    else bad(`cross-client token was accepted with ${res.status} — the token is not bound to the domain`)
  } else {
    console.log(`  reporting-only, so this returned ${res.status}; the binding itself is covered by lib/security/onboarding-token.test.ts`)
  }
}

// --- Garbage --------------------------------------------------------------------------------
heading('3. A forged or corrupted token')
for (const t of ['nonsense', '9999999999.deadbeef', '']) {
  const res = await post(SANDBOX, t)
  if (enforcing) {
    if (res.status === 403) ok(`refused: ${JSON.stringify(t)}`)
    else bad(`accepted forged token ${JSON.stringify(t)} with ${res.status}`)
  } else {
    console.log(`  reporting-only: ${JSON.stringify(t)} -> ${res.status}`)
  }
}

// --- The real link ----------------------------------------------------------------------------
heading('4. The link we actually email')
{
  const good = mintOnboardingToken(SANDBOX)
  const res = await post(SANDBOX, good)
  if (res.status === 200) ok('a properly signed link is accepted — the onboarding flow still works')
  else bad(`a valid signed link was REJECTED with ${res.status}: ${JSON.stringify(res.json)}`)
}

// --- The token in the query string, as the browser would send it -------------------------------
heading('5. Token in the URL rather than the body')
{
  const good = mintOnboardingToken(SANDBOX)
  const res = await fetch(`${URL_}?t=${encodeURIComponent(good)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body(SANDBOX, undefined)),
  })
  if (res.status === 200) ok('accepted from the query string too')
  else bad(`query-string token rejected with ${res.status}`)
}

heading('Verdict')
if (!enforcing) console.log('  NOTE: run again with ONBOARDING_AUTH_ENFORCED=true to prove it refuses.')
console.log(failures ? `  ${failures} FAILURE(S)` : '  All checks passed.')
process.exit(failures ? 1 : 0)

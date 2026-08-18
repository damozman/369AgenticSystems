/**
 * Verifies the provisioning idempotency guard. BUYS NOTHING, EVER.
 *
 * On 2026-08-18 one checkout provisioned three Retell agents and bought three phone numbers.
 * Two of those runs were 3ms apart, so the guard has to be a database insert that can lose,
 * not a select that can be raced. This checks that it is.
 *
 * How it stays free: every call that reaches provisionClient runs with a DELIBERATELY INVALID
 * RETELL_API_KEY. If the guard works, Retell is never called and the key is irrelevant. If the
 * guard is broken, the very first Retell request fails authentication — before
 * phoneNumber.create() — so a regression shows up as a loud failure instead of a purchase.
 * The Retell number count is compared before and after regardless, as a backstop.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-provisioning-idempotency.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { Retell } from 'retell-sdk'

const REAL_RETELL_KEY = process.env.RETELL_API_KEY
// Set before importing anything that constructs a Retell client — lib/retell-provisioning.ts
// reads the key at module load. A present-but-invalid key passes its startup check and fails
// at the first API call, which is exactly the safety net we want.
process.env.RETELL_API_KEY = 'key_deliberately_invalid_idempotency_test'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const SUB_ALREADY_CLAIMED = 'sub_TEST_idempotency_already_claimed'
const SUB_FRESH           = 'sub_TEST_idempotency_release_path'
const TEST_DOMAIN         = 'idempotency-test.369agenticsystems.com'

let failures = 0
const ok  = (m) => console.log(`  [ok]   ${m}`)
const bad = (m) => { failures++; console.log(`  [FAIL] ${m}`) }
const heading = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`)

async function retellNumberCount() {
  const r = new Retell({ apiKey: REAL_RETELL_KEY })
  return ((await r.phoneNumber.list()).items ?? []).length
}

async function cleanup() {
  await supabase.from('provisioning_claims').delete().in('stripe_subscription_id', [SUB_ALREADY_CLAIMED, SUB_FRESH])
  await supabase.from('agent_subscriptions').delete().eq('client_domain', TEST_DOMAIN)
}

// --- 0. The table has to exist -----------------------------------------------------------
heading('0. Migration applied?')
{
  const { error } = await supabase.from('provisioning_claims').select('stripe_subscription_id').limit(1)
  if (error) {
    bad(`provisioning_claims is not queryable: ${error.message}`)
    console.log('\n  Apply supabase/migrations/2026-08-18-provisioning-claims.sql in the Supabase SQL editor first.')
    console.log('  NOTE: deploying the code without this table makes provisionClient refuse EVERY signup.')
    process.exit(1)
  }
  ok('provisioning_claims exists')
}

await cleanup()
const numbersBefore = await retellNumberCount()
ok(`Retell numbers before: ${numbersBefore}`)

// --- 1. The database arbitrates the race -------------------------------------------------
heading('1. A duplicate claim loses at the database')
{
  const first = await supabase.from('provisioning_claims')
    .insert({ stripe_subscription_id: SUB_ALREADY_CLAIMED, client_domain: TEST_DOMAIN })
  if (first.error) bad(`first claim should succeed: ${first.error.message}`)
  else ok('first claim inserted')

  const second = await supabase.from('provisioning_claims')
    .insert({ stripe_subscription_id: SUB_ALREADY_CLAIMED, client_domain: TEST_DOMAIN })
  if (second.error?.code === '23505') ok('second claim rejected with 23505 (unique_violation) — the race is arbitrated by Postgres')
  else bad(`second claim should fail with 23505, got: ${second.error?.code ?? 'no error at all'}`)
}

// --- 2. provisionClient short-circuits on an already-claimed purchase ---------------------
heading('2. A duplicate delivery provisions nothing')
{
  const { provisionClient } = await import('../lib/onboard-client.ts')
  let result, threw
  try {
    result = await provisionClient({
      businessName: 'IDEMPOTENCY TEST — should never provision',
      email: 'chris@369agenticsystems.com',
      vertical: 'roofing',
      tier: 'Starter',
      clientDomain: TEST_DOMAIN,
      stripeSubscriptionId: SUB_ALREADY_CLAIMED,
    })
  } catch (e) { threw = e }

  if (threw) bad(`should have returned early, but threw: ${threw.message}`)
  else if (result === null) ok('returned null without provisioning')
  else bad(`should have returned null, got: ${JSON.stringify(result)?.slice(0, 120)}`)

  const { data: row } = await supabase.from('agent_subscriptions').select('client_domain').eq('client_domain', TEST_DOMAIN).maybeSingle()
  if (row) bad('a subscription row was created — the guard did not short-circuit')
  else ok('no agent_subscriptions row was created')
}

// --- 3. A failed run releases its claim ---------------------------------------------------
heading('3. A failure releases the claim, so a retry is not locked out')
{
  const { provisionClient } = await import('../lib/onboard-client.ts')
  let threw
  try {
    await provisionClient({
      businessName: 'IDEMPOTENCY TEST — release path',
      email: 'chris@369agenticsystems.com',
      vertical: 'roofing',
      tier: 'Starter',
      clientDomain: TEST_DOMAIN,
      stripeSubscriptionId: SUB_FRESH,
    })
  } catch (e) { threw = e }

  // The invalid Retell key makes provisioning fail at the first API call — before any number
  // is bought. That is the failure this test wants: it exercises the release path for free.
  if (threw) ok(`provisioning failed as designed (${String(threw.message).slice(0, 60)}...)`)
  else bad('expected provisioning to fail with an invalid Retell key')

  const { data: claim } = await supabase.from('provisioning_claims').select('stripe_subscription_id').eq('stripe_subscription_id', SUB_FRESH).maybeSingle()
  if (claim) bad('the claim was NOT released — a retry for this customer would be blocked forever')
  else ok('claim released — a retry can provision this customer')
}

// --- 4. Backstop: nothing was bought ------------------------------------------------------
heading('4. Backstop')
{
  const after = await retellNumberCount()
  if (after === numbersBefore) ok(`Retell numbers unchanged: ${after}`)
  else bad(`RETELL NUMBER COUNT CHANGED ${numbersBefore} -> ${after}. Release the extra number NOW.`)
}

await cleanup()
ok('test rows cleaned up')

heading('Verdict')
console.log(failures ? `  ${failures} FAILURE(S)` : '  All checks passed. Nothing was purchased.')
process.exit(failures ? 1 : 0)

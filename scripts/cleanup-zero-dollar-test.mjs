/**
 * Removes everything verify-zero-dollar-checkout.mjs provisions.
 *
 * The verification test buys a REAL Retell phone number, creates a REAL Retell agent and
 * LLM, and writes to the PRODUCTION Supabase — Retell has no test mode and there is no
 * staging database. Left behind, that number bills monthly and the row looks like a client.
 *
 * DRY RUN BY DEFAULT. Without --apply it deletes nothing.
 *
 *   node --env-file=.env.local scripts/cleanup-zero-dollar-test.mjs
 *   node --env-file=.env.local scripts/cleanup-zero-dollar-test.mjs --apply
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Retell } from 'retell-sdk'

const APPLY = process.argv.includes('--apply')
const TEST_DOMAIN = 'zero-dollar-test.369agenticsystems.com'

// The one real subscription, and the only number on the account that answers real callers.
// A cleanup script that can delete a client is worse than the litter it removes, so these
// are checked by value at every deletion rather than trusted to the domain filter above.
const PROTECTED_DOMAINS = ['northsideroofing.com', 'www.northsideroofing.com']
const PROTECTED_NUMBERS = ['+18176126757', '+18176350220'] // Northside; shared demo line
const PROTECTED_AGENTS  = ['agent_c29218a34d116e3a2a56ba8827'] // shared demo agent

function guard(row) {
  const domain = String(row.client_domain || '').toLowerCase()
  if (PROTECTED_DOMAINS.includes(domain)) {
    throw new Error(`REFUSING to delete protected domain ${row.client_domain}`)
  }
  if (domain !== TEST_DOMAIN) {
    throw new Error(`REFUSING: ${row.client_domain} is not the test domain`)
  }
  if (PROTECTED_NUMBERS.includes(String(row.retell_phone_number))) {
    throw new Error(`REFUSING to release protected number ${row.retell_phone_number}`)
  }
  if (PROTECTED_AGENTS.includes(String(row.retell_agent_id))) {
    throw new Error(`REFUSING to delete protected agent ${row.retell_agent_id}`)
  }
}

const act = (what) => console.log(`  ${APPLY ? 'DELETING' : 'would delete'}: ${what}`)

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const retell   = new Retell({ apiKey: process.env.RETELL_API_KEY })

const { data: rows, error } = await supabase
  .from('agent_subscriptions')
  .select('client_domain, user_email, retell_agent_id, retell_phone_number, stripe_customer_id, stripe_subscription_id')
  .eq('client_domain', TEST_DOMAIN)

if (error) { console.error('Supabase query failed:', error.message); process.exit(1) }
if (!rows.length) { console.log(`Nothing to clean — no row for ${TEST_DOMAIN}.`); process.exit(0) }

for (const row of rows) {
  guard(row)
  console.log(`\n${row.client_domain} (${row.user_email})`)

  // Retell: the number first. Deleting the agent while a number still points at it leaves
  // a purchased number bound to nothing, which is the expensive half of this cleanup.
  if (row.retell_phone_number) {
    act(`Retell number ${row.retell_phone_number}`)
    if (APPLY) await retell.phoneNumber.delete(row.retell_phone_number).catch(e => console.error('   number delete failed:', e.message))
  }

  if (row.retell_agent_id) {
    let llmId
    try {
      const agent = await retell.agent.retrieve(row.retell_agent_id)
      if (agent?.response_engine?.type === 'retell-llm') llmId = agent.response_engine.llm_id
    } catch (e) { console.error('   agent lookup failed:', e.message) }

    act(`Retell agent ${row.retell_agent_id}`)
    if (APPLY) await retell.agent.delete(row.retell_agent_id).catch(e => console.error('   agent delete failed:', e.message))

    if (llmId) {
      act(`Retell LLM ${llmId}`)
      if (APPLY) await retell.llm.delete(llmId).catch(e => console.error('   llm delete failed:', e.message))
    }
  }

  // Stripe, test mode only — cancelling a live subscription here would be unforgivable.
  const key = process.env.STRIPE_SECRET_KEY || ''
  if (row.stripe_subscription_id && key.startsWith('sk_test')) {
    const stripe = new Stripe(key)
    act(`Stripe TEST subscription ${row.stripe_subscription_id}`)
    if (APPLY) await stripe.subscriptions.cancel(row.stripe_subscription_id).catch(e => console.error('   sub cancel failed:', e.message))
  } else if (row.stripe_subscription_id) {
    console.log(`  SKIPPING Stripe subscription ${row.stripe_subscription_id} — key is not sk_test`)
  }

  act(`agent_configurations rows for ${row.client_domain}`)
  if (APPLY) {
    const { error: e } = await supabase.from('agent_configurations').delete().eq('client_domain', row.client_domain)
    if (e) console.error('   config delete failed:', e.message)
  }

  // The claim outlives the subscription row otherwise, and a stale claim would block a
  // re-test that happened to reuse the same subscription id.
  if (row.stripe_subscription_id) {
    act(`provisioning_claims row ${row.stripe_subscription_id}`)
    if (APPLY) {
      const { error: e } = await supabase.from('provisioning_claims').delete().eq('stripe_subscription_id', row.stripe_subscription_id)
      if (e) console.error('   claim delete failed:', e.message)
    }
  }

  act(`agent_subscriptions row ${row.client_domain}`)
  if (APPLY) {
    const { error: e } = await supabase.from('agent_subscriptions').delete().eq('client_domain', row.client_domain)
    if (e) console.error('   subscription delete failed:', e.message)
  }
}

// Sweep ORPHANS. The subscription row records ONE agent, but a single checkout can provision
// several: the event reaches every registered endpoint, and Stripe retries. The 2026-08-18 run
// produced three agents and three numbers from one checkout, and the row named only the last
// writer — so a cleanup driven by the row alone leaves purchased numbers billing forever.
// Matched on the agent NAME, which provisioning derives from the business name.
const AGENT_NAME_PREFIX = 'ZERO DOLLAR TEST'
const allAgents = (await retell.agent.list()).items ?? (await retell.agent.list()) ?? []
const orphans = (Array.isArray(allAgents) ? allAgents : [])
  .filter(a => String(a.agent_name || '').startsWith(AGENT_NAME_PREFIX))
  .filter(a => !PROTECTED_AGENTS.includes(a.agent_id))

if (orphans.length) {
  console.log(`
Orphan sweep — ${orphans.length} agent(s) named "${AGENT_NAME_PREFIX}..."`)
  const allNumbers = (await retell.phoneNumber.list()).items ?? []
  for (const a of orphans) {
    const bound = allNumbers.filter(n => (n.inbound_agents || []).some(x => x.agent_id === a.agent_id))
    for (const n of bound) {
      if (PROTECTED_NUMBERS.includes(n.phone_number)) { console.log(`  REFUSING protected number ${n.phone_number}`); continue }
      act(`Retell number ${n.phone_number} (orphan, bound to ${a.agent_id})`)
      if (APPLY) await retell.phoneNumber.delete(n.phone_number).catch(e => console.error('   failed:', e.message))
    }
    let llmId
    try {
      const full = await retell.agent.retrieve(a.agent_id)
      if (full?.response_engine?.type === 'retell-llm') llmId = full.response_engine.llm_id
    } catch {}
    act(`Retell agent ${a.agent_id} (${a.agent_name})`)
    if (APPLY) await retell.agent.delete(a.agent_id).catch(e => console.error('   failed:', e.message))
    if (llmId) {
      act(`Retell LLM ${llmId}`)
      if (APPLY) await retell.llm.delete(llmId).catch(e => console.error('   failed:', e.message))
    }
  }
}

// Prove the cleanup rather than assume it: re-read both sources afterwards.
if (APPLY) {
  const { data: left } = await supabase.from('agent_subscriptions').select('client_domain')
  const numbers = (await retell.phoneNumber.list()).items ?? []   // { items, has_more }, not an array
  console.log(`\nAfter cleanup: ${left?.length ?? '?'} agent_subscriptions row(s), ${numbers.length} Retell number(s)`)
  for (const r of left ?? []) console.log(`  ${r.client_domain}`)
  for (const n of numbers) console.log(`  ${n.phone_number}`)
} else {
  console.log('\nDRY RUN — nothing was deleted. Re-run with --apply.')
}

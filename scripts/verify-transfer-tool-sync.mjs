#!/usr/bin/env node
/**
 * Proves the Live Call Transfer WRITE path against real Retell, end to end.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-transfer-tool-sync.mjs
 *
 * The unit tests cover `decideTransferTool`; they cannot prove that `llm.update` actually lands,
 * that the agent's own response_engine then resolves the new tool, or that a removal really
 * removes. Every live client already matches their tier, so a dry run against production
 * correctly does nothing and proves none of that.
 *
 * **Buys nothing.** It creates a throwaway LLM + agent (both free) and NEVER calls
 * phoneNumber.create — a number is the only thing in Retell that costs money. It drives the
 * existing review-sandbox row, which has no Stripe ids and is not billable, and restores it.
 *
 * Cleanup runs in a `finally`, so a failed assertion still deletes the agent and the LLM and puts
 * the sandbox row back exactly as it was.
 */

import { Retell } from 'retell-sdk'
import { createClient } from '@supabase/supabase-js'
import { syncTransferToolForClient } from '../lib/retell-transfer-sync.ts'
import { TRANSFER_TOOL_NAME } from '../lib/retell-transfer-tool.ts'
import { collectPages } from '../lib/retell-pagination.ts'

const DOMAIN = 'review-sandbox.369agenticsystems.com'
const PROTECTED = ['www.northsideroofing.com', 'northsideroofing.com']
const TEST_PHONE = '+18175550147'
const NEW_PHONE = '+18175550199'
const AGENT_NAME = 'TRANSFER SYNC TEST — delete me'

if (PROTECTED.includes(DOMAIN.toLowerCase())) {
  console.error('x refusing to touch a real client')
  process.exit(1)
}

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let pass = 0
let fail = 0
const ok = (m, d) => { pass++; console.log(`  [PASS] ${m}${d ? ' — ' + d : ''}`) }
const bad = (m, d) => { fail++; console.log(`  [FAIL] ${m}${d ? ' — ' + d : ''}`) }
const head = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`)

const countAgents = async () =>
  (await collectPages(k => retell.agent.list({ pagination_key: k }), { label: 'agents' })).length
const listNumbers = async () =>
  await collectPages(k => retell.phoneNumber.list({ pagination_key: k }), { label: 'numbers' })

/** Read the tool back through the AGENT's own response_engine — the consumer's view. */
async function toolOnAgent(agentId) {
  const agent = await retell.agent.retrieve(agentId)
  if (agent.response_engine?.type !== 'retell-llm') return null
  const llm = await retell.llm.retrieve(agent.response_engine.llm_id)
  return (llm.general_tools ?? []).find(t => t.name === TRANSFER_TOOL_NAME) ?? null
}

const baselineAgents = await countAgents()
const { data: original } = await db
  .from('agent_subscriptions')
  .select('tier, retell_agent_id, owner_phone')
  .eq('client_domain', DOMAIN)
  .maybeSingle()

if (!original) {
  console.error(`x no ${DOMAIN} row — run review-sandbox-client.mjs --create first`)
  process.exit(1)
}
if (original.retell_agent_id) {
  console.error(`x ${DOMAIN} already has retell_agent_id ${original.retell_agent_id} — refusing to clobber it`)
  process.exit(1)
}

console.log('\n369 · transfer tool sync — REAL Retell writes against a throwaway agent')
console.log(`   baseline: ${baselineAgents} agents · sandbox row: tier=${original.tier} phone=${original.owner_phone ?? 'null'}`)

let llmId = null
let agentId = null

try {
  head('0. Create a throwaway agent (free — no phone number is bought)')
  const llm = await retell.llm.create({
    general_prompt: 'Throwaway agent for verifying transfer-tool sync. Never bound to a number.',
  })
  llmId = llm.llm_id
  const agent = await retell.agent.create({
    agent_name: AGENT_NAME,
    voice_id: 'retell-Marissa',
    response_engine: { type: 'retell-llm', llm_id: llmId },
  })
  agentId = agent.agent_id
  ok('throwaway agent + LLM created', agentId)

  const bound = (await listNumbers()).filter(n => (n.inbound_agents ?? []).some(a => a.agent_id === agentId))
  bound.length === 0
    ? ok('no phone number is bound to it — nothing was purchased')
    : bad('a phone number is bound to the throwaway agent', 'that would mean money was spent')

  head('1. Upgrade to Elite WITH a number on file -> attach')
  await db.from('agent_subscriptions')
    .update({ tier: 'Elite', retell_agent_id: agentId, owner_phone: TEST_PHONE })
    .eq('client_domain', DOMAIN)

  let r = await syncTransferToolForClient(DOMAIN)
  r.action === 'attach' ? ok('decided attach') : bad('expected attach', `got ${r.action}: ${r.reason}`)
  r.applied && r.verified ? ok('applied and self-verified') : bad('not applied/verified', r.reason)

  let t = await toolOnAgent(agentId)
  t ? ok('the AGENT now resolves a transfer tool') : bad('the agent resolves NO transfer tool after attach')
  t?.transfer_destination?.number === TEST_PHONE
    ? ok('destination is the number on file', TEST_PHONE)
    : bad('wrong destination', String(t?.transfer_destination?.number))
  t?.transfer_option?.type === 'warm_transfer' && t?.transfer_option?.transfer_ring_duration_ms === 30000
    ? ok('warm transfer, 30s ring — the proven configuration')
    : bad('transfer_option is not the proven configuration', JSON.stringify(t?.transfer_option))

  head('2. The same event delivered twice -> no duplicate tool')
  const before = await retell.llm.retrieve(llmId)
  r = await syncTransferToolForClient(DOMAIN)
  const after = await retell.llm.retrieve(llmId)
  r.action === 'none' ? ok('second delivery is a no-op') : bad('expected none on redelivery', r.action)
  const dupes = (after.general_tools ?? []).filter(x => x.name === TRANSFER_TOOL_NAME).length
  dupes === 1
    ? ok('exactly one transfer tool on the LLM', `${(before.general_tools ?? []).length} tools before, ${(after.general_tools ?? []).length} after`)
    : bad('duplicate or missing transfer tool', `count=${dupes}`)

  head('3. The number changes -> the tool is re-pointed, not left stale')
  await db.from('agent_subscriptions').update({ owner_phone: NEW_PHONE }).eq('client_domain', DOMAIN)
  r = await syncTransferToolForClient(DOMAIN)
  r.action === 'attach' ? ok('decided attach (re-point)') : bad('expected attach', r.action)
  t = await toolOnAgent(agentId)
  t?.transfer_destination?.number === NEW_PHONE
    ? ok('the agent now transfers to the new number', NEW_PHONE)
    : bad('destination not updated', String(t?.transfer_destination?.number))

  head('4. Downgrade away from Elite -> remove')
  await db.from('agent_subscriptions').update({ tier: 'Pro' }).eq('client_domain', DOMAIN)
  r = await syncTransferToolForClient(DOMAIN)
  r.action === 'remove' ? ok('decided remove') : bad('expected remove', `got ${r.action}: ${r.reason}`)
  r.applied && r.verified ? ok('applied and self-verified') : bad('not applied/verified', r.reason)
  t = await toolOnAgent(agentId)
  !t ? ok('the AGENT no longer resolves a transfer tool — no stale promise') : bad('the transfer tool survived the downgrade')
  const leftovers = (await retell.llm.retrieve(llmId)).general_tools ?? []
  leftovers.length === 0
    ? ok('removal took only the transfer tool, nothing else was collateral')
    : bad('other tools were disturbed', JSON.stringify(leftovers.map(x => x.name)))

  head('5. Elite with NO number on file -> blocked, never attached')
  await db.from('agent_subscriptions').update({ tier: 'Elite', owner_phone: null }).eq('client_domain', DOMAIN)
  r = await syncTransferToolForClient(DOMAIN)
  r.action === 'blocked' ? ok('decided blocked') : bad('expected blocked', `got ${r.action}: ${r.reason}`)
  r.needsAttention ? ok('needsAttention is set, so the owner alert fires') : bad('needsAttention not set — the block would be silent')
  !r.applied ? ok('nothing was written to Retell') : bad('it wrote to Retell despite having no destination')
  t = await toolOnAgent(agentId)
  !t ? ok('the agent still has NO transfer tool — nothing rings nowhere') : bad('a transfer tool was attached with no number')
} catch (e) {
  bad('threw', e?.message ?? String(e))
} finally {
  head('Cleanup')
  await db.from('agent_subscriptions')
    .update({ tier: original.tier, retell_agent_id: original.retell_agent_id, owner_phone: original.owner_phone })
    .eq('client_domain', DOMAIN)

  const { data: restored } = await db
    .from('agent_subscriptions')
    .select('tier, retell_agent_id, owner_phone')
    .eq('client_domain', DOMAIN)
    .maybeSingle()

  restored?.tier === original.tier
    && restored?.retell_agent_id === original.retell_agent_id
    && restored?.owner_phone === original.owner_phone
    ? ok('sandbox row restored exactly', `tier=${restored.tier} agent=${restored.retell_agent_id ?? 'null'} phone=${restored.owner_phone ?? 'null'}`)
    : bad('sandbox row NOT restored', JSON.stringify(restored))

  if (agentId) await retell.agent.delete(agentId).catch(e => bad('could not delete throwaway agent', e.message))
  if (llmId) await retell.llm.delete(llmId).catch(e => bad('could not delete throwaway LLM', e.message))

  const finalAgents = await countAgents()
  const finalNumbers = (await listNumbers()).length
  finalAgents === baselineAgents
    ? ok(`Retell back to ${finalAgents} agents`)
    : bad('agent count drifted', `${baselineAgents} -> ${finalAgents}`)
  console.log(`  [INFO] ${finalNumbers} phone numbers — unchanged, none was ever bought`)
}

console.log(`\n${fail === 0 ? 'OK' : 'FAILED'} — ${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)

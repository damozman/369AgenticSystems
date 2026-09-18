#!/usr/bin/env node
/**
 * READ-ONLY. Which agents can actually transfer a call, and to whom.
 *
 * Resolves each agent through its own response_engine (the consumer's view, at the version the
 * agent is pinned to), not through the LLM list — an LLM that reports a tool while the agent
 * resolves an older version is how the demo line once recorded nothing for ten days.
 *
 * Run:  node --env-file=.env.local scripts/retell/probe-transfer.mjs
 */
import { Retell } from 'retell-sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Retell({ apiKey: process.env.RETELL_API_KEY })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const res = await client.agent.list()
const list = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])

const { data: subs } = await db
  .from('agent_subscriptions')
  .select('client_domain, business_name, tier, retell_agent_id, owner_phone')
const byAgent = new Map((subs ?? []).map(s => [s.retell_agent_id, s]))

const mask = n => (n ? String(n).replace(/\d(?=\d{2})/g, '*') : null)

console.log(`\n${list.length} agents listed\n`)
let withTransfer = 0
const seen = new Set()
for (const s of list) {
  if (seen.has(s.agent_id)) continue
  seen.add(s.agent_id)
  const a = await client.agent.retrieve(s.agent_id)
  const re = a.response_engine
  const sub = byAgent.get(a.agent_id)
  let tools = []
  let llmNote = ''
  if (re?.type === 'retell-llm') {
    const llm = await client.llm.retrieve(re.llm_id, re.version != null ? { version: re.version } : undefined)
    tools = (llm.general_tools ?? []).filter(t => t.type === 'transfer_call')
    llmNote = `llm ${re.llm_id} v${re.version ?? '?'}`
  } else {
    llmNote = `response_engine ${re?.type}`
  }
  if (tools.length) withTransfer++
  console.log(`${a.agent_name}  (${a.agent_id})`)
  console.log(`   ${llmNote}   tier=${sub?.tier ?? '— no subscription row'}   owner_phone=${mask(sub?.owner_phone) ?? 'null'}`)
  if (!tools.length) console.log('   transfer: NONE')
  for (const t of tools) {
    const dest = t.transfer_destination
    console.log(`   transfer: ${t.name}  dest=${dest?.type}:${mask(dest?.number)}  option=${t.transfer_option?.type}`
      + `  ring=${t.transfer_option?.transfer_ring_duration_ms ?? '—'}ms`
      + `  handoff=${t.transfer_option?.private_handoff_option?.type ?? 'none'}`)
  }
}
console.log(`\n${withTransfer} of ${seen.size} agents carry a transfer_call tool\n`)

#!/usr/bin/env node
/**
 * Bring a client's Live Call Transfer tool in line with the tier they are paying for.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/retell/sync-transfer-tool.mjs --all
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/retell/sync-transfer-tool.mjs www.Example.com --apply
 *
 * Dry run by default; `--apply` writes. The resolver flag is required because the sync module
 * imports through the `@/` alias.
 *
 * This is the repair path named in the webhook's alert email. The webhook attaches the tool on an
 * upgrade automatically — this exists for the case it cannot finish on its own, which is almost
 * always "Elite, but no forwarding number on file yet". Put the number in
 * `agent_subscriptions.owner_phone`, then run this.
 *
 * The DECISION comes from the same `decideTransferTool` the webhook uses, so a dry run cannot
 * disagree with what applying would do. Only the write path differs.
 */

import { createClient } from '@supabase/supabase-js'
import { Retell } from 'retell-sdk'
import { decideTransferTool, TRANSFER_TOOL_NAME } from '../../lib/retell-transfer-tool.ts'
import { syncTransferToolForClient } from '../../lib/retell-transfer-sync.ts'

const APPLY = process.argv.includes('--apply')
const ALL   = process.argv.includes('--all')
const domainArg = process.argv.slice(2).find(a => !a.startsWith('--'))

if (!ALL && !domainArg) {
  console.error('Usage: sync-transfer-tool.mjs <client_domain>|--all [--apply]')
  process.exit(1)
}

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const query = db.from('agent_subscriptions').select('client_domain, tier, retell_agent_id, owner_phone')
const { data: rows, error } = ALL ? await query : await query.eq('client_domain', domainArg)

if (error) { console.error('✗ Could not read agent_subscriptions:', error.message); process.exit(1) }
if (!rows?.length) { console.error(`✗ No agent_subscriptions row for ${domainArg}`); process.exit(1) }

console.log(`\n369 · live call transfer — ${APPLY ? '🔴 APPLY' : '🟡 DRY RUN (add --apply to write)'}\n`)

let needApply = 0
let failures = 0

for (const row of rows) {
  // Read the agent's CURRENT state through its own response_engine — the same path the sync uses,
  // so the dry run reports what the agent actually resolves rather than what the row implies.
  let toolPresent = false
  let toolDestination = null
  let note = ''

  if (!row.retell_agent_id) {
    note = 'no Retell agent'
  } else {
    try {
      const agent = await retell.agent.retrieve(row.retell_agent_id)
      if (agent.response_engine?.type !== 'retell-llm') {
        note = `response_engine is ${agent.response_engine?.type}, not retell-llm`
      } else {
        const llm = await retell.llm.retrieve(agent.response_engine.llm_id)
        const tool = (llm.general_tools ?? []).find(t => t.name === TRANSFER_TOOL_NAME)
        toolPresent = Boolean(tool)
        toolDestination = tool?.transfer_destination?.number ?? null
        note = `llm ${agent.response_engine.llm_id} v${agent.response_engine.version ?? '?'}`
      }
    } catch (e) {
      note = `could not read agent: ${e.message}`
      failures++
    }
  }

  const decision = decideTransferTool({
    tier: row.tier,
    ownerPhone: row.owner_phone,
    toolPresent,
    toolDestination,
  })

  const mark = { attach: '＋', remove: '－', none: '·', blocked: '⚠' }[decision.action]
  console.log(`${mark} ${row.client_domain}`)
  console.log(`    tier=${row.tier ?? 'unset'}  owner_phone=${row.owner_phone ? 'on file' : 'MISSING'}  transfer_tool=${toolPresent ? `→ ${toolDestination}` : 'none'}  ${note}`)
  console.log(`    ${decision.action.toUpperCase()}: ${decision.reason}`)

  if (decision.action === 'blocked') failures++
  if (decision.action === 'attach' || decision.action === 'remove') {
    needApply++
    if (APPLY) {
      const result = await syncTransferToolForClient(row.client_domain)
      console.log(`    ${result.applied && result.verified ? '✅ applied and verified through the agent' : `❌ ${result.reason}`}`)
      if (!result.applied || !result.verified) failures++
    }
  }
  console.log('')
}

if (!APPLY && needApply > 0) {
  console.log(`${needApply} client(s) would change. Re-run with --apply.\n`)
} else if (!needApply) {
  console.log('Every client already matches their tier.\n')
}

process.exit(failures > 0 ? 1 : 0)

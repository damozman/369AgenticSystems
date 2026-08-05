/**
 * Set the LLM model for provisioning templates and live client agents.
 *
 *   node --env-file=.env.local scripts/retell/set-client-model.mjs              # dry run
 *   node --env-file=.env.local scripts/retell/set-client-model.mjs --apply
 *   node --env-file=.env.local scripts/retell/set-client-model.mjs --model claude-4.6-sonnet --apply
 *
 * The 2026-08-04 benchmark moved the shared demo line to claude-4.5-haiku on measured evidence —
 * Haiku's worst turn beat Sonnet's median — but it moved only that one LLM. Every vertical
 * template and the one real client agent stayed on Sonnet, and the first live booking call on
 * Northside opened with five consecutive ~10s turns as a result.
 *
 * Templates matter as much as live agents: lib/retell-provisioning.ts:50 CLONES the vertical
 * template's LLM for each new client, so whatever the template holds is what every future client
 * inherits. Changing live agents alone would fix today and silently regress tomorrow.
 *
 * Dry run by default. `--apply` writes.
 *
 * The verification at the end is the point. Updating an LLM is easy; what has cost this project
 * ten days is an agent that keeps pointing at an older version of it. So after writing, this
 * re-reads the model THROUGH each agent's own response_engine reference rather than trusting the
 * LLM read-back.
 */

import Retell from 'retell-sdk'
import { createClient } from '@supabase/supabase-js'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const arg = name => {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : (process.argv[i + 1] ?? true)
}

const MODEL = arg('--model') && arg('--model') !== true ? arg('--model') : 'claude-4.5-haiku'
const APPLY = process.argv.includes('--apply')

const client = new Retell({ apiKey })

// ── Collect targets ───────────────────────────────────────────────────────────

const targets = new Map() // agentId -> label

// 1. The nine provisioning templates. These decide what every FUTURE client gets.
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('RETELL_TEMPLATE_AGENT_') && value) {
    targets.set(value, `template · ${key.replace('RETELL_TEMPLATE_AGENT_', '').toLowerCase()}`)
  }
}

// 2. Every agent a real client is actually running on.
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: subs } = await db
    .from('agent_subscriptions')
    .select('client_domain, retell_agent_id')
    .not('retell_agent_id', 'is', null)

  for (const s of subs ?? []) targets.set(s.retell_agent_id, `client · ${s.client_domain}`)
} else {
  console.warn('⚠  No Supabase credentials — checking templates only, NOT live client agents.\n')
}

if (targets.size === 0) {
  console.error('✗ No target agents found. Are the RETELL_TEMPLATE_AGENT_* vars set?')
  process.exit(1)
}

// ── Resolve each agent to its LLM ─────────────────────────────────────────────

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — target model: ${MODEL}\n`)

const plan = []
for (const [agentId, label] of targets) {
  let agent
  try {
    agent = await client.agent.retrieve(agentId)
  } catch (e) {
    console.log(`  ✗ ${label.padEnd(34)} could not read agent ${agentId}: ${e.message}`)
    continue
  }

  const llmId = agent.response_engine?.llm_id
  if (!llmId) {
    console.log(`  · ${label.padEnd(34)} ${agent.agent_name} has no LLM response engine — skipped`)
    continue
  }

  const llm = await client.llm.retrieve(llmId)
  plan.push({ agentId, label, agentName: agent.agent_name, llmId, before: llm.model })
}

// Two agents can share one LLM (the demo line does). Writing it twice is harmless but the
// report would double-count, so collapse on llm_id for the write.
const byLlm = new Map()
for (const p of plan) if (!byLlm.has(p.llmId)) byLlm.set(p.llmId, p)

for (const p of plan) {
  const change = p.before === MODEL ? 'already correct' : `${p.before} -> ${MODEL}`
  console.log(`  ${p.before === MODEL ? '·' : '→'} ${p.label.padEnd(34)} ${String(p.agentName).slice(0, 34).padEnd(36)} ${change}`)
}

const toChange = [...byLlm.values()].filter(p => p.before !== MODEL)
console.log(`\n${toChange.length} LLM(s) need changing, ${byLlm.size - toChange.length} already correct.`)

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply.\n')
  process.exit(0)
}

// ── Write ─────────────────────────────────────────────────────────────────────

console.log('')
for (const p of toChange) {
  await client.llm.update(p.llmId, { model: MODEL })
  console.log(`  ✓ ${p.llmId}  ${p.before} -> ${MODEL}`)
}

// ── Verify THROUGH the agent, not the LLM ─────────────────────────────────────
// An LLM that reports the new model while the agent still resolves to an older version is
// exactly the failure that made the demo line answer calls and record none of them for ten days.

console.log('\nVerifying through each agent\'s own response_engine reference:\n')

let failures = 0
for (const p of plan) {
  const agent = await client.agent.retrieve(p.agentId)
  const ref = agent.response_engine
  const llm = await client.llm.retrieve(ref.llm_id)
  const ok = llm.model === MODEL
  if (!ok) failures++
  console.log(`  ${ok ? '✓' : '✗'} ${p.label.padEnd(34)} agent v${agent.version ?? '?'} -> llm ${ref.llm_id}${ref.version !== undefined && ref.version !== null ? ` v${ref.version}` : ''} = ${llm.model}`)
}

console.log('')
if (failures) {
  console.error(`✗ ${failures} agent(s) do NOT resolve to ${MODEL}. Check for a pinned response_engine version.`)
  process.exit(1)
}
console.log(`✓ Every target agent resolves to ${MODEL}.`)
console.log(`\nRevert with: --model claude-4.6-sonnet --apply\n`)

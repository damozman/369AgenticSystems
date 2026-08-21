/**
 * Set the LLM model for provisioning templates and live client agents.
 *
 *   node --env-file=.env.local scripts/retell/set-client-model.mjs              # dry run
 *   node --env-file=.env.local scripts/retell/set-client-model.mjs --apply
 *   node --env-file=.env.local scripts/retell/set-client-model.mjs --model claude-4.6-sonnet --apply
 *   node --env-file=.env.local scripts/retell/set-client-model.mjs --model gpt-5 --only <agentId> --apply
 *
 * Targets: the 9 provisioning templates, every live client agent, AND the shared demo line.
 * **The demo line was missing from this script until 2026-08-21** — it is neither a template nor a
 * subscription, so both lookups skipped it, and a fleet-wide model change would have left the one
 * agent real prospects actually call sitting on the old model. Added by id, as the two compliance
 * scripts already do.
 *
 * `--only <agentId>` narrows to a single agent. Use it to prove an unproven model on ONE test agent
 * (Northside) before moving anything that takes real traffic. The model string is validated against
 * Retell's supported set up front, so a typo fails before the first write rather than halfway
 * through and leaving the fleet split.
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
const ONLY  = arg('--only') && arg('--only') !== true ? arg('--only') : null

// Retell's own supported set, from the SDK's LlmResponse['model'] union. Checked here rather than
// discovered by an API rejection halfway through a multi-agent write, which would leave the fleet
// split across two models.
const SUPPORTED = new Set([
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.1', 'gpt-5.2',
  'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.5',
  'claude-4.5-sonnet', 'claude-4.6-sonnet', 'claude-5-sonnet', 'claude-4.5-haiku',
  'gemini-3.0-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash',
])
if (!SUPPORTED.has(MODEL)) {
  console.error(`✗ "${MODEL}" is not a model Retell accepts. One of:\n  ${[...SUPPORTED].join('\n  ')}`)
  process.exit(1)
}

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

// 3. The shared demo line. It is NEITHER a template NOR a subscription, so the two sources above
//    both miss it — the same gap that let the demo line answer calls and record none for ten days.
//    It is the number handed out at chamber events and it takes real prospect calls, so a model
//    migration that skipped it would leave the ONE agent prospects actually reach on the old model.
//    set-ai-disclosure.mjs and set-sms-consent.mjs already add it by id for exactly this reason.
targets.set('agent_c29218a34d116e3a2a56ba8827', 'demo · shared line')

// `--only <agentId>` narrows to a single agent, so a model can be proven on ONE test agent before
// the whole fleet moves. Without this the smallest possible change was "every template + every
// client at once", which is not a safe way to evaluate an unproven model.
if (ONLY) {
  const label = targets.get(ONLY)
  if (!label) {
    console.error(`✗ --only ${ONLY} is not one of the known targets:`)
    for (const [id, l] of targets) console.error(`    ${id}  ${l}`)
    process.exit(1)
  }
  for (const id of [...targets.keys()]) if (id !== ONLY) targets.delete(id)
  console.log(`⚠  --only: limiting to ${ONLY} (${label}). The rest of the fleet is untouched.\n`)
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

// The revert line is built from what was ACTUALLY replaced, not from a hardcoded model. It used to
// print `--model claude-4.6-sonnet --apply` unconditionally, which by 2026-08-21 was wrong twice
// over: the fleet had been on claude-4.5-haiku since the 2026-08-04 benchmark, so following it
// would have moved agents to Sonnet's 2399ms p50 — sitting on Retell's 3000ms cliff — and it
// dropped any --only, quietly widening a one-agent test into a fleet-wide write.
const priors = [...new Set(toChange.map(p => p.before))]
const onlyFlag = ONLY ? ` --only ${ONLY}` : ''
if (priors.length === 1) {
  console.log(`\nRevert with: --model ${priors[0]}${onlyFlag} --apply\n`)
} else {
  console.log(`\nRevert: these agents were NOT all on one model, so there is no single revert.`)
  for (const p of toChange) {
    console.log(`  --model ${p.before} --only ${p.agentId} --apply   # ${p.label}`)
  }
  console.log('')
}

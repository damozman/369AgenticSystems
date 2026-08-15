/**
 * Add the AI disclosure to every template and live client agent.
 *
 *   node --env-file=.env.local scripts/retell/set-ai-disclosure.mjs           # dry run
 *   node --env-file=.env.local scripts/retell/set-ai-disclosure.mjs --apply
 *
 * **Texas TRAIGA, in force since 2026-01-01**, requires an AI system interacting with consumers to
 * give "a clear and conspicuous disclosure in plain language… before or at the time of
 * interaction" — explicitly "regardless of whether it would be obvious to a reasonable consumer."
 * On 2026-08-15 the demo agent disclosed only *when asked*, and Northside — a real client's line —
 * had no disclosure anywhere in its prompt.
 *
 * Two changes per agent, because one without the other leaves a gap:
 *   1. `begin_message` — the proactive disclosure, before the caller has said anything.
 *   2. `general_prompt` — the backstop line for when a caller asks outright.
 *
 * Templates matter as much as live agents: lib/retell-provisioning.ts CLONES the vertical
 * template's LLM for each new client, so a template without the disclosure mints future clients
 * without it.
 *
 * Dry run by default. `--apply` writes.
 *
 * **This script never invents a greeting.** It rewrites the one that is there, and if it cannot
 * find the phrase it expects it reports and skips rather than guessing — a mangled greeting is
 * worse than an un-updated one, and it would be discovered by a customer.
 *
 * The verification at the end reads back THROUGH each agent's own response_engine, not through the
 * LLM object, for the reason set-client-model.mjs documents: an LLM that reports the new value
 * while the agent still resolves to an older version is what cost this project ten days.
 */

import Retell from 'retell-sdk'
import { createClient } from '@supabase/supabase-js'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const client = new Retell({ apiKey })

/**
 * "this is Ava" — not already followed by a disclosure, so re-running is a no-op rather than
 * producing "Ava, their AI assistant, their AI assistant".
 */
const AVA_RE = /\bthis is (Ava|Felix|Rex|Nova|Scout)\b(?!\s*,\s*(their|an|the)\s+AI)/i

/** Does the greeting name a business before the agent introduces herself? Decides "their" vs "an". */
const HAS_BUSINESS_RE = /calling\s+[^,.]{2,},\s*this is/i

const PROMPT_BACKSTOP =
  "- Asked whether you're AI: say yes, plainly and without apologising, then carry on helping."

/** Already covered if the prompt tells the agent what to do when asked. */
const PROMPT_HAS_DISCLOSURE_RE = /whether you'?re AI|are you (an? )?AI|you are an AI/i

function rewriteGreeting(text) {
  if (!text || !text.trim()) return { ok: false, reason: 'no begin_message — the agent opens from the prompt' }
  if (/\bAI\b/.test(text))   return { ok: true, unchanged: true, next: text }
  if (!AVA_RE.test(text))    return { ok: false, reason: 'could not find "this is <Agent>" to extend — needs a human' }

  const article = HAS_BUSINESS_RE.test(text) ? 'their' : 'an'
  return { ok: true, unchanged: false, next: text.replace(AVA_RE, (m, name) => `this is ${name}, ${article} AI assistant`) }
}

function rewritePrompt(text) {
  if (!text) return { changed: false, next: text }
  if (PROMPT_HAS_DISCLOSURE_RE.test(text)) return { changed: false, next: text }
  return { changed: true, next: `${text.trimEnd()}\n${PROMPT_BACKSTOP}\n` }
}

// ── Collect targets ───────────────────────────────────────────────────────────

const targets = new Map() // agentId -> label

for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('RETELL_TEMPLATE_AGENT_') && value) {
    targets.set(value, `template · ${key.replace('RETELL_TEMPLATE_AGENT_', '').toLowerCase()}`)
  }
}

/**
 * The shared demo line, by id — the same constant fix-demo-turn-quality.mjs uses.
 *
 * It is neither a provisioning template nor an `agent_subscriptions` row, so neither source here
 * would find it, and it takes real inbound calls from real prospects. That is exactly who the
 * disclosure exists for, so leaving it out would miss the highest-traffic agent in the account.
 */
targets.set('agent_c29218a34d116e3a2a56ba8827', 'demo · shared line')

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

// ── Plan ──────────────────────────────────────────────────────────────────────

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — adding AI disclosure to ${targets.size} agent(s)\n`)

const plan = []
const problems = []

for (const [agentId, label] of targets) {
  let agent
  try {
    agent = await client.agent.retrieve(agentId)
  } catch (e) {
    problems.push(`${label} — could not read agent ${agentId}: ${e.message}`)
    continue
  }

  const llmId = agent.response_engine?.llm_id
  if (!llmId) {
    problems.push(`${label} — ${agent.agent_name} has no LLM response engine`)
    continue
  }

  const llm = await client.llm.retrieve(llmId)
  const greeting = rewriteGreeting(llm.begin_message)
  const prompt   = rewritePrompt(llm.general_prompt)

  if (!greeting.ok) {
    problems.push(`${label} — ${greeting.reason}\n      current: ${JSON.stringify(llm.begin_message ?? null)}`)
    continue
  }

  plan.push({
    agentId, label, agentName: agent.agent_name, llmId,
    before: llm.begin_message, after: greeting.next,
    greetingChanged: !greeting.unchanged,
    promptChanged: prompt.changed, promptAfter: prompt.next,
  })
}

// Two agents can share one LLM. Collapse for the write so it is not sent twice.
const byLlm = new Map()
for (const p of plan) if (!byLlm.has(p.llmId)) byLlm.set(p.llmId, p)

for (const p of plan) {
  const marks = [p.greetingChanged && 'greeting', p.promptChanged && 'prompt'].filter(Boolean).join(' + ')
  console.log(`  ${marks ? '→' : '·'} ${p.label.padEnd(30)} ${String(p.agentName).slice(0, 30).padEnd(32)} ${marks || 'already discloses'}`)
  if (p.greetingChanged) {
    console.log(`      before: ${p.before}`)
    console.log(`      after : ${p.after}`)
  }
  if (p.promptChanged) console.log(`      prompt: + "${PROMPT_BACKSTOP}"`)
}

if (problems.length) {
  console.log('\n⚠  Needs a human — skipped, nothing written for these:')
  for (const p of problems) console.log(`    ✗ ${p}`)
}

const toChange = [...byLlm.values()].filter(p => p.greetingChanged || p.promptChanged)
console.log(`\n${toChange.length} LLM(s) need changing, ${byLlm.size - toChange.length} already disclose.`)

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply.\n')
  process.exit(problems.length ? 1 : 0)
}

// ── Write ─────────────────────────────────────────────────────────────────────

console.log('')
for (const p of toChange) {
  const patch = {}
  if (p.greetingChanged) patch.begin_message  = p.after
  if (p.promptChanged)   patch.general_prompt = p.promptAfter
  await client.llm.update(p.llmId, patch)
  console.log(`  ✓ ${p.llmId}  ${Object.keys(patch).join(' + ')}`)
}

// ── Verify THROUGH the agent, not the LLM ─────────────────────────────────────

console.log('\nVerifying through each agent\'s own response_engine reference:\n')

let failures = 0
for (const p of plan) {
  const agent = await client.agent.retrieve(p.agentId)
  const ref = agent.response_engine
  const llm = await client.llm.retrieve(ref.llm_id)

  const greetingOk = /\bAI\b/.test(llm.begin_message ?? '')
  const promptOk   = PROMPT_HAS_DISCLOSURE_RE.test(llm.general_prompt ?? '')
  const ok = greetingOk && promptOk
  if (!ok) failures++

  console.log(
    `  ${ok ? '✓' : '✗'} ${p.label.padEnd(30)} agent v${agent.version ?? '?'} -> llm ${ref.llm_id}` +
    `${ref.version !== undefined && ref.version !== null ? ` v${ref.version}` : ''}` +
    `  greeting:${greetingOk ? 'ok' : 'MISSING'} prompt:${promptOk ? 'ok' : 'MISSING'}`,
  )
}

console.log('')
if (failures) {
  console.error(`✗ ${failures} agent(s) do NOT disclose. Check for a pinned response_engine version.`)
  process.exit(1)
}
console.log('✓ Every target agent discloses, proactively and on request.\n')

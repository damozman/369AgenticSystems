/**
 * Teach every agent to ASK for SMS consent, and give it somewhere to put the answer.
 *
 *   node --env-file=.env.local scripts/retell/set-sms-consent.mjs           # dry run
 *   node --env-file=.env.local scripts/retell/set-sms-consent.mjs --apply
 *
 * A2P 10DLC campaigns are rejected on proof of opt-in more than on anything else, and a consumer
 * calling a business is not consent to text them. The opt-in has to be asked for out loud and
 * stored — /api/capture-lead writes it, lib/sms-consent.ts evaluates it, and sendSms refuses
 * without it. This is the half that makes the caller actually say yes.
 *
 * **The prompt and the tool schema are ONE contract.** Editing half of one broke this project
 * twice in a single day and corrupted real leads, so both move together here: the `sms_consent`
 * parameter is added to capture_lead in the same write as the prompt line telling Ava to ask.
 *
 * Dry run by default. Verification reads back through each agent's own response_engine, for the
 * reason set-client-model.mjs documents.
 */

import Retell from 'retell-sdk'
import { createClient } from '@supabase/supabase-js'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const client = new Retell({ apiKey })

const PARAM_NAME = 'sms_consent'
const PARAM_SPEC = {
  type: 'boolean',
  description:
    'True ONLY if the caller explicitly agreed to receive text messages when asked. Leave it out '
    + 'entirely if they declined or if you did not ask. Never infer consent from the fact that '
    + 'they called.',
}

const PROMPT_LINE =
  '- Before ending, ask once: "Is it alright if we text you updates about this?" Pass '
  + 'sms_consent=true to capture_lead only if they say yes. If they decline, do not ask again and '
  + 'do not mention it further.'

const PROMPT_MARKER = /sms_consent/i

// ── Targets: the same set the disclosure rollout uses ─────────────────────────
const targets = new Map()

for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('RETELL_TEMPLATE_AGENT_') && value) {
    targets.set(value, `template · ${key.replace('RETELL_TEMPLATE_AGENT_', '').toLowerCase()}`)
  }
}

// The shared demo line — neither a template nor a subscription, and it takes real calls.
targets.set('agent_c29218a34d116e3a2a56ba8827', 'demo · shared line')

if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: subs } = await db
    .from('agent_subscriptions')
    .select('client_domain, retell_agent_id')
    .not('retell_agent_id', 'is', null)
  for (const s of subs ?? []) targets.set(s.retell_agent_id, `client · ${s.client_domain}`)
} else {
  console.warn('⚠  No Supabase credentials — templates only, NOT live client agents.\n')
}

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — SMS consent across ${targets.size} agent(s)\n`)

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
  if (!llmId) { problems.push(`${label} — no LLM response engine`); continue }

  const llm   = await client.llm.retrieve(llmId)
  const tools = llm.general_tools ?? []
  const idx   = tools.findIndex(t => t.name === 'capture_lead')

  if (idx === -1) {
    // Refuse rather than invent a tool. A missing capture_lead means this agent is wired
    // differently and a human should look, not a script.
    problems.push(`${label} — no capture_lead tool to extend`)
    continue
  }

  const tool        = tools[idx]
  const props       = tool.parameters?.properties ?? {}
  const toolNeeds   = !(PARAM_NAME in props)
  const promptNeeds = !PROMPT_MARKER.test(llm.general_prompt ?? '')

  const nextTools = tools.map((t, i) => i !== idx ? t : ({
    ...t,
    parameters: {
      ...t.parameters,
      properties: { ...props, [PARAM_NAME]: PARAM_SPEC },
      // Deliberately NOT added to `required`. A caller who declines must still produce a valid
      // capture_lead call — making consent mandatory would either block the lead outright or push
      // the model to send a guessed `false`, and a guessed boolean is exactly what must never end
      // up in a consent record.
    },
  }))

  plan.push({
    agentId, label, llmId, agentName: agent.agent_name,
    toolNeeds, promptNeeds, nextTools,
    nextPrompt: promptNeeds
      ? `${(llm.general_prompt ?? '').trimEnd()}\n${PROMPT_LINE}\n`
      : llm.general_prompt,
  })
}

const byLlm = new Map()
for (const p of plan) if (!byLlm.has(p.llmId)) byLlm.set(p.llmId, p)

for (const p of plan) {
  const marks = [p.toolNeeds && 'tool param', p.promptNeeds && 'prompt line'].filter(Boolean).join(' + ')
  console.log(`  ${marks ? '→' : '·'} ${p.label.padEnd(30)} ${String(p.agentName).slice(0, 28).padEnd(30)} ${marks || 'already asks'}`)
}

if (problems.length) {
  console.log('\n⚠  Needs a human — skipped, nothing written:')
  for (const m of problems) console.log(`    ✗ ${m}`)
}

const toChange = [...byLlm.values()].filter(p => p.toolNeeds || p.promptNeeds)
console.log(`\n${toChange.length} LLM(s) need changing, ${byLlm.size - toChange.length} already ask.`)

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply.\n')
  console.log(`capture_lead gains:\n  ${PARAM_NAME} — ${PARAM_SPEC.description}\n`)
  console.log(`Prompt gains:\n  ${PROMPT_LINE}\n`)
  process.exit(problems.length ? 1 : 0)
}

console.log('')
for (const p of toChange) {
  // Both halves in ONE update. Split them and you get either a schema whose parameter is never
  // populated, or a prompt telling the model to pass an argument the tool will reject.
  await client.llm.update(p.llmId, { general_tools: p.nextTools, general_prompt: p.nextPrompt })
  console.log(`  ✓ ${p.llmId}  ${[p.toolNeeds && 'tool', p.promptNeeds && 'prompt'].filter(Boolean).join(' + ')}`)
}

console.log('\nVerifying through each agent\'s own response_engine reference:\n')

let failures = 0
for (const p of plan) {
  const agent = await client.agent.retrieve(p.agentId)
  const ref   = agent.response_engine
  const llm   = await client.llm.retrieve(ref.llm_id)
  const tool  = (llm.general_tools ?? []).find(t => t.name === 'capture_lead')

  const toolOk   = Boolean(tool?.parameters?.properties?.[PARAM_NAME])
  const promptOk = PROMPT_MARKER.test(llm.general_prompt ?? '')
  const ok = toolOk && promptOk
  if (!ok) failures++

  console.log(`  ${ok ? '✓' : '✗'} ${p.label.padEnd(30)} llm ${ref.llm_id} v${ref.version ?? '?'}  tool:${toolOk ? 'ok' : 'MISSING'} prompt:${promptOk ? 'ok' : 'MISSING'}`)
}

console.log('')
if (failures) {
  console.error(`✗ ${failures} agent(s) will not capture consent. Check for a pinned response_engine version.`)
  process.exit(1)
}
console.log('✓ Every agent asks for consent and can record the answer.\n')

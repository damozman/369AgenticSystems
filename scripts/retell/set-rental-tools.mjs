/**
 * Teach an agent to ask HOW LONG a rental unit is needed, and give it somewhere to put the answer.
 *
 *   node --env-file=.env.local scripts/retell/set-rental-tools.mjs           # dry run
 *   node --env-file=.env.local scripts/retell/set-rental-tools.mjs --apply
 *
 * The route already accepts `rental_days` on both check_availability and book_appointment, and
 * falls back to the item's own minimum when it is absent. So a hire works today — it simply
 * cannot be ASKED for. "Can I get it for five days?" currently books the minimum instead, which
 * is the kind of quiet wrongness that only shows up on an invoice.
 *
 * **Targets ONLY clients that actually stock rental items**, and deliberately not the nine
 * vertical templates. A roofer, an attorney and a plumber have no hires to quote, and a prompt
 * line about rental length is noise on a call it can never apply to — the same reason
 * describeChoices stopped reading 1,165 characters of chair names down the phone. A client is
 * included when they have at least one `client_inventory` row with `min_rental_days` set.
 *
 * The prompt and the tool schema move TOGETHER, in one update per LLM. They are one contract:
 * editing half of it has corrupted real leads twice in a single day. If the tool gains a
 * parameter the prompt never mentions, the model will not send it; if the prompt asks for
 * something the schema cannot carry, the model invents a place to put it.
 */

import Retell from 'retell-sdk'
import { createClient } from '@supabase/supabase-js'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const client = new Retell({ apiKey })

const PARAM_NAME = 'rental_days'
const PARAM_SPEC = {
  type: 'number',
  description:
    'How many days the caller wants to keep the item, when they have said. Whole days only. '
    + 'Leave it out entirely if they have not said or the item is not hired by the day — never '
    + 'guess a length, because the number of days is what the price is based on.',
}

const PROMPT_LINE =
  '- For items hired by the day, ask how many days they need it before checking availability, '
  + 'and pass rental_days. If they are unsure, offer the shortest hire rather than guessing. '
  + 'When you confirm, always say both the collection day and the day it is due back.'

const PROMPT_MARKER = /rental_days/i
const TOOLS = ['check_availability', 'book_appointment']

// ── Targets: clients with real rental stock, and nobody else ──────────────────
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Supabase credentials required — this script targets clients, not templates.')
  process.exit(1)
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: rentalRows, error: invErr } = await db
  .from('client_inventory')
  .select('client_domain, label, min_rental_days')
  .not('min_rental_days', 'is', null)
  .eq('active', true)

if (invErr) {
  // Fail rather than fall back to "no clients", which would look like a clean no-op run.
  console.error(`✗ Could not read client_inventory: ${invErr.message}`)
  if (/min_rental_days/.test(invErr.message)) {
    console.error('  Apply 2026-08-19-rental-windows.sql first.')
  }
  process.exit(1)
}

const rentalDomains = new Map()
for (const r of rentalRows ?? []) {
  if (!rentalDomains.has(r.client_domain)) rentalDomains.set(r.client_domain, [])
  rentalDomains.get(r.client_domain).push(`${r.label} (min ${r.min_rental_days}d)`)
}

if (rentalDomains.size === 0) {
  console.log('\n· No client stocks a by-the-day rental item yet — nothing to change.')
  console.log('  Set min_rental_days on a client_inventory row first, then re-run.\n')
  process.exit(0)
}

const targets = new Map()
const { data: subs } = await db
  .from('agent_subscriptions')
  .select('client_domain, retell_agent_id')
  .not('retell_agent_id', 'is', null)

for (const s of subs ?? []) {
  if (rentalDomains.has(s.client_domain)) targets.set(s.retell_agent_id, `client · ${s.client_domain}`)
}

const withoutAgent = [...rentalDomains.keys()].filter(
  d => !(subs ?? []).some(s => s.client_domain === d && s.retell_agent_id),
)

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — rental length across ${targets.size} agent(s)\n`)
for (const [domain, items] of rentalDomains) {
  console.log(`  ${domain}: ${items.join(', ')}`)
}
console.log()

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

  const llm = await client.llm.retrieve(llmId)
  const tools = llm.general_tools ?? []

  // Refuse rather than invent a tool. A missing booking tool means this agent is wired
  // differently and a human should look at it, not a script.
  const missing = TOOLS.filter(n => !tools.some(t => t.name === n))
  if (missing.length) { problems.push(`${label} — no ${missing.join(' / ')} tool to extend`); continue }

  const toolNeeds = TOOLS.filter(n => {
    const t = tools.find(x => x.name === n)
    return !(PARAM_NAME in (t.parameters?.properties ?? {}))
  })

  const nextTools = tools.map(t => !TOOLS.includes(t.name) ? t : ({
    ...t,
    parameters: {
      ...t.parameters,
      properties: { ...(t.parameters?.properties ?? {}), [PARAM_NAME]: PARAM_SPEC },
      // Deliberately NOT added to `required`. Most callers on a rental line are booking a
      // same-day item or have not said a length yet, and a required field pushes the model to
      // invent one — a guessed number of days is a guessed price.
    },
  }))

  const promptNeeds = !PROMPT_MARKER.test(llm.general_prompt ?? '')

  plan.push({
    agentId, label, llmId, agentName: agent.agent_name,
    toolNeeds, promptNeeds, nextTools,
    // Appended, which is how the two sibling scripts do it — but see the warning printed at the
    // end: anything after a client's BUSINESS_CONTEXT block is deleted by their next
    // questionnaire submit, so this must be re-run after one.
    nextPrompt: promptNeeds
      ? `${(llm.general_prompt ?? '').trimEnd()}\n${PROMPT_LINE}\n`
      : llm.general_prompt,
  })
}

// One update per LLM — two agents can share an LLM object and writing twice is wasted, not wrong.
const byLlm = new Map()
for (const p of plan) if (!byLlm.has(p.llmId)) byLlm.set(p.llmId, p)

for (const p of plan) {
  const marks = [p.toolNeeds.length && `tool param (${p.toolNeeds.join(', ')})`, p.promptNeeds && 'prompt line']
    .filter(Boolean).join(' + ')
  console.log(`  ${marks ? '→' : '·'} ${p.label.padEnd(34)} ${String(p.agentName).slice(0, 26).padEnd(28)} ${marks || 'already asks'}`)
}

if (problems.length) {
  console.log('\n⚠  Needs a human — skipped, nothing written:')
  for (const m of problems) console.log(`    ✗ ${m}`)
}
if (withoutAgent.length) {
  console.log('\n⚠  Stocks rentals but has no Retell agent yet:')
  for (const d of withoutAgent) console.log(`    · ${d}`)
}

const toChange = [...byLlm.values()].filter(p => p.toolNeeds.length || p.promptNeeds)
console.log(`\n${toChange.length} LLM(s) need changing, ${byLlm.size - toChange.length} already ask.`)

if (!APPLY) {
  if (toChange.length) {
    console.log(`\nTool gains, on ${TOOLS.join(' and ')}:`)
    console.log(`  ${PARAM_NAME} — ${PARAM_SPEC.description}\n`)
    console.log('Prompt gains:')
    console.log(`  ${PROMPT_LINE}\n`)
  }
  console.log('Dry run — nothing written. Re-run with --apply.')
  process.exit(0)
}

let written = 0
for (const p of toChange) {
  try {
    // Both halves in ONE update. They are a single contract; a partial write is the failure mode.
    await client.llm.update(p.llmId, { general_tools: p.nextTools, general_prompt: p.nextPrompt })
    written++
    console.log(`  ✓ ${p.label}`)
  } catch (e) {
    console.log(`  ✗ ${p.label} — ${e.message}`)
  }
}

// Verify through the CONSUMER's view rather than trusting the write's own return value — an LLM
// that reports the new value while the agent still resolves an older version is what made the
// demo line answer calls and record none for ten days.
console.log('\nRe-reading to confirm:')
let verified = 0
for (const p of toChange) {
  const llm = await client.llm.retrieve(p.llmId)
  const toolsOk = TOOLS.every(n => {
    const t = (llm.general_tools ?? []).find(x => x.name === n)
    return t && PARAM_NAME in (t.parameters?.properties ?? {})
  })
  const promptOk = PROMPT_MARKER.test(llm.general_prompt ?? '')
  if (toolsOk && promptOk) { verified++; console.log(`  ✓ ${p.label}`) }
  else console.log(`  ✗ ${p.label} — tools:${toolsOk ? 'ok' : 'MISSING'} prompt:${promptOk ? 'ok' : 'MISSING'}`)
}

console.log(`\n${written} written, ${verified}/${toChange.length} verified.`)
console.log(
  '\n⚠  Re-run this after any client re-submits the questionnaire. syncQuestionnaireToKB slices\n'
  + '   the prompt from BUSINESS_CONTEXT_START to the end, so a line appended after that block is\n'
  + '   silently deleted. Same trap that stripped Northside\'s SMS consent.\n',
)
process.exit(verified === toChange.length ? 0 : 1)

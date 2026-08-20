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

/**
 * BOTH parameters, because `item` is the one that was missing and it is the important one.
 *
 * `check_availability` shipped with **no parameters at all**, so Ava had no way to name a unit.
 * Per-item inventory has existed at the database and API layer since 2026-08-16 and was
 * unreachable by voice the whole time — every test called the API directly. A real call on
 * 2026-08-20 sent `{}`, `{"rental_days":1}` and `{"rental_days":3}`, got generic time slots, and
 * booked with `inventory_item_key: null` while telling the caller four items were reserved.
 */
const PARAM_SPECS = {
  item: {
    type: 'string',
    description:
      'The item the caller named, in their words. Send whenever they name one. Omit if they have '
      + 'not. Never choose between similar items yourself.',
  },
  rental_days: {
    type: 'number',
    description:
      'Whole days they want it, when they have said. Omit if unstated. Never guess — days set '
      + 'the price.',
  },
  booking_token: {
    type: 'string',
    description:
      'Copy exactly from the check_availability result for the slot they chose. Carries the item '
      + 'and dates. Never invent or edit one.',
  },
}

const BLOCK_START = '<!-- RENTAL_GUIDANCE_START -->'
const BLOCK_END = '<!-- RENTAL_GUIDANCE_END -->'

/**
 * Rewritten 2026-08-20 after listening to a real call.
 *
 * What went wrong was not that Ava was unhelpful — it was that she was TOO complete. She took a
 * four-item order, re-confirmed it three times, checked availability three times, and finished by
 * saying "you're all set" having reserved nothing: the booking stored one hour and no item. Five
 * minutes forty-one seconds, 32 LLM requests.
 *
 * So the job is deliberately narrowed. She answers availability per item (which is real, and is
 * what per-item inventory is FOR), captures the whole wishlist, and holds ONE delivery date. She
 * does not pretend to reserve a basket the schema cannot hold. A booking row carries a single
 * `inventory_item_key`; four items in one order is a modelling gap, not something a prompt can
 * paper over, and pretending otherwise is how a caller is told they have a bounce house they
 * do not have.
 */
const PROMPT_BLOCK = [
  BLOCK_START,
  '## Rentals',
  '- Always pass `item` to check_availability when they name something.',
  '- For day-hire items, ask how many days and pass `rental_days`. Say both the collection day and',
  '  the day it is due back.',
  '- If a name matches several items, ask which. Never choose.',
  '- When booking, pass the `booking_token` from the result for the slot they chose, copied exactly.',
  '',
  '## What you may promise',
  '- Take the whole list into `issue_description` on capture_lead.',
  '- You MUST call book_appointment once before the call ends, for the delivery date. Nothing is',
  '  held until you do.',
  '- Do not say the items are reserved or that they are "all set" — say the team will confirm and',
  '  send a quote.',
  '',
  '## Keep it moving',
  '- Confirm the order back once, at the end. Check each item once.',
  '- Ask once whether it is alright to text them. capture_lead requires sms_consent: "granted",',
  '  "declined", or "not_asked". Never send "granted" unless you asked and heard yes.',
  BLOCK_END,
].join('\n')

// A plain containment check. The marker is literal text; a regex here only invites escaping bugs.
const PROMPT_MARKER = { test: (t) => String(t ?? '').includes(BLOCK_START) }
const TOOLS = ['check_availability', 'book_appointment']

/**
 * Put the block BEFORE the questionnaire's context block, and replace any earlier copy.
 *
 * `syncQuestionnaireToKB` slices the prompt from `BUSINESS_CONTEXT_START` to the end, so anything
 * appended after it is silently deleted by the client's next questionnaire submit — the trap that
 * stripped Northside's SMS consent. Inserting ahead of that marker means this guidance survives.
 */
const CONTEXT_MARKER = '\n\n<!-- BUSINESS_CONTEXT_START -->'

function withRentalBlock(prompt) {
  let base = prompt ?? ''
  const s = base.indexOf(BLOCK_START)
  const e = base.indexOf(BLOCK_END)
  if (s !== -1 && e !== -1) base = (base.slice(0, s) + base.slice(e + BLOCK_END.length)).replace(/\n{3,}/g, '\n\n')

  const ctx = base.indexOf(CONTEXT_MARKER)
  if (ctx === -1) return `${base.trimEnd()}\n\n${PROMPT_BLOCK}\n`
  return `${base.slice(0, ctx).trimEnd()}\n\n${PROMPT_BLOCK}${base.slice(ctx)}`
}

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
    const props = t.parameters?.properties ?? {}
    return Object.keys(PARAM_SPECS).some(k => !(k in props))
  })

  /**
   * Build the extended schema.
   *
   * `check_availability` carries **no `parameters` object at all** on all 11 live agents — it is
   * a no-argument tool today. Spreading `...t.parameters` when it is undefined yields `{}`, which
   * would produce a schema with `properties` but **no `type: 'object'`**, shipping an invalid
   * tool definition to a live phone line. A malformed tool does not fail loudly: the model simply
   * stops being able to answer, which on a call is silence and a hang-up.
   *
   * `type` comes from the existing schema when there is one, so a tool that is somehow not an
   * object schema is not silently rewritten into one — it is rejected below instead.
   */
  const buildParams = (t) => {
    const existing = t.parameters ?? {}
    return {
      ...existing,
      type: existing.type ?? 'object',
      properties: { ...(existing.properties ?? {}), ...PARAM_SPECS },
      // Deliberately NOT added to `required`. Most callers on a rental line are booking a
      // same-day item or have not said a length yet, and a required field pushes the model to
      // invent one — a guessed number of days is a guessed price.
    }
  }

  const nextTools = tools.map(t => !TOOLS.includes(t.name) ? t : ({ ...t, parameters: buildParams(t) }))

  const malformed = nextTools
    .filter(t => TOOLS.includes(t.name))
    .filter(t => t.parameters?.type !== 'object' || typeof t.parameters?.properties !== 'object')
    .map(t => t.name)

  if (malformed.length) {
    problems.push(`${label} — would produce an invalid schema for ${malformed.join(', ')}; not written`)
    continue
  }

  // Compare against the rewritten prompt rather than just checking the marker exists, so
  // re-running after the block's wording changes updates it instead of reporting "already asks".
  const currentPrompt = llm.general_prompt ?? ''
  const rewritten = withRentalBlock(currentPrompt)
  const promptNeeds = rewritten !== currentPrompt

  plan.push({
    agentId, label, llmId, agentName: agent.agent_name,
    toolNeeds, promptNeeds, nextTools,
    // Inserted BEFORE the questionnaire's BUSINESS_CONTEXT block, not appended after it, so a
    // client re-submitting the questionnaire cannot silently delete this guidance the way it
    // deleted Northside's SMS consent line.
    nextPrompt: rewritten,
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
    for (const [k, v] of Object.entries(PARAM_SPECS)) console.log(`  ${k} — ${v.description}`)
    console.log()
    console.log('Prompt block (replaces any earlier copy, inserted before BUSINESS_CONTEXT):')
    console.log(PROMPT_BLOCK.split('\n').map(l => '  ' + l).join('\n'))
    console.log()

    // Print the schema that would actually be written for the tool that had none.
    // "It will be fine" is precisely what nearly shipped an invalid one.
    const sample = toChange[0]?.nextTools?.find(t => t.name === 'check_availability')
    if (sample) {
      console.log('Resulting check_availability schema (this tool had NO parameters before):')
      console.log(`  ${JSON.stringify(sample.parameters)}\n`)
    }
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
    const props = t?.parameters?.properties ?? {}
    return Boolean(t) && Object.keys(PARAM_SPECS).every(k => k in props)
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

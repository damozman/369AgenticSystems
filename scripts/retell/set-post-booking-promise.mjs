#!/usr/bin/env node
/**
 * Tell Ava what actually happens after a booking, and stop her promising a text.
 *
 *   node --env-file=.env.local scripts/retell/set-post-booking-promise.mjs           # dry run
 *   node --env-file=.env.local scripts/retell/set-post-booking-promise.mjs --apply
 *
 * Two problems, both seen on real calls 2026-08-21:
 *
 * 1. **Nobody told her what happens next, so she invented it.** Asked "so you booked it, but it's
 *    not paid for — what am I expecting?", she answered that the team would "reach out to handle
 *    the payment". Plausible, and nobody had defined it. Chris's process: the team verifies the
 *    request shortly and contacts them **by email or phone**, and they hear right away if
 *    anything needs to change.
 *
 * 2. **She promised a text.** "We'll text updates to 817-…" — on an account where all four Twilio
 *    env vars are missing and the A2P brand is unregistered. She cannot text anyone.
 *
 *    The existing "Is it alright if we text you updates?" line STAYS. Asking permission is
 *    deliberate and already shipped — consent is recorded with a timestamp so texting can be
 *    switched on later without re-consenting a soul. Asking is not promising. What is banned is
 *    stating that a text WILL be sent.
 *
 * Deliberately NOT said: anything about a payment page or a payment link. There is no
 * customer-facing payment page in the codebase — Stripe is wired for clients paying us, not for a
 * renter paying a deposit. Chris asked for the page to be mentioned, then agreed to hold it until
 * it exists. Add that sentence here when it does.
 *
 * Insertion is marker-aware. `mergePromptWithContext` slices from BUSINESS_CONTEXT_START to the
 * end of the prompt, so on a client agent that already has a context block this inserts BEFORE the
 * marker — appending after it would be silently deleted by their next questionnaire submit.
 *
 * Dry run by default. Verifies through each agent's own response_engine after writing.
 */
import Retell from 'retell-sdk'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const client = new Retell({ apiKey })

const MARKER = '\n\n<!-- BUSINESS_CONTEXT_START -->'
const BLOCK_START = '<!-- POST_BOOKING_START -->'
const BLOCK_END = '<!-- POST_BOOKING_END -->'

const BLOCK = `${BLOCK_START}
## What happens after you book
- Never say it is paid for, reserved, or "all set". Booking holds the time; a person still checks it.
- Say the team will verify the request shortly and get in touch to confirm — **by email, or by phone
  if that is easier for them.** If anything about the date or the item has to change, they hear as
  soon as possible.
- If they ask about paying, say the team sorts payment out when they confirm. Do not name an amount,
  a deposit, or a payment link — you have no pricing and there is no payment page to send them to.
- **Never say a text will be sent.** Asking once "is it alright if we text you updates about this?"
  is recording permission for later and is still right to ask. Texting is not switched on, so
  promising one is a promise nobody can keep.
${BLOCK_END}`

// The old, thinner version of the same instruction on the rental agent. Replaced rather than
// duplicated, so the two cannot drift into contradicting each other.
const SUPERSEDED = '- Do not say the items are reserved or that they are "all set" — say the team will confirm the details.'

const targets = new Map()
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('RETELL_TEMPLATE_AGENT_') && v) {
    targets.set(v, `template · ${k.replace('RETELL_TEMPLATE_AGENT_', '').toLowerCase()}`)
  }
}
targets.set('agent_c29218a34d116e3a2a56ba8827', 'demo · shared line')
targets.set('agent_d39a1b13cfd8fb2e3c9c12f06e', 'client · northside')

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'}\n`)

const plan = []
for (const [agentId, label] of targets) {
  const agent = await client.agent.retrieve(agentId)
  const llmId = agent.response_engine?.llm_id
  if (!llmId) continue
  const llm = await client.llm.retrieve(llmId)
  let base = llm.general_prompt ?? ''

  // Idempotent: strip any block we wrote before, so re-running replaces rather than stacks.
  const s = base.indexOf(BLOCK_START)
  const e = base.indexOf(BLOCK_END)
  if (s !== -1 && e !== -1) base = (base.slice(0, s) + base.slice(e + BLOCK_END.length)).replace(/\n{3,}/g, '\n\n')

  if (base.includes(SUPERSEDED)) base = base.replace(SUPERSEDED, '').replace(/\n{3,}/g, '\n\n')

  const ctx = base.indexOf(MARKER)
  const zone = ctx === -1 ? 'no context block — appended to base' : 'inserted BEFORE context marker'
  const next = ctx === -1
    ? `${base.trimEnd()}\n\n${BLOCK}\n`
    : `${base.slice(0, ctx).trimEnd()}\n\n${BLOCK}${base.slice(ctx)}`

  if (next !== (llm.general_prompt ?? '')) plan.push({ agentId, llmId, label, next, zone })
  else console.log(`  ·  ${label} — already current`)
}

if (!plan.length) { console.log('\n✓ Nothing to change.\n'); process.exit(0) }

for (const p of plan) console.log(`  → ${p.label.padEnd(26)} ${p.zone}`)

if (!APPLY) { console.log(`\nDry run — ${plan.length} LLM(s) would change. Re-run with --apply.\n`); process.exit(0) }

console.log('')
for (const p of plan) {
  await client.llm.update(p.llmId, { general_prompt: p.next })
  console.log(`  ✓ ${p.label}`)
}

console.log('\nVerifying through each agent\'s own response_engine:\n')
let failures = 0
for (const p of plan) {
  const agent = await client.agent.retrieve(p.agentId)
  const llm = await client.llm.retrieve(agent.response_engine.llm_id)
  const prompt = llm.general_prompt ?? ''
  const ok = prompt.includes(BLOCK_START) && prompt.includes('Never say a text will be sent')
  // The block must survive a questionnaire sync, which cuts from the marker to the end.
  const mi = prompt.indexOf('<!-- BUSINESS_CONTEXT_START -->')
  const safe = mi === -1 || prompt.indexOf(BLOCK_START) < mi
  console.log(`  ${ok && safe ? '✓' : '✗'} ${p.label}${ok && !safe ? '  ⚠ sits AFTER the context marker — would be stripped' : ''}`)
  if (!ok || !safe) failures++
}
if (failures) { console.error(`\n✗ ${failures} agent(s) not correctly updated.\n`); process.exit(1) }
console.log('\n✓ Every agent states the real post-booking process, and none promises a text.\n')

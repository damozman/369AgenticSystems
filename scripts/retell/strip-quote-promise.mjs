#!/usr/bin/env node
/**
 * Remove the promise to SEND A QUOTE from agent prompts.
 *
 *   node --env-file=.env.local scripts/retell/strip-quote-promise.mjs           # dry run
 *   node --env-file=.env.local scripts/retell/strip-quote-promise.mjs --apply
 *
 * Why: quoting is not built. `lib/twilio-sms.ts` sends only, there is no rate card, and
 * Text-to-Quote is explicitly a later phase. On a real call 2026-08-21 Ava closed with
 * "the team will confirm and send your quote shortly" — a promise nothing can keep, made to a
 * caller who then waits for a quote that never arrives. Chris's rule: advertise a promise only
 * when the system can keep it. He confirmed the same day that quoting is wanted eventually, but
 * "I don't think we're there yet" — so this removes the promise, not the ambition.
 *
 * Two of the three hits are TEMPLATES (insurance, wholesale), which
 * `lib/retell-provisioning.ts` clones for every new client — so the false promise would have been
 * inherited by every future insurance and wholesale client, not just the one live agent.
 *
 * NOT touched: insurance's "Handle quote requests, policy inquiries, claims reporting". Taking a
 * quote REQUEST is honest — the agency quotes, Ava captures the request. The lie is only in
 * claiming *we* send one.
 *
 * Edits are in-place string replacements inside the existing prompt, never appends. Anything
 * appended after a client's BUSINESS_CONTEXT_START marker is silently deleted by their next
 * questionnaire submit (`mergePromptWithContext` slices from the marker to the end), so this
 * reports where each match sits relative to that marker and refuses to rely on trailing content.
 *
 * Dry run by default. Verifies through each agent's own response_engine after writing.
 */
import Retell from 'retell-sdk'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const client = new Retell({ apiKey })
const MARKER = '<!-- BUSINESS_CONTEXT_START -->'

// Ordered: longest/most specific first, so a broader rule cannot eat a narrower one's text.
const REPLACEMENTS = [
  {
    from: 'Ask for an email address so we can send quotes and confirmations.',
    to:   'Ask for an email address so we can send confirmations.',
  },
  {
    from: 'Ask for an email so we can send quotes and follow-ups.',
    to:   'Ask for an email so we can send confirmations and follow-ups.',
  },
  {
    // Keeps the honest half — do not tell them it is reserved — and drops the quote.
    from: 'say the team will confirm and\n  send a quote.',
    to:   'say the team will confirm the details.',
  },
]

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
  const before = llm.general_prompt ?? ''

  let after = before
  const applied = []
  for (const r of REPLACEMENTS) {
    if (after.includes(r.from)) {
      // A replacement AFTER the marker lives inside the questionnaire-owned block and would be
      // regenerated from the questionnaire, not from here. Say so rather than silently "fixing" it.
      const markerIdx = after.indexOf(MARKER)
      const hitIdx = after.indexOf(r.from)
      const zone = markerIdx !== -1 && hitIdx > markerIdx ? 'AFTER marker (questionnaire-owned!)' : 'base prompt'
      applied.push(`${r.from.slice(0, 46).replace(/\n/g, ' ')}…  [${zone}]`)
      after = after.split(r.from).join(r.to)
    }
  }

  const stillClaims = /\bsend\b[^.\n]{0,40}\bquot/i.test(after)
  if (applied.length || stillClaims) {
    plan.push({ agentId, llmId, label, before, after, applied, stillClaims })
  }
}

if (!plan.length) { console.log('✓ No agent promises to send a quote. Nothing to do.\n'); process.exit(0) }

for (const p of plan) {
  console.log(`  ${p.applied.length ? '→' : '·'} ${p.label}`)
  for (const a of p.applied) console.log(`      - ${a}`)
  if (p.stillClaims) console.log('      ⚠  STILL claims to send a quote after replacement — read the prompt by hand.')
}

const toWrite = plan.filter(p => p.applied.length && p.before !== p.after)
if (!APPLY) { console.log(`\nDry run — ${toWrite.length} LLM(s) would change. Re-run with --apply.\n`); process.exit(0) }

console.log('')
for (const p of toWrite) {
  await client.llm.update(p.llmId, { general_prompt: p.after })
  console.log(`  ✓ ${p.label}`)
}

// Verify through the AGENT's own reference, not the LLM read-back: an LLM reporting the new text
// while the agent still resolves to an older version is this repo's most expensive recurring bug.
console.log('\nVerifying through each agent\'s own response_engine:\n')
let failures = 0
for (const p of toWrite) {
  const agent = await client.agent.retrieve(p.agentId)
  const llm = await client.llm.retrieve(agent.response_engine.llm_id)
  const clean = !/\bsend\b[^.\n]{0,40}\bquot/i.test(llm.general_prompt ?? '')
  console.log(`  ${clean ? '✓' : '✗'} ${p.label}`)
  if (!clean) failures++
}
if (failures) { console.error(`\n✗ ${failures} agent(s) still promise a quote.\n`); process.exit(1) }
console.log('\n✓ No agent promises to send a quote.\n')

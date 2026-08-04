#!/usr/bin/env node
/**
 * Two fixes to the demo line, both found by reading a real call's transcript and latency values
 * rather than by guessing (call_1c50a8feab879d320c3b4073fdf, 2026-08-04).
 *
 * 1. `capture_lead` listed `caller_address` in its `required` array. The prompt was rewritten
 *    earlier the same day to stop collecting an address, but a required tool parameter outranks
 *    prose — so Ava still hunted for one ("do you have an address I can put on file, Chris?" →
 *    "Uh, not right now"), costing a full exchange on every call. Address stays as an optional
 *    property; it is simply no longer demanded.
 *
 * 2. `interruption_sensitivity` was 0.9, high enough that Ava's own sentences were being cut in
 *    half and resumed as separate turns. From the transcript:
 *        agent: "Thanks for calling, this is Ava. How can I"
 *        user:  "Hey, Eva."
 *        agent: "help you today?"
 *    That reads as lag to the caller even when the model is quick, and each resumed fragment is
 *    another turn. 0.5 still lets a caller talk over her; it stops room noise doing it.
 *
 * NEITHER of these will move LLM p50 — they fix call length and choppiness, not model speed.
 * Measured LLM latency on that call was 5137ms on the first turn settling to 1379ms by the
 * tenth; the model warming up is a separate problem, deliberately left alone so this stays a
 * single-variable change.
 *
 * DRY-RUN BY DEFAULT. Add --apply to write.
 *   node --env-file=.env.local scripts/retell/fix-demo-turn-quality.mjs
 *   node --env-file=.env.local scripts/retell/fix-demo-turn-quality.mjs --apply
 *
 * Rollback: interruption_sensitivity 0.9; capture_lead required
 *   ["caller_name","caller_phone","caller_address","caller_email","issue_description","vertical"]
 */
import { Retell } from 'retell-sdk'

const APPLY  = process.argv.includes('--apply')
const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const client = new Retell({ apiKey })
const DEMO_AGENT = 'agent_c29218a34d116e3a2a56ba8827'
const DEMO_LLM   = 'llm_a7acd10debcb797a013eb8378d20'
const NEW_INTERRUPTION = 0.5

console.log(`\n${APPLY ? '🔴 APPLY MODE — writing changes' : '🟡 DRY RUN — no changes written (add --apply)'}\n`)

// ── 1. capture_lead: stop requiring an address ────────────────────────────────
const llm = await client.llm.retrieve(DEMO_LLM)
const tools = llm.general_tools || []
const lead = tools.find(t => t.name === 'capture_lead')

if (!lead) {
  console.error('✗ ABORT: capture_lead not found on this LLM — nothing safe to edit.')
  process.exit(1)
}

const before = lead.parameters?.required ?? []
const after = before.filter(p => p !== 'caller_address')

console.log(`LLM ${DEMO_LLM}  tool "capture_lead"`)
console.log(`   required : ${JSON.stringify(before)}`)
console.log(`            → ${JSON.stringify(after)}`)

// The property itself stays — Ava should still record an address when a caller volunteers one,
// which matters for the trades. She just must not interrogate for it.
const keptProperty = Object.keys(lead.parameters?.properties ?? {}).includes('caller_address')
console.log(`   caller_address still an optional property: ${keptProperty}`)

if (before.length === after.length) {
  console.log('   (already not required — nothing to do)')
}

const nextTools = tools.map(t =>
  t.name === 'capture_lead'
    ? { ...t, parameters: { ...t.parameters, required: after } }
    : t,
)

// ── 2. agent: stop chopping her own sentences ─────────────────────────────────
const agent = await client.agent.retrieve(DEMO_AGENT)
console.log(`\nAGENT ${DEMO_AGENT}`)
console.log(`   interruption_sensitivity : ${agent.interruption_sensitivity} → ${NEW_INTERRUPTION}`)

if (APPLY) {
  if (before.length !== after.length) {
    await client.llm.update(DEMO_LLM, { general_tools: nextTools })
    console.log(`\n✅ capture_lead updated`)
  }
  await client.agent.update(DEMO_AGENT, { interruption_sensitivity: NEW_INTERRUPTION })
  console.log(`✅ agent updated`)
  console.log('\nNEXT:')
  console.log('  1. Place a call.')
  console.log('  2. node --env-file=.env.local scripts/retell/call-latency.mjs 3')
  console.log('     Expect: fewer turns, whole sentences. LLM p50 should NOT be expected to move.')
} else {
  console.log('\nRe-run with --apply to write these changes.')
}
console.log('')

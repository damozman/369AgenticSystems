#!/usr/bin/env node
/**
 * Give `capture_lead`'s `vertical` parameter a truthful escape.
 *
 *   node --env-file=.env.local scripts/retell/add-vertical-escape.mjs           # dry run
 *   node --env-file=.env.local scripts/retell/add-vertical-escape.mjs --apply
 *
 * The bug: `vertical` is a REQUIRED enum of exactly the nine original verticals. Northside is an
 * event-rental business, which is not one of them, so on every single call the model was cornered
 * into picking a wrong answer — it chose "wholesale" on three consecutive calls, and every lead it
 * captured was filed under a business type that has nothing to do with bounce houses.
 *
 * This is the same defect as Nova's roofing fallback (CLAUDE.md open item 11) and the exact lesson
 * this repo already paid for twice: **required with a truthful escape.** `sms_consent` got
 * `not_asked`, `booking_token` got `"none"`, and both stopped being invented the moment the model
 * had an honest option. `vertical` never got one, so it kept guessing.
 *
 * The fix is the escape, not a longer description. Firmer wording failed twice before; a model
 * with no true option available will always produce a false one.
 *
 * `/api/capture-lead` already stores null for anything outside VALID_VERTICALS, so "other" needs
 * no route change — it lands as null, which is the honest value. A null vertical is also what the
 * pilot needs: she will be provisioned under one of the nine for billing reasons while genuinely
 * being none of them.
 *
 * Dry run by default. Verifies through each agent's own response_engine after writing.
 */
import Retell from 'retell-sdk'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const client = new Retell({ apiKey })

const ESCAPE = 'other'
const ESCAPE_NOTE = ' Send "other" when the business is not one of the listed types — never force the '
  + 'closest match, because a wrong type mislabels the lead and nothing downstream can tell.'

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

  const tools = llm.general_tools ?? []
  const idx = tools.findIndex(t => t.name === 'capture_lead')
  if (idx === -1) { console.log(`  ·  ${label} — no capture_lead`); continue }

  const tool = tools[idx]
  const prop = tool.parameters?.properties?.vertical
  if (!prop || !Array.isArray(prop.enum)) { console.log(`  ⚠  ${label} — vertical has no enum, skipping`); continue }
  if (prop.enum.includes(ESCAPE)) { console.log(`  ·  ${label} — already has "${ESCAPE}"`); continue }

  const nextTool = {
    ...tool,
    parameters: {
      ...tool.parameters,
      properties: {
        ...tool.parameters.properties,
        vertical: {
          ...prop,
          enum: [...prop.enum, ESCAPE],
          description: (prop.description ?? '').trimEnd() + ESCAPE_NOTE,
        },
      },
    },
  }

  const nextTools = [...tools]
  nextTools[idx] = nextTool
  plan.push({ agentId, llmId, label, nextTools, before: prop.enum.length })
}

if (!plan.length) { console.log('\n✓ Nothing to change.\n'); process.exit(0) }

for (const p of plan) console.log(`  → ${p.label.padEnd(26)} vertical enum ${p.before} -> ${p.before + 1} values`)

if (!APPLY) { console.log(`\nDry run — ${plan.length} LLM(s) would change. Re-run with --apply.\n`); process.exit(0) }

console.log('')
for (const p of plan) {
  await client.llm.update(p.llmId, { general_tools: p.nextTools })
  console.log(`  ✓ ${p.label}`)
}

console.log('\nVerifying through each agent\'s own response_engine:\n')
let failures = 0
for (const p of plan) {
  const agent = await client.agent.retrieve(p.agentId)
  const llm = await client.llm.retrieve(agent.response_engine.llm_id)
  const t = (llm.general_tools ?? []).find(x => x.name === 'capture_lead')
  const ok = t?.parameters?.properties?.vertical?.enum?.includes(ESCAPE)
  console.log(`  ${ok ? '✓' : '✗'} ${p.label}`)
  if (!ok) failures++
}
if (failures) { console.error(`\n✗ ${failures} agent(s) still have no escape.\n`); process.exit(1) }
console.log(`\n✓ Every capture_lead can answer "${ESCAPE}".\n`)

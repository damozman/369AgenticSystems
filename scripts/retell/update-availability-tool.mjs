#!/usr/bin/env node
/**
 * Repoints the availability tool on every Retell LLM at the real /api/available-slots.
 *
 * The tool is currently called `Calendar_for_Demo`, is a GET taking no arguments, and carries no
 * `?secret=`. The route behind it now needs to know which client is asking — it reads that
 * client's working hours and their booked appointments — so the tool becomes a POST (Retell
 * includes the call envelope, and therefore call_id, on POST custom tools; this is the same
 * mechanism book_appointment already relies on in production) and gets the shared secret.
 *
 * DRY-RUN BY DEFAULT — prints planned changes, writes nothing.
 * Add --apply to actually write. Idempotent: an already-migrated tool is skipped.
 *
 * Dry run:  node --env-file=.env.local scripts/retell/update-availability-tool.mjs
 * Apply:    node --env-file=.env.local scripts/retell/update-availability-tool.mjs --apply
 *
 * Afterwards, ALWAYS run scripts/retell/recon.mjs to confirm, and place a real call. Updating an
 * LLM is not proof the live phone number uses it — a number pinned to a stale agent version is
 * exactly what caused the ten-day call outage.
 *
 * Requires BOTH env vars in .env.local: RETELL_API_KEY, RETELL_WEBHOOK_SECRET.
 */
import { Retell } from 'retell-sdk'

const APPLY  = process.argv.includes('--apply')
const apiKey = process.env.RETELL_API_KEY
const secret = process.env.RETELL_WEBHOOK_SECRET

if (!apiKey) { console.error('✗ RETELL_API_KEY not set in .env.local'); process.exit(1) }
if (!secret) { console.error('✗ RETELL_WEBHOOK_SECRET not set in .env.local'); process.exit(1) }

const client = new Retell({ apiKey })

const SLOTS_PATH = '/api/available-slots'
const NEW_NAME   = 'check_availability'

const NEW_DESCRIPTION =
  'Call this when the caller wants to schedule, to get the times this business can actually ' +
  'take an appointment. Returns real open slots only — anything already booked is excluded. ' +
  'Offer the caller at most two of them at a time. If it returns no slots, the schedule is ' +
  'full: say so, take a message, and do not invent a time.'

/** Identify the availability tool by the route it points at, not by its name — the name is what changes. */
const isAvailabilityTool = t => t?.type === 'custom' && typeof t.url === 'string' && t.url.includes(SLOTS_PATH)

function withSecret(url) {
  if (/[?&]secret=/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}secret=${encodeURIComponent(secret)}`
}

function migrate(tool) {
  const url = withSecret(tool.url)
  const alreadyDone = tool.name === NEW_NAME && tool.method === 'POST' && url === tool.url
  if (alreadyDone) return null

  return {
    ...tool,
    name: NEW_NAME,
    method: 'POST',
    url,
    description: NEW_DESCRIPTION,
    // Left exactly as-is: `suggested` is still a field on the response, so whatever prompt text
    // references this variable keeps working. Changing it would be a silent prompt break.
    response_variables: tool.response_variables,
  }
}

console.log(`\n${APPLY ? '🔴 APPLY MODE — writing changes' : '🟡 DRY RUN — no changes will be written (add --apply to write)'}\n`)

// Collect LLM ids via agents, so an orphaned LLM no agent uses is not touched.
const res = await client.agent.list()
const summaries = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])

const llmIds = new Set()
for (const s of summaries) {
  try {
    const agent = await client.agent.retrieve(s.agent_id)
    if (agent.response_engine?.type === 'retell-llm' && agent.response_engine.llm_id) {
      llmIds.add(agent.response_engine.llm_id)
    }
  } catch (e) {
    console.log(`✗ retrieve agent ${s.agent_id}: ${e.message}`)
  }
}

let planned = 0, applied = 0, failed = 0, skipped = 0

for (const llmId of llmIds) {
  let llm
  try { llm = await client.llm.retrieve(llmId) }
  catch (e) { console.log(`✗ retrieve llm ${llmId}: ${e.message}`); failed++; continue }

  const tools = llm.general_tools || []
  if (!tools.some(isAvailabilityTool)) {
    console.log(`LLM ${llmId}  — no availability tool, skipped`)
    skipped++
    continue
  }

  let changed = false
  const nextTools = tools.map(t => {
    if (!isAvailabilityTool(t)) return t
    const next = migrate(t)
    if (!next) { console.log(`LLM ${llmId}  tool "${t.name}" — already migrated, skipped`); skipped++; return t }
    changed = true
    planned++
    console.log(`LLM ${llmId}`)
    console.log(`   name   : ${t.name}  →  ${next.name}`)
    console.log(`   method : ${t.method}  →  ${next.method}`)
    console.log(`   url    : ${next.url.replace(/secret=[^&]+/, 'secret=***')}`)
    return next
  })

  if (changed && APPLY) {
    try {
      await client.llm.update(llmId, { general_tools: nextTools })
      applied++
      console.log(`   ✅ llm ${llmId} updated`)
    } catch (e) {
      failed++
      console.log(`   ✗ llm update failed: ${e.message}`)
    }
  }
}

console.log(`\n================  ${APPLY ? 'APPLIED' : 'DRY RUN'}  ================`)
console.log(`Tools to change: ${planned}   already-done/skipped: ${skipped}`)
if (APPLY) {
  console.log(`LLM writes succeeded: ${applied}   failed: ${failed}`)
  console.log('\nNEXT, and do not skip these:')
  console.log('  1. node --env-file=.env.local scripts/retell/recon.mjs')
  console.log('  2. Place a real call to the demo line and confirm the offered times are real.')
  console.log('  3. Confirm the live number\'s agent version actually serves the new tool.')
} else {
  console.log('Re-run with --apply to write these changes.')
}
console.log('')

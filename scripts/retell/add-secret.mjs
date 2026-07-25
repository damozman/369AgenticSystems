#!/usr/bin/env node
/**
 * Appends `?secret=<RETELL_WEBHOOK_SECRET>` to every Retell webhook + guarded
 * custom-tool URL (call-received / capture-lead / book-appointment), across all
 * agents and their LLMs, so RETELL_WEBHOOK_SECRET can be armed without 401-ing
 * live calls.
 *
 * DRY-RUN BY DEFAULT — prints planned changes, writes nothing.
 * Add --apply to actually write. Idempotent: skips URLs that already have secret.
 *
 * Dry run:  node --env-file=.env.local scripts/retell/add-secret.mjs
 * Apply:    node --env-file=.env.local scripts/retell/add-secret.mjs --apply
 *
 * Requires BOTH env vars in .env.local: RETELL_API_KEY, RETELL_WEBHOOK_SECRET.
 */
import { Retell } from 'retell-sdk'

const APPLY = process.argv.includes('--apply')
const apiKey = process.env.RETELL_API_KEY
const secret = process.env.RETELL_WEBHOOK_SECRET

if (!apiKey)  { console.error('✗ RETELL_API_KEY not set in .env.local'); process.exit(1) }
if (!secret)  { console.error('✗ RETELL_WEBHOOK_SECRET not set in .env.local (add it, then re-run)'); process.exit(1) }

const client = new Retell({ apiKey })
const TARGET = /\/api\/(call-received|capture-lead|book-appointment)\b/

// Append ?secret= (or &secret=) only to guarded URLs that don't already have it.
function withSecret(url) {
  if (!url || !TARGET.test(url)) return null            // not a guarded URL — leave alone
  if (/[?&]secret=/.test(url))   return null            // already has it — skip (idempotent)
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}secret=${encodeURIComponent(secret)}`
}

console.log(`\n${APPLY ? '🔴 APPLY MODE — writing changes' : '🟡 DRY RUN — no changes will be written (add --apply to write)'}\n`)

// ── Gather agents (list returns summaries under .items; retrieve for detail) ──
let summaries = []
const res = await client.agent.list()
summaries = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])

let planned = 0, applied = 0, failed = 0

// ── Agent webhook_url ─────────────────────────────────────────────────────────
const llmIds = new Set()
for (const s of summaries) {
  let agent
  try { agent = await client.agent.retrieve(s.agent_id) }
  catch (e) { console.log(`✗ retrieve agent ${s.agent_id}: ${e.message}`); failed++; continue }

  if (agent.response_engine?.type === 'retell-llm' && agent.response_engine.llm_id) {
    llmIds.add(agent.response_engine.llm_id)
  }

  const next = withSecret(agent.webhook_url)
  if (!next) continue
  planned++
  console.log(`AGENT ${agent.agent_id} "${agent.agent_name}"`)
  console.log(`   webhook_url → ${next}`)
  if (APPLY) {
    try { await client.agent.update(agent.agent_id, { webhook_url: next }); applied++; console.log('   ✅ updated') }
    catch (e) { failed++; console.log(`   ✗ update failed: ${e.message}`) }
  }
}

// ── LLM custom-tool URLs ──────────────────────────────────────────────────────
for (const llmId of llmIds) {
  let llm
  try { llm = await client.llm.retrieve(llmId) }
  catch (e) { console.log(`✗ retrieve llm ${llmId}: ${e.message}`); failed++; continue }

  const tools = llm.general_tools || []
  let changedTool = false
  const nextTools = tools.map(t => {
    const next = t?.type === 'custom' ? withSecret(t.url) : null
    if (!next) return t
    changedTool = true
    planned++
    console.log(`LLM ${llmId}  tool "${t.name}"`)
    console.log(`   url → ${next}`)
    return { ...t, url: next }
  })

  if (changedTool && APPLY) {
    try { await client.llm.update(llmId, { general_tools: nextTools }); applied++; console.log(`   ✅ llm ${llmId} updated`) }
    catch (e) { failed++; console.log(`   ✗ llm update failed: ${e.message}`) }
  }
}

console.log(`\n================  ${APPLY ? 'APPLIED' : 'DRY RUN'}  ================`)
console.log(`URLs to change: ${planned}`)
if (APPLY) console.log(`Write operations succeeded: ${applied}   failed: ${failed}`)
else       console.log(`Re-run with --apply to write these changes.`)
console.log('')

#!/usr/bin/env node
/**
 * READ-ONLY. Maps every Retell agent + its LLM's custom tools, and flags which
 * webhook / capture-lead / book-appointment URLs still need `?secret=` before
 * RETELL_WEBHOOK_SECRET can be safely armed.
 *
 * Run:  node --env-file=.env.local scripts/retell/recon.mjs
 * (Reads RETELL_API_KEY from .env.local. Makes NO changes.)
 */
import { Retell } from 'retell-sdk'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) {
  console.error('✗ RETELL_API_KEY not set. Run: node --env-file=.env.local scripts/retell/recon.mjs')
  process.exit(1)
}
const client = new Retell({ apiKey })

// URLs our shared-secret gate protects.
const TARGET = /\/api\/(call-received|capture-lead|book-appointment)\b/

function flag(url) {
  if (!url || !TARGET.test(url)) return ''
  return /[?&]secret=/.test(url) ? '   ✅ has ?secret=' : '   ⚠️  NEEDS ?secret='
}

let summaries = []
try {
  const res = await client.agent.list()
  // Observed shape: { items: [...] }. Be defensive about array / {data} too.
  summaries = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])
} catch (e) {
  console.error('✗ agent.list failed:', e.message)
  process.exit(1)
}
if (summaries.length === 0) {
  console.error('No agents returned (unexpected).')
  process.exit(1)
}

// The list endpoint returns summaries without webhook_url/response_engine details,
// so retrieve each agent for the full config.
const agents = []
for (const s of summaries) {
  try {
    agents.push(await client.agent.retrieve(s.agent_id))
  } catch (e) {
    console.log(`   (retrieve failed for ${s.agent_id}: ${e.message})`)
  }
}

let needs = 0
const llmIds = new Set()

console.log(`\n================  ${agents.length} AGENTS  ================\n`)
for (const a of agents) {
  console.log(`AGENT  ${a.agent_id}   "${a.agent_name}"`)
  const wh = a.webhook_url
  const whFlag = flag(wh)
  if (whFlag.includes('NEEDS')) needs++
  console.log(`   webhook_url: ${wh || '(none)'}${whFlag}`)
  const re = a.response_engine
  if (re?.type === 'retell-llm' && re.llm_id) {
    console.log(`   llm: ${re.llm_id}`)
    llmIds.add(re.llm_id)
  } else {
    console.log(`   response_engine: ${re?.type ?? '(unknown)'}`)
  }
  console.log('')
}

console.log(`\n================  ${llmIds.size} UNIQUE LLMs — custom tool URLs  ================\n`)
for (const llmId of llmIds) {
  let llm
  try {
    llm = await client.llm.retrieve(llmId)
  } catch (e) {
    console.log(`LLM ${llmId}: retrieve failed — ${e.message}\n`)
    continue
  }
  const tools = (llm.general_tools || []).filter((t) => t?.type === 'custom' && t?.url)
  console.log(`LLM ${llmId}   (${tools.length} custom tool URL${tools.length === 1 ? '' : 's'})`)
  for (const t of tools) {
    const f = flag(t.url)
    if (f.includes('NEEDS')) needs++
    console.log(`   ${t.name}: ${t.url}${f}`)
  }
  console.log('')
}

console.log(`\n================  SUMMARY  ================`)
console.log(`URLs still needing ?secret=: ${needs}`)
console.log(needs === 0
  ? '✅ Everything is already gated — safe to set RETELL_WEBHOOK_SECRET in Vercel.'
  : '⚠️  Run the mutation script (dry-run first) before arming, or those calls will 401.')
console.log('')

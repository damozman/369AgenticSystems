/**
 * Read the most recent call(s) on Northside and report what actually happened:
 * latency spread (not just the median), which tools fired and with what arguments,
 * disconnect reason, and the public log URL.
 *
 * Read-only. Buys nothing, writes nothing.
 */
import Retell from 'retell-sdk'

const client = new Retell({ apiKey: process.env.RETELL_API_KEY })
const AGENT = 'agent_d39a1b13cfd8fb2e3c9c12f06e'
const N = Number(process.argv[2] ?? 2)

const res = await client.call.list({
  filter_criteria: { agent_id: [AGENT] },
  sort_order: 'descending',
  limit: N,
})
const summaries = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])

if (!summaries.length) { console.log('No calls found for Northside.'); process.exit(0) }

// `list` returns SUMMARIES — no transcript, no transcript_with_tool_calls. Reading tool calls off
// the summary reports zero for every call, which looks exactly like "the model never called a
// tool" and is the wrong conclusion. Retrieve each call for the full object.
const calls = []
for (const s of summaries) calls.push(await client.call.retrieve(s.call_id))

const pct = (arr, p) => {
  if (!arr?.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))])
}

for (const c of calls) {
  const started = c.start_timestamp ? new Date(c.start_timestamp).toISOString() : '?'
  console.log('='.repeat(78))
  console.log(`call ${c.call_id}`)
  console.log(`  started        ${started}`)
  console.log(`  duration       ${c.duration_ms ? (c.duration_ms / 1000).toFixed(1) + 's' : '?'}`)
  console.log(`  status         ${c.call_status}`)
  console.log(`  disconnect     ${c.disconnection_reason ?? '—'}`)
  console.log(`  log            ${c.public_log_url ?? '—'}`)

  // Latency: read the SPREAD, not the median. A p50 inside budget with a tail over
  // 3000ms is the shape that kills a turn mid-call.
  for (const key of ['llm', 'e2e', 'tts']) {
    const v = c.latency?.[key]?.values
    if (v?.length) {
      console.log(`  ${key.padEnd(4)} latency   p50 ${pct(v, 0.5)}ms · p90 ${pct(v, 0.9)}ms · max ${Math.max(...v)}ms · n=${v.length} · over3000=${v.filter(x => x > 3000).length}`)
    }
  }

  const usage = c.llm_token_usage
  if (usage) console.log(`  tokens         avg ${Math.round(usage.average ?? 0)}/req · n=${usage.num_requests ?? '?'}`)
  else console.log(`  tokens         ABSENT — no LLM request ever completed`)

  // Which tools actually fired, and with what arguments. This is the question that
  // matters for item / sms_consent / booking_token.
  const toolCalls = []
  for (const t of c.transcript_with_tool_calls ?? []) {
    if (t.role === 'tool_call_invocation') toolCalls.push(t)
  }
  console.log(`\n  TOOL CALLS (${toolCalls.length}):`)
  if (!toolCalls.length) console.log('    none — no tool was invoked on this call')
  for (const t of toolCalls) {
    console.log(`    → ${t.name}`)
    let args = t.arguments
    try { args = JSON.parse(t.arguments) } catch {}
    for (const [k, v] of Object.entries(args ?? {})) {
      console.log(`        ${k}: ${JSON.stringify(v)}`)
    }
  }

  console.log('\n  TRANSCRIPT:')
  const lines = (c.transcript ?? '').split('\n').filter(Boolean)
  for (const l of lines) console.log(`    ${l}`)
  console.log('')
}

#!/usr/bin/env node
/** READ-ONLY. Real calls on which a transfer was invoked or completed, per Retell's own records. */
import { Retell } from 'retell-sdk'
const client = new Retell({ apiKey: process.env.RETELL_API_KEY })
const AGENT = process.argv[2] ?? 'agent_d39a1b13cfd8fb2e3c9c12f06e'
const calls = []
let paginationKey
for (let i = 0; i < 10; i++) {
  const page = await client.call.list({ filter_criteria: { agent_id: [AGENT] }, limit: 1000, sort_order: 'descending', ...(paginationKey ? { pagination_key: paginationKey } : {}) })
  const items = Array.isArray(page) ? page : (page?.items ?? page?.data ?? [])
  calls.push(...items)
  if (items.length < 1000) break
  paginationKey = items[items.length - 1].call_id
}
console.log(`${calls.length} calls on ${AGENT}`)
const hits = calls.filter(c =>
  c.disconnection_reason === 'call_transfer' ||
  (c.transcript_with_tool_calls ?? []).some(t => /transfer/i.test(t.name ?? '') || /transfer/i.test(t.role ?? '') ) ||
  (c.transcript_object ?? []).some(t => /transfer/i.test(t.content ?? '') && t.role === 'agent'))
for (const c of hits) {
  console.log(`\n${c.call_id}  ${new Date(c.start_timestamp).toISOString()}  ${Math.round((c.duration_ms ?? 0) / 1000)}s  reason=${c.disconnection_reason}`)
  for (const t of c.transcript_with_tool_calls ?? []) {
    if (/transfer/i.test(t.name ?? '') || /transfer/i.test(t.role ?? '') || /transfer/i.test(t.content ?? '')) console.log(`   ${t.role}${t.name ? ':' + t.name : ''}  ${(t.content ?? t.arguments ?? '').toString().slice(0, 140)}`)
  }
}
console.log(`\ncalls with disconnection_reason=call_transfer: ${calls.filter(c => c.disconnection_reason === 'call_transfer').length}`)
console.log(`most recent call: ${calls[0] ? new Date(calls[0].start_timestamp).toISOString() : 'none'}`)

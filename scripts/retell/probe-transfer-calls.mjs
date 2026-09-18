#!/usr/bin/env node
/** READ-ONLY. Real calls on which a transfer was invoked or completed, per Retell's own records. */
import { Retell } from 'retell-sdk'
import { collectPages } from '../../lib/retell-pagination.ts'
const client = new Retell({ apiKey: process.env.RETELL_API_KEY })
const AGENT = process.argv[2] ?? 'agent_d39a1b13cfd8fb2e3c9c12f06e'
// Uses the server's own cursor (pagination_key / has_more). An earlier draft used the last call_id as
// the cursor, which only worked because this account had fewer calls than one page.
const calls = await collectPages(
  k => client.call.list({ filter_criteria: { agent_id: [AGENT] }, limit: 1000, sort_order: 'descending', pagination_key: k }),
  { label: 'calls' },
)
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

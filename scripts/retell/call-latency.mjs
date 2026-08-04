#!/usr/bin/env node
/**
 * READ-ONLY. Prints the per-stage latency breakdown for recent calls.
 *
 * Retell records p50/p90/max for each stage of every call. That turns "she feels laggy" into a
 * number, and it is the only way to tell which stage is actually responsible — on 2026-08-04 a
 * change that was supposed to *reduce* latency quadrupled it, and only this breakdown showed
 * that the model stage was 98% of the delay while speech-to-text and voice were fine.
 *
 * Run after any config change, before and after, on the same agent:
 *   node --env-file=.env.local scripts/retell/call-latency.mjs [count]
 *
 * Reads RETELL_API_KEY. Makes NO changes.
 *
 * Reading it:
 *   llm  — time for the model to produce the reply. The usual culprit.
 *   tts  — voice generation. Healthy is roughly 150-200ms.
 *   asr  — speech recognition. Healthy is roughly 150-250ms.
 *   e2e  — what the caller actually experiences.
 *
 * A near-constant llm figure (p50 and max within a few ms across turns) is a fixed wait — a
 * queue or a timeout — not compute. Compute varies. That distinction is what identified the
 * high_priority regression.
 */
import { Retell } from 'retell-sdk'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const count = Number(process.argv.find(a => /^\d+$/.test(a)) ?? 8)
const client = new Retell({ apiKey })

const res = await client.call.list({ limit: count })
const calls = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])

const stat = (o) => (o && o.p50 != null)
  ? `${String(Math.round(o.p50)).padStart(5)}ms n=${String(o.num ?? '?').padEnd(2)}`
  : '        —    '

console.log('\nstarted (UTC)        ver  dur    llm              tts              asr              spread')
console.log('─'.repeat(104))

for (const summary of calls) {
  let call
  try { call = await client.call.retrieve(summary.call_id) }
  catch (e) { console.log(`${summary.call_id}  ✗ ${e.message}`); continue }

  const l = call.latency || {}
  // p50 vs max on the model stage: a tight spread means a fixed wait, a wide one means compute.
  const spread = l.llm && l.llm.max != null && l.llm.p50 != null
    ? `${Math.round(l.llm.max - l.llm.p50)}ms`
    : '—'

  console.log(
    new Date(call.start_timestamp).toISOString().slice(0, 19).replace('T', ' ') + '  ' +
    String('v' + (call.agent_version ?? '?')).padEnd(4) +
    String(call.duration_ms ? Math.round(call.duration_ms / 1000) + 's' : '—').padEnd(6) + ' ' +
    stat(l.llm) + '   ' + stat(l.tts) + '   ' + stat(l.asr) + '   ' + spread,
  )
}
console.log('')

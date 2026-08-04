#!/usr/bin/env node
/**
 * A/B the demo line's model by measurement, not argument.
 *
 * Why this exists: on 2026-08-04 a config flag was enabled because it sounded like a latency
 * lever, and it quadrupled call latency (LLM p50 2323ms -> 9635ms). The lesson was already
 * written down from an earlier model question and got ignored anyway. So: switch, call, read
 * the numbers, decide.
 *
 * What has already been ruled out as the cause of the ~5s first reply:
 *   cold prefix   6,438 chars / ~1,610 tokens  — far too small to explain seconds
 *   own API       /api/available-slots 0.30-0.34s warm
 *   TTS / ASR     146ms / 171ms
 *   high_priority made it 4x worse; reverted
 * What is left is the model and Retell's path to it — hence this script.
 *
 * Protocol (each run is one short phone call):
 *   1. node --env-file=.env.local scripts/retell/bench-demo-model.mjs --set claude-4.5-haiku
 *   2. Call (817) 635-0220. Say the SAME opening line every time, e.g.
 *      "Hey Ava, how's it going?" then "What do you guys do?" then hang up.
 *   3. node --env-file=.env.local scripts/retell/bench-demo-model.mjs --report
 *   4. Repeat for the next model.
 *
 * Compare FIRST-TURN latency (values[1]) as well as p50 — the first reply is the one a
 * prospect actually judges, and p50 hides it.
 *
 *   --list     show Retell's model options
 *   --set X    switch the demo LLM to model X
 *   --report   per-turn latency for recent calls, current model noted
 *
 * Restore the baseline with: --set claude-4.6-sonnet
 */
import { Retell } from 'retell-sdk'

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }

const client = new Retell({ apiKey })
const DEMO_LLM = 'llm_a7acd10debcb797a013eb8378d20'

// Retell's menu, from the SDK's own type definitions — not from memory.
const MODELS = [
  'claude-4.5-haiku', 'claude-4.5-sonnet', 'claude-4.6-sonnet', 'claude-5-sonnet',
  'gemini-3.0-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.1', 'gpt-5.2',
  'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.5',
  'gpt-realtime', 'gpt-realtime-1.5', 'gpt-realtime-2', 'gpt-realtime-mini',
]

const arg = (flag) => {
  const i = process.argv.indexOf(flag)
  return i === -1 ? null : process.argv[i + 1] ?? true
}

if (process.argv.includes('--list')) {
  const llm = await client.llm.retrieve(DEMO_LLM)
  console.log(`\ncurrent: ${llm.model}\n`)
  console.log('Retell options:')
  for (const m of MODELS) console.log(`  ${m === llm.model ? '*' : ' '} ${m}`)
  console.log('\n* = current. The gpt-realtime family is built for speech; the rest are general-purpose.\n')
  process.exit(0)
}

const setTo = arg('--set')
if (setTo && setTo !== true) {
  if (!MODELS.includes(setTo)) {
    console.error(`✗ "${setTo}" is not in Retell's model list. Run --list.`)
    process.exit(1)
  }
  const before = (await client.llm.retrieve(DEMO_LLM)).model
  await client.llm.update(DEMO_LLM, { model: setTo })
  const after = (await client.llm.retrieve(DEMO_LLM)).model
  console.log(`\nmodel: ${before} -> ${after}`)
  if (after !== setTo) {
    console.error(`✗ Retell did not accept it — reported "${after}". Not usable for this test.`)
    process.exit(1)
  }
  console.log('\nNow place ONE short call, saying the same opening line as every other run.')
  console.log('Then: node --env-file=.env.local scripts/retell/bench-demo-model.mjs --report\n')
  process.exit(0)
}

if (process.argv.includes('--report')) {
  const llm = await client.llm.retrieve(DEMO_LLM)
  console.log(`\ncurrent model: ${llm.model}   (calls below may predate a switch — check the clock)\n`)

  const res = await client.call.list({ limit: 6 })
  const calls = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])

  for (const s of calls) {
    const call = await client.call.retrieve(s.call_id)
    const v = call.latency?.llm?.values ?? []
    if (!v.length) continue
    // values[0] is the canned greeting (~1ms, no model call). The first real reply is values[1]
    // — the one the caller judges, and the one an average hides.
    const firstReply = v.length > 1 ? v[1] : null
    console.log(
      new Date(call.start_timestamp).toISOString().slice(0, 19).replace('T', ' ') +
      `  dur ${String(call.duration_ms ? Math.round(call.duration_ms / 1000) + 's' : '—').padEnd(5)}` +
      `  1st reply ${String(firstReply != null ? Math.round(firstReply) + 'ms' : '—').padStart(8)}` +
      `  p50 ${String(Math.round(call.latency.llm.p50)) + 'ms'}`.padEnd(12) +
      `  turns ${v.length}`,
    )
    console.log('      per-turn: ' + v.map(x => Math.round(x)).join(' → '))
  }
  console.log('')
  process.exit(0)
}

console.log(`
Usage:
  --list            show Retell's model options and the current one
  --set <model>     switch the demo LLM
  --report          per-turn latency for recent calls

Compare values[1] (first real reply), not just p50.
`)

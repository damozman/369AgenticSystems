/**
 * Makes the agents say "three six nine Agentic Systems", not "three hundred sixty-nine".
 *
 * Caught by Chris on the first real audit call. TTS expands "369" as a cardinal number, so the
 * brand name was being read aloud wrong every time an agent said it. It is the company's name —
 * the one thing on a call that has to sound right.
 *
 * Two agents say it, found by reading every LLM rather than assuming:
 *   - **369 Audit Caller** — in `begin_message`, the voicemail text, and the prompt.
 *   - **369 Demo Agent** — in a scripted line it is told to say verbatim before ending a call.
 *     This is the one that matters most: it is the demo Chris hands to people at a chamber event.
 *
 * Why text and not Retell's `pronunciation_dictionary`: that field needs IPA or CMU phonemes and
 * the SDK's own comment says to "check the dashboard to see what provider supports this feature".
 * A brand name is not the place for a setting that silently does nothing on some voices. Changing
 * the words is deterministic on every engine.
 *
 * `begin_message` is spoken verbatim and is not generated, so it must carry the spelled-out form
 * literally. The prompt also gets an explicit rule, because anything the model composes mid-call
 * is its own output and no static replacement can reach it.
 *
 * Idempotent: re-running finds nothing to do. Dry run by default.
 *
 * node --env-file=.env.local scripts/retell/fix-brand-pronunciation.mjs
 * node --env-file=.env.local scripts/retell/fix-brand-pronunciation.mjs --apply
 */
import Retell from 'retell-sdk'

const APPLY = process.argv.includes('--apply')
const KEY = process.env.RETELL_API_KEY
if (!KEY) {
  console.error('RETELL_API_KEY is not set. Run with --env-file=.env.local')
  process.exit(1)
}
const client = new Retell({ apiKey: KEY })

const SPOKEN = 'three six nine Agentic Systems'

/** The rule appended to a prompt, so anything the model composes says it correctly too. */
const RULE =
  '\n\nSAYING THE COMPANY NAME: always say it aloud as "three six nine Agentic Systems". ' +
  'Never say "three hundred and sixty-nine" and never write it as "369" in anything you say — ' +
  'the digits get read out as a number, which is not the company\'s name.'

const RULE_MARK = 'SAYING THE COMPANY NAME:'

function fixText(text) {
  if (!text) return text
  return text.replace(/369 Agentic Systems/g, SPOKEN)
}

async function main() {
  console.log(`\n369 · brand pronunciation — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const res = await client.agent.list()
  const list = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])

  let changed = 0

  for (const summary of list) {
    const agent = await client.agent.retrieve(summary.agent_id)
    const llmId = agent.response_engine?.llm_id
    if (!llmId) continue
    const llm = await client.llm.retrieve(llmId)

    const begin = llm.begin_message ?? ''
    const prompt = llm.general_prompt ?? ''
    const saysIt = /369 Agentic Systems/.test(begin) || /369 Agentic Systems/.test(prompt)
    const hasRule = prompt.includes(RULE_MARK)
    if (!saysIt && hasRule) continue
    if (!saysIt && !/369/.test(begin + prompt)) continue

    const newBegin = fixText(begin)
    let newPrompt = fixText(prompt)
    if (!hasRule) newPrompt += RULE

    console.log(`── ${agent.agent_name}  (${agent.agent_id})`)
    if (newBegin !== begin) {
      console.log(`   begin_message: "${newBegin.slice(0, 90)}…"`)
    }
    const promptHits = (prompt.match(/369 Agentic Systems/g) ?? []).length
    console.log(`   prompt: ${promptHits} occurrence(s) rewritten${hasRule ? '' : ' + pronunciation rule appended'}`)

    // The agent's voicemail text is spoken too, and lives on the agent rather than the LLM.
    const vm = agent.voicemail_option?.action
    const newVmText = vm?.type === 'static_text' ? fixText(vm.text) : null
    if (newVmText && newVmText !== vm.text) {
      console.log(`   voicemail: rewritten`)
    }

    if (!APPLY) { changed++; continue }

    await client.llm.update(llmId, { begin_message: newBegin, general_prompt: newPrompt })
    if (newVmText && newVmText !== vm.text) {
      await client.agent.update(agent.agent_id, {
        voicemail_option: { action: { type: 'static_text', text: newVmText } },
      })
    }

    // Verify through the consumer's view — the agent's own response_engine, not the write we just
    // made. This repo lost ten days to an LLM reporting a new value while the agent still
    // resolved to an older version.
    const backAgent = await client.agent.retrieve(agent.agent_id)
    const backLlm = await client.llm.retrieve(backAgent.response_engine.llm_id)
    const clean =
      !/369 Agentic Systems/.test(backLlm.begin_message ?? '') &&
      !/369 Agentic Systems/.test(backLlm.general_prompt ?? '') &&
      (backLlm.general_prompt ?? '').includes(RULE_MARK)
    console.log(`   ✓ verified through the agent: ${clean ? 'clean' : '✗ STILL CONTAINS "369 Agentic Systems"'}`)
    changed++
  }

  if (!changed) {
    console.log('Nothing to change — every agent already says it correctly.')
  } else if (!APPLY) {
    console.log(`\n${changed} agent(s) would change. Re-run with --apply.`)
  } else {
    console.log(`\n${changed} agent(s) updated.`)
    console.log('A phone number pinned to an older agent version will NOT pick this up — ' +
                'check bindings if a live line still says it wrong.')
  }
}

main().catch(err => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`)
  process.exitCode = 1
})

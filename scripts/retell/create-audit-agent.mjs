/**
 * Creates the dedicated audit agent — the voice behind "we called your line".
 *
 * Dossier step 5. Without it, `lib/audit-call-dial.ts` falls back to `RETELL_AGENT_ID`, the shared
 * demo agent, which would greet a prospect as **their own receptionist**. Bizarre, and damaging to
 * the one person who just asked us for an audit.
 *
 * Dry run by default. Nothing is created until `--apply`.
 *
 * What this agent is, and is not:
 *   - **Outbound only.** No phone number is bound to it, so it can never take an inbound call.
 *     It is reached solely through `override_agent_id` on a `createPhoneCall`.
 *   - **Toolless except `end_call`.** It cannot book, cannot capture a lead, cannot transfer. It
 *     says its piece and hangs up. Every tool it does not have is a thing it cannot do wrong on a
 *     stranger's phone.
 *   - **Disclosing, first sentence.** Texas TRAIGA requires it, and this repo's rule is that Ava
 *     never says "automated system" or "bot" — she says she is an AI assistant.
 *   - **It never sells.** The call ends the moment the thing being measured has been measured.
 *
 * Model and voice are copied from a reference agent rather than hardcoded, so the audit agent
 * cannot silently drift onto a different model from the fleet. See CLAUDE.md "Model choice" —
 * that has changed three times and any name written here would expire unnoticed.
 *
 * node --env-file=.env.local scripts/retell/create-audit-agent.mjs            (dry run)
 * node --env-file=.env.local scripts/retell/create-audit-agent.mjs --apply
 */
import Retell from 'retell-sdk'

const APPLY = process.argv.includes('--apply')
const KEY = process.env.RETELL_API_KEY
if (!KEY) {
  console.error('RETELL_API_KEY is not set. Run with --env-file=.env.local')
  process.exit(1)
}

const client = new Retell({ apiKey: KEY })

const AGENT_NAME = '369 Audit Caller'

/**
 * The whole script. Short on purpose.
 *
 * It states who is calling, why, that the thing being checked has just been checked, and that the
 * results are coming by email. It asks for nothing. A prospect who answers should be off the phone
 * inside fifteen seconds having learned something true.
 */
const BEGIN_MESSAGE =
  "Hi — this is Ava, an AI assistant with 369 Agentic Systems. " +
  "You asked us for a system audit a little earlier, and part of that is a quick test call to " +
  "your published line. Someone answered, which is exactly what we were checking — nothing else " +
  "is needed. Your results are on the way by email. Thanks for your time."

/** Shorter, and honest that nobody picked up. A second touch at no extra cost. */
const VOICEMAIL_MESSAGE =
  "Hi — this is Ava, an AI assistant with 369 Agentic Systems. " +
  "You asked us for a system audit earlier today, and part of that is a test call to your " +
  "published line. This one reached voicemail. That's in your results, which are on the way by " +
  "email. No need to call back. Thanks."

const GENERAL_PROMPT = `You are Ava, an AI assistant calling on behalf of 369 Agentic Systems.

This is a TEST CALL, placed because the person on the other end submitted a request for a system
audit on 369agenticsystems.com. The only purpose of this call is to establish whether a human
answers their published phone line. That has already been established the moment they say hello.

Your opening message says everything that needs saying. After it:

- If they say anything at all — "ok", "thanks", "who is this?" — answer in ONE short sentence and
  then end the call with the end_call tool.
- If they ask who you are or what this is about: you are an AI assistant with 369 Agentic Systems,
  this was the test call that forms part of the audit they requested, and their results are coming
  by email. Then end the call.
- If they ask a question you cannot answer from the above — pricing, what the system does, when
  results arrive, anything technical — say that Chris will cover it in the email and in person,
  and end the call. Do NOT improvise details. Do NOT quote a price. Do NOT book anything.
- If they are annoyed or ask to be removed: apologise once, briefly, say they will not be called
  again, and end the call immediately.
- If they ask you to call back later or transfer them to someone: you cannot. Say the team will
  follow up by email, and end the call.

NEVER:
- Sell, pitch, or describe features.
- Claim anything about their business, their website, or how they handle calls.
- State or imply how often they miss calls. This call is one moment, not a measurement.
- Promise a text message, a callback at a specific time, or a quote.
- Stay on the line longer than the exchange above requires.

Keep every sentence short. End the call as soon as the exchange is complete.`

async function main() {
  console.log(`\n369 · audit agent — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  // agent.list has been observed returning { items: [...] }; recon.mjs already handles all three
  // shapes and this must not disagree with it.
  const listRes = await client.agent.list()
  const agents = Array.isArray(listRes) ? listRes : (listRes?.items ?? listRes?.data ?? [])
  if (!agents.length) {
    console.error('No agents returned from Retell (unexpected).')
    process.exit(1)
  }

  // ── Refuse to create a second one ────────────────────────────────────────
  const existing = agents.filter(a => a.agent_name === AGENT_NAME)
  if (existing.length) {
    console.log(`An agent named "${AGENT_NAME}" already exists:`)
    for (const a of existing) console.log(`   ${a.agent_id}  (v${a.version})`)
    console.log('\nNothing to do. Delete it first if you mean to recreate it.')
    return
  }

  // ── Copy model and voice from the live fleet ─────────────────────────────
  const summary = agents.find(a => a.agent_id === process.env.RETELL_AGENT_ID) ?? agents[0]
  if (!summary) {
    console.error('No existing agent to copy voice and model settings from.')
    process.exit(1)
  }
  // Retrieve, never the list summary: `agent.list()` omits webhook_url, and copying from the
  // summary is what shipped an audit agent whose calls resolved to nothing.
  const reference = await client.agent.retrieve(summary.agent_id)
  if (!reference.webhook_url) {
    console.error(
      `✗ Reference agent ${summary.agent_id} has no webhook_url. The audit agent would never be ` +
      `told how its calls ended, so every call would cost money and establish nothing. Aborting.`)
    process.exit(1)
  }
  const refLlmId = reference.response_engine?.llm_id
  const refLlm = refLlmId ? await client.llm.retrieve(refLlmId) : null

  const model = refLlm?.model ?? 'gemini-3.5-flash'
  console.log(`Copying from reference agent ${reference.agent_id} ("${reference.agent_name}")`)
  console.log(`   model: ${model}`)
  console.log(`   voice: ${reference.voice_id}`)
  console.log(`   language: ${reference.language ?? 'en-US'}\n`)

  const llmConfig = {
    model,
    general_prompt: GENERAL_PROMPT,
    begin_message: BEGIN_MESSAGE,
    // end_call and nothing else. Every tool it lacks is something it cannot do wrong.
    general_tools: [{
      type: 'end_call',
      name: 'end_call',
      description:
        'End the call. Use as soon as the exchange is complete — this call exists only to ' +
        'establish that someone answered.',
    }],
  }

  const agentConfig = {
    agent_name: AGENT_NAME,
    voice_id: reference.voice_id,
    language: reference.language ?? 'en-US',
    // Nobody is waiting on this call; a normal cadence sounds less like a robocall.
    responsiveness: 1,
    interruption_sensitivity: 1,
    voicemail_option: { action: { type: 'static_text', text: VOICEMAIL_MESSAGE } },
    // Generous, but this agent should never be on a call this long.
    max_call_duration_ms: 120_000,
    /**
     * Copied from the reference agent, and this line is load-bearing.
     *
     * An earlier version of this script set no webhook, on the reasoning that Retell was
     * configured account-level "because not one of the 11 agents sets one". That was derived from
     * `agent.list()`, which does not return the field. `agent.retrieve()` does: every live agent
     * carries a per-agent `webhook_url` with a shared secret in the query string.
     *
     * The first real test call proved it — the audit agent answered, was picked up, and its
     * `audit_calls` row sat in `placed` for ever because `call_ended` reached nobody.
     * `describeAuditCall()` classifies from that webhook, so without it an audit call establishes
     * nothing and the dossier section can never be written.
     *
     * A list endpoint's silence is not evidence of absence.
     */
    webhook_url: reference.webhook_url,
  }

  console.log('LLM to create:')
  console.log(`   model:          ${llmConfig.model}`)
  console.log(`   tools:          ${llmConfig.general_tools.map(t => t.name).join(', ')}`)
  console.log(`   begin_message:  "${BEGIN_MESSAGE.slice(0, 78)}…"`)
  console.log(`   prompt:         ${GENERAL_PROMPT.length} chars`)
  console.log('\nAgent to create:')
  for (const [k, v] of Object.entries(agentConfig)) {
    console.log(`   ${k.padEnd(24)} ${typeof v === 'object' ? JSON.stringify(v).slice(0, 70) + '…' : v}`)
  }
  console.log('\nNO phone number will be bought or bound — this agent is outbound only.')

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create it.')
    return
  }

  const llm = await client.llm.create(llmConfig)
  console.log(`\n✓ LLM created: ${llm.llm_id}`)

  let agent
  try {
    agent = await client.agent.create({
      ...agentConfig,
      response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
    })
  } catch (e) {
    console.error('✗ Agent creation failed — deleting the orphaned LLM so nothing leaks.')
    await client.llm.delete(llm.llm_id).catch(err => console.error('  cleanup failed:', err))
    throw e
  }
  console.log(`✓ Agent created: ${agent.agent_id}`)

  // Verify through the consumer's view rather than trusting the write — this repo lost ten days
  // to an LLM that reported a new value while the agent still resolved to an older version.
  const readBack = await client.agent.retrieve(agent.agent_id)
  const llmBack = await client.llm.retrieve(readBack.response_engine.llm_id)
  console.log('\nRead back from Retell:')
  console.log(`   agent_name:  ${readBack.agent_name}`)
  console.log(`   model:       ${llmBack.model}`)
  console.log(`   tools:       ${(llmBack.general_tools ?? []).map(t => t.name).join(', ') || '(none)'}`)
  console.log(`   voicemail:   ${readBack.voicemail_option ? 'configured' : 'NOT SET'}`)
  console.log(`   webhook:     ${readBack.webhook_url ? 'set' : '✗ NOT SET — calls will resolve to nothing'}`)

  console.log(`\n── Set these in Vercel (and .env.local), then redeploy ──`)
  console.log(`RETELL_AUDIT_AGENT_ID=${agent.agent_id}`)
  console.log(`RETELL_AUDIT_FROM_NUMBER=<an existing Retell number on the account>`)
  console.log(`\nVercel bakes env vars in at build time, so the redeploy is required.`)
}

main().catch(err => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`)
  process.exitCode = 1
})

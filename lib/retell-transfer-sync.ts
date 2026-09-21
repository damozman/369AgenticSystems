/**
 * Bring one client's Retell agent in line with the transfer tool their tier entitles them to.
 *
 * The decision lives in `lib/retell-transfer-tool.ts` and is unit-tested without an API key; this
 * file is only the part that reads the database, writes to Retell, and proves the write landed.
 *
 * **Converge, don't apply a delta.** It reads the client's current state, compares it to what the
 * tier says it should be, and writes only the difference. That makes it safe to call repeatedly —
 * which matters because Stripe re-delivers webhooks, and because a failed attach has to be
 * repairable by simply running it again (`scripts/retell/sync-transfer-tool.mjs`).
 */

import { Retell } from 'retell-sdk'
import { createClient } from '@supabase/supabase-js'
import {
  buildTransferTool,
  decideTransferTool,
  samePhone,
  TRANSFER_TOOL_NAME,
  type TransferToolAction,
} from '@/lib/retell-transfer-tool'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
if (!RETELL_API_KEY) {
  throw new Error('RETELL_API_KEY is not configured')
}

const client = new Retell({ apiKey: RETELL_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TransferSyncResult {
  clientDomain: string
  action: TransferToolAction | 'error'
  reason: string
  /** True when Retell was actually written to. False for a no-op or a refusal. */
  applied: boolean
  /** True when the agent's own response_engine was re-read and agreed. Only meaningful if applied. */
  verified: boolean
  /** Set when the client needs a human — no number on file, or the write failed. */
  needsAttention: boolean
}

interface ToolLike { name?: string; transfer_destination?: { number?: string } }

/**
 * Sync one client. Never throws: the caller is a Stripe webhook that must not fail its delivery
 * because Retell had a bad minute. Everything that could need a person sets `needsAttention`.
 */
export async function syncTransferToolForClient(clientDomain: string): Promise<TransferSyncResult> {
  const fail = (reason: string): TransferSyncResult => ({
    clientDomain, action: 'error', reason, applied: false, verified: false, needsAttention: true,
  })

  try {
    const { data: sub, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('tier, retell_agent_id, owner_phone')
      .eq('client_domain', clientDomain)
      .maybeSingle()

    if (subError) return fail(`Could not read the subscription row: ${subError.message}`)
    if (!sub) return fail('No agent_subscriptions row for this client.')
    if (!sub.retell_agent_id) {
      // Not an error worth waking anyone for when they are not Elite — a client with no agent has
      // nothing to attach a tool to either way.
      return sub.tier === 'Elite'
        ? fail('Elite, but this client has no retell_agent_id — there is no agent to attach a transfer tool to.')
        : { clientDomain, action: 'none', reason: `No Retell agent for this client, and tier is ${sub.tier ?? 'unset'} — nothing to do.`, applied: false, verified: false, needsAttention: false }
    }

    const agent = await client.agent.retrieve(sub.retell_agent_id)
    if (agent.response_engine?.type !== 'retell-llm') {
      return fail(`Agent ${sub.retell_agent_id} is not a retell-llm agent, so it has no general_tools to hold a transfer tool.`)
    }
    const llmId = agent.response_engine.llm_id

    const llm = await client.llm.retrieve(llmId)
    const tools: ToolLike[] = (llm.general_tools ?? []) as ToolLike[]
    const existing = tools.find(t => t.name === TRANSFER_TOOL_NAME)

    const decision = decideTransferTool({
      tier: sub.tier,
      ownerPhone: sub.owner_phone,
      toolPresent: Boolean(existing),
      toolDestination: existing?.transfer_destination?.number ?? null,
    })

    if (decision.action === 'none') {
      return { clientDomain, action: 'none', reason: decision.reason, applied: false, verified: false, needsAttention: false }
    }
    if (decision.action === 'blocked') {
      console.warn(`[TRANSFER-SYNC] ${clientDomain}: ${decision.reason}`)
      return { clientDomain, action: 'blocked', reason: decision.reason, applied: false, verified: false, needsAttention: true }
    }

    // Filter by name first in both directions: attaching must REPLACE any existing transfer tool
    // rather than append a second one with the same name.
    const withoutTransfer = tools.filter(t => t.name !== TRANSFER_TOOL_NAME)
    const nextTools = decision.action === 'attach'
      ? [...withoutTransfer, buildTransferTool(sub.owner_phone as string)]
      : withoutTransfer

    // Only general_tools is sent. llm.update is a partial patch, and lib/retell-kb-sync.ts writes
    // general_prompt on questionnaire sync — two writers, different fields, no clobbering.
    await client.llm.update(llmId, { general_tools: nextTools as never })

    // Verify through the CONSUMER's view, not the producer's. An LLM that reports the new value
    // while the agent still resolves an older version is what made the demo line answer calls and
    // record none for ten days, so re-read the agent and follow its own response_engine.
    const agentAfter = await client.agent.retrieve(sub.retell_agent_id)
    const refAfter = agentAfter.response_engine
    if (refAfter?.type !== 'retell-llm') {
      return fail('After the write, the agent no longer resolves to a retell-llm response engine.')
    }
    const llmAfter = await client.llm.retrieve(refAfter.llm_id)
    const toolAfter = ((llmAfter.general_tools ?? []) as ToolLike[]).find(t => t.name === TRANSFER_TOOL_NAME)

    const verified = decision.action === 'attach'
      ? Boolean(toolAfter) && samePhone(toolAfter?.transfer_destination?.number, sub.owner_phone)
      : !toolAfter

    if (!verified) {
      return fail(
        `Wrote general_tools to ${llmId}, but the agent still resolves to ${decision.action === 'attach' ? 'no transfer tool (or the wrong destination)' : 'a transfer tool that should be gone'}. `
        + `Check for a pinned response_engine version (agent resolves llm ${refAfter.llm_id} v${refAfter.version ?? '?'}).`
      )
    }

    console.log(`[TRANSFER-SYNC] ✓ ${clientDomain}: ${decision.action} — ${decision.reason}`)
    return { clientDomain, action: decision.action, reason: decision.reason, applied: true, verified: true, needsAttention: false }
  } catch (e) {
    return fail(`Transfer tool sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

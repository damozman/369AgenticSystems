/**
 * Retell AI provisioning: create per-client agents from template agents
 */

import { Retell } from 'retell-sdk'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''

if (!RETELL_API_KEY) {
  throw new Error('RETELL_API_KEY is not configured')
}

const client = new Retell({ apiKey: RETELL_API_KEY })

// Map verticals to their template agent IDs
const TEMPLATE_AGENT_IDS: Record<string, string> = {
  roofing:      process.env.RETELL_TEMPLATE_AGENT_ROOFING || '',
  hvac:         process.env.RETELL_TEMPLATE_AGENT_HVAC || '',
  plumbing:     process.env.RETELL_TEMPLATE_AGENT_PLUMBING || '',
  legal:        process.env.RETELL_TEMPLATE_AGENT_LEGAL || '',
  'real-estate': process.env.RETELL_TEMPLATE_AGENT_REAL_ESTATE || '',
  insurance:    process.env.RETELL_TEMPLATE_AGENT_INSURANCE || '',
  saas:         process.env.RETELL_TEMPLATE_AGENT_SAAS || '',
  wholesale:    process.env.RETELL_TEMPLATE_AGENT_WHOLESALE || '',
  dental:       process.env.RETELL_TEMPLATE_AGENT_DENTAL || '',
}

export interface ProvisionRetellAgentInput {
  businessName: string
  vertical: string
  clientDomain: string
  preferredAreaCode?: string
  ownerPhone?: string  // Elite: owner's phone for live call transfer
}

export interface ProvisionRetellAgentOutput {
  agentId: string
  phoneNumber: string
  agentName: string
}

/**
 * Clone the vertical's template LLM into a new, per-client LLM with the
 * caller's real business name baked into the greeting. Without this, every
 * client on a vertical shares the exact same LLM object — same hardcoded
 * greeting, same prompt, no personalization, and no way to layer in
 * questionnaire-driven context later without leaking it to every other
 * customer on that LLM.
 */
async function cloneAgentLlm(templateLlmId: string, businessName: string, ownerPhone?: string): Promise<string> {
  const templateLlm = await client.llm.retrieve(templateLlmId)

  const newLlmConfig: any = { ...templateLlm }
  delete newLlmConfig.llm_id
  delete newLlmConfig.version
  delete newLlmConfig.last_modification_timestamp
  delete newLlmConfig.is_published

  newLlmConfig.begin_message = `Thank you for calling ${businessName}, this is Ava. How can I help you today?`

  // Elite: live call transfer. This is a tool on the LLM's general_tools, not
  // an agent-level field — confirmed by reproducing a real call where the
  // agent had no way to actually transfer and just recited the owner's phone
  // number back as text instead. The `transfer_phone_number` field this used
  // to set doesn't exist anywhere in the real retell-sdk Agent type.
  if (ownerPhone) {
    newLlmConfig.general_tools = [
      ...(newLlmConfig.general_tools || []),
      {
        type: 'transfer_call',
        name: 'transfer_to_owner',
        description: 'Transfer the caller to the business owner when they explicitly ask to speak with a real person, describe a genuine emergency, or have a situation too complex to handle over the phone. Let the caller know you\'re connecting them before transferring.',
        transfer_destination: { type: 'predefined', number: ownerPhone },
        // Warm transfer with a private handoff: the AI briefs the owner
        // privately (e.g. "I have Chris on the line with an active leak")
        // before connecting the caller — the owner hears context, the caller
        // doesn't hear the AI talking about them.
        transfer_option: {
          type: 'warm_transfer',
          transfer_ring_duration_ms: 30000,
          private_handoff_option: {
            type: 'prompt',
            prompt: 'Give a brief, natural one-sentence heads-up to whoever answers, based on the conversation so far — caller\'s first name and the core issue. Example: "I have Chris on the line with an active roof leak." Keep it under 10 seconds, then hand off.',
          },
        },
      },
    ]
  }

  const newLlm = await client.llm.create(newLlmConfig)
  return newLlm.llm_id
}

/**
 * Allocate a unique phone number for an agent from Retell and bind it as
 * that agent's inbound number.
 */
async function allocatePhoneNumber(agentId: string, preferredAreaCode?: string): Promise<string> {
  const areaCode = preferredAreaCode ? parseInt(preferredAreaCode, 10) : undefined

  const response = await client.phoneNumber.create({
    inbound_agents: [{ agent_id: agentId, weight: 1 }],
    ...(areaCode && !Number.isNaN(areaCode) ? { area_code: areaCode } : {}),
  })

  return response.phone_number
}

/**
 * Create a new Retell agent for a client by cloning the template for their vertical
 */
export async function provisionRetellAgent(
  input: ProvisionRetellAgentInput
): Promise<ProvisionRetellAgentOutput> {
  const { businessName, vertical, clientDomain, preferredAreaCode, ownerPhone } = input

  // Get template agent ID for this vertical
  const templateAgentId = TEMPLATE_AGENT_IDS[vertical]
  if (!templateAgentId) {
    throw new Error(`No template agent configured for vertical: ${vertical}`)
  }

  console.log(`[RETELL] Fetching template agent for ${vertical}...`)

  // Fetch the template agent to get its config
  let templateAgent
  try {
    templateAgent = await client.agent.retrieve(templateAgentId)
  } catch (e) {
    console.error(`[RETELL] Failed to fetch template agent ${templateAgentId}:`, e)
    throw new Error(`Failed to retrieve template agent: ${e instanceof Error ? e.message : e}`)
  }

  // Clone the template's LLM so this client gets their own conversational
  // brain with their real business name in the greeting, instead of sharing
  // the template's LLM (and its hardcoded placeholder greeting) with every
  // other client on this vertical.
  if (templateAgent.response_engine?.type !== 'retell-llm') {
    throw new Error(`Template agent ${templateAgentId} is not a retell-llm response engine`)
  }
  const templateLlmId = templateAgent.response_engine.llm_id

  console.log(`[RETELL] Cloning LLM for ${businessName}...`)
  let newLlmId: string
  try {
    newLlmId = await cloneAgentLlm(templateLlmId, businessName, ownerPhone)
    console.log(`[RETELL] ✓ LLM cloned: ${newLlmId}${ownerPhone ? ' (with live transfer to owner)' : ''}`)
  } catch (e) {
    console.error(`[RETELL] Failed to clone LLM:`, e)
    throw new Error(`Failed to clone LLM: ${e instanceof Error ? e.message : e}`)
  }

  // Create a new agent from the template config, pointed at the new LLM
  console.log(`[RETELL] Creating new agent for ${businessName}...`)

  const newAgentConfig: any = {
    ...templateAgent,
    // Override the agent name to identify it belongs to this client
    agent_name: `${businessName} — ${vertical.charAt(0).toUpperCase() + vertical.slice(1)}`,
    // Point at this client's own cloned LLM, not the shared template's
    response_engine: { type: 'retell-llm', llm_id: newLlmId },
    // Remove read-only fields and version metadata from the template's own
    // revision history — Retell rejects "version > 0" on agent creation, and
    // the template's version_title/description shouldn't carry to a clone.
    agent_id: undefined,
    created_at: undefined,
    updated_at: undefined,
    last_modification_timestamp: undefined,
    version: undefined,
    base_version: undefined,
    version_title: undefined,
    version_description: undefined,
    is_published: undefined,
  }

  // Remove undefined fields
  Object.keys(newAgentConfig).forEach(key => {
    if ((newAgentConfig as any)[key] === undefined) {
      delete (newAgentConfig as any)[key]
    }
  })

  let newAgent
  try {
    newAgent = await client.agent.create(newAgentConfig)
  } catch (e) {
    console.error(`[RETELL] Failed to create agent, cleaning up orphaned LLM ${newLlmId}:`, e)
    await client.llm.delete(newLlmId).catch(deleteErr =>
      console.error(`[RETELL] Failed to clean up orphaned LLM ${newLlmId}:`, deleteErr)
    )
    throw new Error(`Failed to create Retell agent: ${e instanceof Error ? e.message : e}`)
  }

  console.log(`[RETELL] ✓ Agent created: ${newAgent.agent_id}`)

  // Allocate a unique phone number for this client
  console.log(`[RETELL] Allocating phone number${preferredAreaCode ? ` (area code ${preferredAreaCode})` : ''}...`)
  let phoneNumber: string
  try {
    phoneNumber = await allocatePhoneNumber(newAgent.agent_id || '', preferredAreaCode)
    console.log(`[RETELL] ✓ Phone allocated: ${phoneNumber}`)
  } catch (e) {
    // No silent fallback to the shared demo number — a customer without their
    // own phone number isn't provisioned. Clean up the orphaned agent + LLM so
    // failed attempts don't accumulate unusable resources in the Retell account.
    console.error(`[RETELL] Phone allocation failed, deleting orphaned agent ${newAgent.agent_id}:`, e)
    if (newAgent.agent_id) {
      await client.agent.delete(newAgent.agent_id).catch(deleteErr =>
        console.error(`[RETELL] Failed to clean up orphaned agent ${newAgent.agent_id}:`, deleteErr)
      )
    }
    await client.llm.delete(newLlmId).catch(deleteErr =>
      console.error(`[RETELL] Failed to clean up orphaned LLM ${newLlmId}:`, deleteErr)
    )
    throw new Error(`Failed to allocate phone number: ${e instanceof Error ? e.message : e}`)
  }

  return {
    agentId: newAgent.agent_id || '',
    phoneNumber,
    agentName: newAgent.agent_name || '',
  }
}

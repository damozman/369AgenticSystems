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

  // Create a new agent from the template config
  console.log(`[RETELL] Creating new agent for ${businessName}...`)

  const newAgentConfig: any = {
    ...templateAgent,
    // Override the agent name to identify it belongs to this client
    agent_name: `${businessName} — ${vertical.charAt(0).toUpperCase() + vertical.slice(1)}`,
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

  // response_engine.version is the LLM's own version number, not the agent's —
  // Retell rejects it here too ("Cannot specify version > 0 for new agent"),
  // confirmed by reproducing the exact create() call directly against the API.
  if (newAgentConfig.response_engine) {
    const { version: _responseEngineVersion, ...responseEngineRest } = newAgentConfig.response_engine
    newAgentConfig.response_engine = responseEngineRest
  }

  // Elite: configure live call transfer to owner's phone
  if (ownerPhone) {
    newAgentConfig.transfer_phone_number = ownerPhone
    console.log(`[RETELL] Configured live transfer to ${ownerPhone}`)
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
    console.error(`[RETELL] Failed to create agent:`, e)
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
    // own phone number isn't provisioned. Clean up the orphaned agent so
    // failed attempts don't accumulate unusable agents in the Retell account.
    console.error(`[RETELL] Phone allocation failed, deleting orphaned agent ${newAgent.agent_id}:`, e)
    if (newAgent.agent_id) {
      await client.agent.delete(newAgent.agent_id).catch(deleteErr =>
        console.error(`[RETELL] Failed to clean up orphaned agent ${newAgent.agent_id}:`, deleteErr)
      )
    }
    throw new Error(`Failed to allocate phone number: ${e instanceof Error ? e.message : e}`)
  }

  return {
    agentId: newAgent.agent_id || '',
    phoneNumber,
    agentName: newAgent.agent_name || '',
  }
}

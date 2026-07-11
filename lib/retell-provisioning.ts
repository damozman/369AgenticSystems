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
}

export interface ProvisionRetellAgentOutput {
  agentId: string
  phoneNumber: string
  agentName: string
}

/**
 * Create a new Retell agent for a client by cloning the template for their vertical
 */
export async function provisionRetellAgent(
  input: ProvisionRetellAgentInput
): Promise<ProvisionRetellAgentOutput> {
  const { businessName, vertical, clientDomain } = input

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

  const newAgentConfig = {
    ...templateAgent,
    // Override the agent name to identify it belongs to this client
    agent_name: `${businessName} — ${vertical.charAt(0).toUpperCase() + vertical.slice(1)}`,
    // Remove read-only fields
    agent_id: undefined,
    created_at: undefined,
    updated_at: undefined,
    last_modification_timestamp: undefined,
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

  // For now, return the template's phone number
  // TODO: In phase 2, allocate new phone numbers per client via Retell's phone provisioning API
  const phoneNumber = process.env.RETELL_PHONE_NUMBER || ''

  return {
    agentId: newAgent.agent_id || '',
    phoneNumber: phoneNumber || '',
    agentName: newAgent.agent_name || '',
  }
}

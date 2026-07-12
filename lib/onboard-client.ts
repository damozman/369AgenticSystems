import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail, sendOwnerNotification } from '@/lib/email-sequences'
import { provisionRetellAgent } from '@/lib/retell-provisioning'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AGENTS_BY_TIER: Record<string, string[]> = {
  Starter: ['receptionist', 'dashboard'],
  Pro:     ['receptionist', 'followup', 'dashboard'],
  Elite:   ['receptionist', 'followup', 'reviews', 'dashboard'],
}

const PRICE_BY_TIER: Record<string, number> = {
  Starter: 400,
  Pro:     600,
  Elite:   750,
}

const DEFAULT_PROMPTS: Record<string, string> = {
  roofing:  'You are a professional receptionist for a roofing company. Answer calls, capture lead info (name, phone, address, email, issue description), assess urgency, and book appointments when possible. Ask for an email address so we can send estimates and follow-ups. Be concise, friendly, and focused on converting every caller into a booked job.',
  hvac:     'You are a professional receptionist for an HVAC company. Prioritize emergency calls (no heat/AC in extreme weather). Capture caller info including email, describe the issue, assess urgency, and book service calls. Ask for an email address so we can send confirmations and follow-ups. Be efficient and calm under pressure.',
  plumbing: 'You are a professional receptionist for a plumbing company. Emergency calls (burst pipes, flooding) are top priority. Capture caller info including email, describe the issue, assess urgency, and book service calls. Ask for an email address so we can send confirmations and follow-ups. Convey urgency and competence.',
  dental:   'You are a professional receptionist for a dental practice. Handle appointment requests, urgent dental issues, and new patient inquiries. Capture patient info including email, reason for visit, and preferred appointment times. Ask for an email address so we can send confirmations and reminders. Be warm and professional.',
}

export interface ProvisionClientInput {
  businessName:        string
  ownerName?:          string
  email:               string
  phone?:              string
  vertical:            string
  tier:                string
  clientDomain:        string
  monthlyRevenueLost?: number
  setupPaid?:          boolean
  preferredAreaCode?:  string
}

export async function provisionClient(input: ProvisionClientInput) {
  const {
    businessName, ownerName, email, phone,
    vertical, tier, clientDomain, monthlyRevenueLost,
    setupPaid = false,
    preferredAreaCode,
  } = input

  const activeAgents = AGENTS_BY_TIER[tier] ?? AGENTS_BY_TIER.Starter
  const monthlyCost  = PRICE_BY_TIER[tier]  ?? 400

  // 0. Provision Retell agent (new per-client agent from template)
  console.log(`[ONBOARD] Provisioning Retell agent for ${businessName}...`)
  let retellAgentId: string
  let retellPhoneNumber: string

  try {
    const retellResult = await provisionRetellAgent({
      businessName,
      vertical,
      clientDomain,
      preferredAreaCode,
      ownerPhone: tier === 'Elite' ? phone : undefined, // Pass owner phone for Elite tier live transfer
    })
    retellAgentId = retellResult.agentId
    retellPhoneNumber = retellResult.phoneNumber
    console.log(`[ONBOARD] ✓ Retell agent provisioned: ${retellAgentId} → ${retellPhoneNumber}`)
  } catch (e) {
    console.error('[ONBOARD] Retell provisioning failed:', e)
    // For now, fail the whole onboarding if Retell provisioning fails
    throw new Error(`Failed to provision Retell agent: ${e instanceof Error ? e.message : e}`)
  }

  // 1. Create subscription record (with Retell agent ID + phone number)
  const subscriptionData: any = {
    client_domain:  clientDomain,
    user_email:     email,
    vertical,
    tier,
    active_agents:  activeAgents,
    monthly_cost:   monthlyCost,
    setup_paid:     setupPaid,
    activated_at:   new Date().toISOString(),
    retell_agent_id: retellAgentId,
    retell_phone_number: retellPhoneNumber,
  }

  // Store preferred area code if provided
  if (preferredAreaCode) {
    subscriptionData.preferred_area_code = preferredAreaCode
  }

  // Store owner phone for Elite tier (live call transfer)
  if (tier === 'Elite' && phone) {
    subscriptionData.owner_phone = phone
  }

  const { data: subscription, error: subError } = await supabase
    .from('agent_subscriptions')
    .upsert(subscriptionData, { onConflict: 'client_domain' })
    .select()
    .single()

  if (subError) {
    console.error('[ONBOARD] Subscription insert failed:', subError.message)
    throw new Error(subError.message)
  }

  // 2. Create agent configuration(s)
  const systemPrompt = DEFAULT_PROMPTS[vertical] ?? DEFAULT_PROMPTS.roofing
  const configRows = activeAgents
    .filter(a => a !== 'dashboard')
    .map(agentType => ({
      client_domain:  clientDomain,
      agent_type:     agentType,
      vertical,
      system_prompt:  agentType === 'receptionist' ? systemPrompt : null,
      activated_at:   new Date().toISOString(),
    }))

  if (configRows.length > 0) {
    const { error: configError } = await supabase
      .from('agent_configurations')
      .insert(configRows)

    if (configError) {
      console.error('[ONBOARD] Config insert failed:', configError.message)
      // Non-fatal — subscription is created, configs can be added manually
    }
  }

  // 3. Send welcome email to client
  try {
    await sendWelcomeEmail({
      toEmail: email,
      businessName,
      tier,
      vertical,
      clientDomain,
      retellPhoneNumber,
    })
    console.log(`[ONBOARD] Welcome email sent → ${email}`)
  } catch (e) {
    console.error('[ONBOARD] Welcome email failed:', e)
  }

  // 4. Notify owner
  try {
    await sendOwnerNotification({
      businessName,
      ownerName:    ownerName ?? 'Unknown',
      email,
      phone:        phone ?? 'Not provided',
      tier,
      vertical,
      clientDomain,
      monthlyRevenueLost,
    })
    console.log('[ONBOARD] Owner notification sent')
  } catch (e) {
    console.error('[ONBOARD] Owner notification failed:', e)
  }

  console.log(`[ONBOARD] ✓ ${businessName} (${tier} · ${vertical}) — ${clientDomain}`)
  return subscription
}

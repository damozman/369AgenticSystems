import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail, sendOwnerNotification } from '@/lib/email-sequences'
import { provisionRetellAgent } from '@/lib/retell-provisioning'
import { allocateSmsNumber } from '@/lib/twilio-sms'

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
  stripeCustomerId?:   string
  /**
   * The Stripe *subscription* id, not the customer.
   *
   * This is the billing-period anchor. Without it a client can never be metered for overage —
   * lib/billing-period.ts:billablePeriodFor returns null rather than inventing a period — so it
   * has to be captured from the first signup onward. Backfilling anchors after the fact means
   * guessing when someone's month starts, which is not a guess to make about money.
   */
  stripeSubscriptionId?: string
}

export async function provisionClient(input: ProvisionClientInput) {
  const {
    businessName, ownerName, email, phone,
    vertical, tier, clientDomain, monthlyRevenueLost,
    setupPaid = false,
    preferredAreaCode,
    stripeCustomerId,
    stripeSubscriptionId,
  } = input

  const activeAgents = AGENTS_BY_TIER[tier] ?? AGENTS_BY_TIER.Starter
  const monthlyCost  = PRICE_BY_TIER[tier]  ?? 400

  // -1. Claim this purchase BEFORE anything is bought.
  //
  // On 2026-08-18 one checkout provisioned three agents and bought three phone numbers: the
  // event reached two endpoints and one of them was retried. Two of those runs were 3ms apart,
  // which is why this is an INSERT that can lose rather than a SELECT that can be raced — both
  // callers would have read "not provisioned yet" before either wrote.
  //
  // It has to happen before step 0, not after: the money is spent in step 0, so a guard placed
  // any later stops the duplicate ROW while still buying the duplicate NUMBER.
  if (stripeSubscriptionId) {
    const { error: claimError } = await supabase
      .from('provisioning_claims')
      .insert({ stripe_subscription_id: stripeSubscriptionId, client_domain: clientDomain })

    if (claimError) {
      // 23505 = unique_violation: another delivery of the same checkout got here first.
      if (claimError.code === '23505') {
        console.log(`[ONBOARD] ${stripeSubscriptionId} is already claimed — duplicate delivery, nothing provisioned`)
        return null
      }
      // Any other failure means we cannot prove this is the only run, and provisioning anyway
      // risks a second phone number. Refuse: the webhook alerts, and a human can retry.
      throw new Error(`Could not claim provisioning for ${stripeSubscriptionId}: ${claimError.message}`)
    }
  } else {
    // One-off payments carry no subscription id, so there is nothing stable to key on and this
    // call is NOT idempotent. Every real signup is subscription-mode; this is here so the gap
    // is visible in the logs rather than silent.
    console.warn(`[ONBOARD] No stripeSubscriptionId for ${clientDomain} — provisioning is NOT protected against duplicate delivery`)
  }

  // Release the claim on any failure, so a transient Retell or database error does not lock a
  // paying customer out of ever being provisioned by a later retry.
  const releaseClaim = async (why: string) => {
    if (!stripeSubscriptionId) return
    console.error(`[ONBOARD] Releasing claim on ${stripeSubscriptionId} — ${why}`)
    const { error } = await supabase
      .from('provisioning_claims')
      .delete()
      .eq('stripe_subscription_id', stripeSubscriptionId)
    if (error) console.error('[ONBOARD] Claim release FAILED — retries will be blocked:', error.message)
  }

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
    await releaseClaim('Retell provisioning failed')
    // For now, fail the whole onboarding if Retell provisioning fails
    throw new Error(`Failed to provision Retell agent: ${e instanceof Error ? e.message : e}`)
  }

  // Allocate SMS number for Pro/Elite (for Rex follow-ups)
  let smsPhoneNumber: string | null = null
  if ((tier === 'Pro' || tier === 'Elite') && activeAgents.includes('followup')) {
    console.log(`[ONBOARD] Allocating SMS number for ${tier}...`)
    smsPhoneNumber = await allocateSmsNumber(preferredAreaCode)
    if (smsPhoneNumber) {
      console.log(`[ONBOARD] ✓ SMS number allocated: ${smsPhoneNumber}`)
    } else {
      console.warn(`[ONBOARD] SMS allocation failed, falling back to email-only`)
    }
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
    // The customer-facing name every client-branded message renders from
    // (lib/client-identity.ts). Collected at checkout and passed to Retell for the agent,
    // but it was not persisted here — so a Stripe-provisioned client had no business_name
    // and Rex's templates fell back to a generic phrase. The legal entity name never
    // appears here; see CLAUDE.md on 3SIX9 MEDIA MASTERS LLC.
    business_name: businessName,
  }

  // Store preferred area code if provided
  if (preferredAreaCode) {
    subscriptionData.preferred_area_code = preferredAreaCode
  }

  // Store Stripe customer ID so the dashboard can link to the Billing Portal
  if (stripeCustomerId) {
    subscriptionData.stripe_customer_id = stripeCustomerId
  }

  // Store the subscription ID — the billing-period anchor for usage metering. See the field's
  // comment on ProvisionClientInput for why this cannot be backfilled later.
  if (stripeSubscriptionId) {
    subscriptionData.stripe_subscription_id = stripeSubscriptionId
  }

  // Store owner phone for Elite tier (live call transfer)
  if (tier === 'Elite' && phone) {
    subscriptionData.owner_phone = phone
  }

  // Store SMS number for Pro/Elite (follow-up channel option)
  if (smsPhoneNumber) {
    subscriptionData.sms_phone_number = smsPhoneNumber
    subscriptionData.followup_method = 'combo'  // Default to combo (email + SMS)
  }

  const { data: subscription, error: subError } = await supabase
    .from('agent_subscriptions')
    .upsert(subscriptionData, { onConflict: 'client_domain' })
    .select()
    .single()

  if (subError) {
    console.error('[ONBOARD] Subscription insert failed:', subError.message)
    // The Retell agent and number are already bought at this point. Releasing the claim lets a
    // retry finish the job, but that retry will buy ANOTHER number — the orphan from this run
    // has to be released by hand. provisioning_claims.completed_at IS NULL finds these.
    await releaseClaim('subscription insert failed — NOTE: a Retell number is already purchased and orphaned')
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

  if (stripeSubscriptionId) {
    const { error: completeError } = await supabase
      .from('provisioning_claims')
      .update({ completed_at: new Date().toISOString(), retell_agent_id: retellAgentId })
      .eq('stripe_subscription_id', stripeSubscriptionId)
    // Non-fatal: the claim already did its job by existing. An unmarked claim only means the
    // "abandoned mid-flight" query is less precise.
    if (completeError) console.error('[ONBOARD] Could not mark claim complete:', completeError.message)
  }

  console.log(`[ONBOARD] ✓ ${businessName} (${tier} · ${vertical}) — ${clientDomain}`)
  return subscription
}

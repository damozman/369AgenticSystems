import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail, sendOwnerNotification } from '@/lib/email-sequences'

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
  roofing:  'You are a professional receptionist for a roofing company. Answer calls, capture lead info (name, phone, address, issue description), assess urgency, and book appointments when possible. Be concise, friendly, and focused on converting every caller into a booked job.',
  hvac:     'You are a professional receptionist for an HVAC company. Prioritize emergency calls (no heat/AC in extreme weather). Capture caller info, describe the issue, assess urgency, and book service calls. Be efficient and calm under pressure.',
  plumbing: 'You are a professional receptionist for a plumbing company. Emergency calls (burst pipes, flooding) are top priority. Capture caller info, describe the issue, assess urgency, and book service calls. Convey urgency and competence.',
  dental:   'You are a professional receptionist for a dental practice. Handle appointment requests, urgent dental issues, and new patient inquiries. Capture patient info, reason for visit, and preferred appointment times. Be warm and professional.',
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    businessName,
    ownerName,
    email,
    phone,
    vertical,
    tier,
    clientDomain,
    monthlyRevenueLost,
  } = body as {
    businessName?:       string
    ownerName?:          string
    email?:              string
    phone?:              string
    vertical?:           string
    tier?:               string
    clientDomain?:       string
    monthlyRevenueLost?: number
  }

  if (!businessName || !email || !vertical || !tier || !clientDomain) {
    return NextResponse.json(
      { error: 'Missing required fields: businessName, email, vertical, tier, clientDomain' },
      { status: 400 }
    )
  }

  const activeAgents = AGENTS_BY_TIER[tier] ?? AGENTS_BY_TIER.Starter
  const monthlyCost  = PRICE_BY_TIER[tier]  ?? 400

  // 1. Create subscription record
  const { data: subscription, error: subError } = await supabase
    .from('agent_subscriptions')
    .upsert({
      client_domain:  clientDomain,
      user_email:     email,
      vertical,
      tier,
      active_agents:  activeAgents,
      monthly_cost:   monthlyCost,
      setup_paid:     false,
      activated_at:   new Date().toISOString(),
    }, { onConflict: 'client_domain' })
    .select()
    .single()

  if (subError) {
    console.error('[ONBOARD] Subscription insert failed:', subError.message)
    return NextResponse.json({ error: subError.message }, { status: 500 })
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
    await sendWelcomeEmail({ toEmail: email, businessName, tier, vertical, clientDomain })
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
  return NextResponse.json({ success: true, subscription })
}

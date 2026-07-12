/**
 * Configure live call transfer for Elite tier clients
 * PUT /api/elite/configure-transfer
 * Body: { clientDomain: string, transferPhoneNumber: string }
 */

import { createClient } from '@supabase/supabase-js'
import { Retell } from 'retell-sdk'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY || '' })

export async function PUT(request: NextRequest) {
  try {
    const { clientDomain, transferPhoneNumber } = await request.json() as {
      clientDomain?: string
      transferPhoneNumber?: string
    }

    if (!clientDomain || !transferPhoneNumber) {
      return NextResponse.json(
        { error: 'Missing clientDomain or transferPhoneNumber' },
        { status: 400 }
      )
    }

    // Get client subscription
    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('*')
      .eq('client_domain', clientDomain)
      .single()

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    if (subscription.tier !== 'Elite') {
      return NextResponse.json(
        { error: 'Live transfer only available for Elite tier' },
        { status: 403 }
      )
    }

    // Update Retell agent with transfer phone number
    const agentId = subscription.retell_agent_id
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent not configured for this client' },
        { status: 400 }
      )
    }

    console.log(`[TRANSFER] Updating agent ${agentId} with transfer phone ${transferPhoneNumber}`)

    // Fetch current agent config
    let currentAgent
    try {
      currentAgent = await retell.agent.retrieve(agentId)
    } catch (e) {
      console.error('[TRANSFER] Failed to fetch agent:', e)
      return NextResponse.json(
        { error: `Failed to retrieve agent: ${e instanceof Error ? e.message : e}` },
        { status: 500 }
      )
    }

    // Update agent with transfer phone number
    const updatedConfig = {
      ...currentAgent,
      transfer_phone_number: transferPhoneNumber,
      // Remove read-only fields
      agent_id: undefined,
      created_at: undefined,
      updated_at: undefined,
      last_modification_timestamp: undefined,
    }

    // Remove undefined fields
    Object.keys(updatedConfig).forEach(key => {
      if ((updatedConfig as any)[key] === undefined) {
        delete (updatedConfig as any)[key]
      }
    })

    let updatedAgent
    try {
      updatedAgent = await retell.agent.update(agentId, updatedConfig)
    } catch (e) {
      console.error('[TRANSFER] Failed to update agent:', e)
      return NextResponse.json(
        { error: `Failed to update agent: ${e instanceof Error ? e.message : e}` },
        { status: 500 }
      )
    }

    // Store transfer phone in database
    const { error: updateError } = await supabase
      .from('agent_subscriptions')
      .update({ owner_phone: transferPhoneNumber })
      .eq('client_domain', clientDomain)

    if (updateError) {
      console.error('[TRANSFER] Failed to update subscription:', updateError)
      return NextResponse.json(
        { error: `Failed to save transfer number: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log(`[TRANSFER] ✓ Agent updated with transfer phone ${transferPhoneNumber}`)

    return NextResponse.json({
      success: true,
      message: 'Live transfer configured',
      agentId,
      transferPhoneNumber,
    })
  } catch (error) {
    console.error('[TRANSFER] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

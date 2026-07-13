/**
 * DEBUG: Show template agent config to help identify correct field names
 * GET /api/debug/agent-template?vertical=roofing
 */

import { Retell } from 'retell-sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY || '' })

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const vertical = searchParams.get('vertical') || 'roofing'

  const templateAgentId = TEMPLATE_AGENT_IDS[vertical]
  if (!templateAgentId) {
    return NextResponse.json(
      { error: `No template for vertical: ${vertical}` },
      { status: 400 }
    )
  }

  try {
    const agent = await retell.agent.retrieve(templateAgentId)

    // Log all keys to help identify structure
    const keys = Object.keys(agent).sort()

    return NextResponse.json({
      vertical,
      agentId: templateAgentId,
      keys,
      full: agent,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

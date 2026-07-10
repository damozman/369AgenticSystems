import { NextRequest, NextResponse } from 'next/server'

// Disabled: this used to email clients the shared multi-vertical DEMO number as
// their "dedicated receptionist number" and tell them to forward their real
// business line to it — no per-client number exists yet (agent_configurations
// has no phone_number column). Re-enable once real per-client provisioning exists.
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'Setup instructions are sent manually for now — contact chris@369agenticsystems.com' },
    { status: 410 }
  )
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    call_id,
    client_domain,
    caller_phone,
    caller_name,
    caller_address,
    issue_description,
    urgency,
  } = body as {
    call_id?:           string
    client_domain?:     string
    caller_phone?:      string
    caller_name?:       string
    caller_address?:    string
    issue_description?: string
    urgency?:           string
  }

  if (!call_id || !client_domain || !caller_phone) {
    return NextResponse.json(
      { error: 'Missing required fields: call_id, client_domain, caller_phone' },
      { status: 400 }
    )
  }

  // Resolve Retell call_id string → Supabase call UUID for FK
  const { data: callRow, error: callError } = await supabase
    .from('calls')
    .select('id')
    .eq('call_id', call_id)
    .maybeSingle()

  if (callError) {
    console.error('[LEAD] ✗  Call lookup failed:', callError.message)
    return NextResponse.json({ error: callError.message }, { status: 500 })
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert({
      call_id:           callRow?.id ?? null,
      client_domain,
      caller_phone,
      caller_name:       caller_name       ?? null,
      caller_address:    caller_address    ?? null,
      issue_description: issue_description ?? null,
      urgency:           urgency           ?? 'normal',
    })
    .select()
    .single()

  if (leadError) {
    console.error('[LEAD] ✗  Insert failed:', leadError.message)
    return NextResponse.json({ error: leadError.message }, { status: 500 })
  }

  console.log(`[LEAD] ✓  Captured — ${caller_phone} @ ${client_domain}`)
  return NextResponse.json({ success: true, lead })
}

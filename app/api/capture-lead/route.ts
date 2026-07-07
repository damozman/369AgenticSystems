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
    caller_email,
    issue_description,
    urgency,
  } = body as {
    call_id?:           string
    client_domain?:     string
    caller_phone?:      string
    caller_name?:       string
    caller_address?:    string
    caller_email?:      string
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
      caller_email:      caller_email      ?? null,
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

  // Fire Rex (follow-up) and Felix (conflict check, legal-only — gated inside its own route) — non-fatal
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    fetch(`${appUrl}/api/rex/trigger`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ lead_id: lead.id }),
    }).catch(err => console.error('[REX TRIGGER] Failed:', err))

    fetch(`${appUrl}/api/felix/conflict-check`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ lead_id: lead.id }),
    }).catch(err => console.error('[FELIX TRIGGER] Failed:', err))
  }

  return NextResponse.json({ success: true, lead })
}

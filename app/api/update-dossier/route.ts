import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Service-role client — bypasses RLS for server-to-server webhook ingestion.
// Do NOT replace with lib/supabase-server.ts: that client is cookie-scoped for
// portal users and has no auth context in an incoming Gumloop webhook request.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const receivedAt = new Date().toISOString()
  console.log(`[369 WEBHOOK] ▶  Incoming audit payload — ${receivedAt}`)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    console.error('[369 WEBHOOK] ✗  Failed to parse request body as JSON')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    client_domain,
    security_score,
    seo_visibility,
    lead_velocity,
    leak_detected,
    roi_multiplier,
    payload_status = 'pending',
  } = body as {
    client_domain?:  string
    security_score?: number
    seo_visibility?: number
    lead_velocity?:  number
    leak_detected?:  boolean
    roi_multiplier?: number
    payload_status?: string
  }

  if (!client_domain) {
    console.warn('[369 WEBHOOK] ✗  Rejected — missing required field: client_domain')
    return NextResponse.json(
      { error: 'Missing required field: client_domain' },
      { status: 400 }
    )
  }

  console.log(
    `[369 WEBHOOK] ▷  client_domain=${client_domain} | status=${payload_status}`
  )

  const { error } = await supabaseAdmin
    .from('system_audits')
    .insert({
      client_domain,
      security_score:  security_score  ?? null,
      seo_visibility:  seo_visibility  ?? null,
      lead_velocity:   lead_velocity   ?? null,
      leak_detected:   leak_detected   ?? null,
      roi_multiplier:  roi_multiplier  ?? null,
      payload_status,
      created_at:      receivedAt,
    })

  if (error) {
    console.error(`[369 WEBHOOK] ✗  Supabase insert failed — ${error.message}`)
    return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
  }

  console.log(`[369 WEBHOOK] ✓  Audit committed to system_audits — ${client_domain}`)
  return NextResponse.json({ success: true }, { status: 200 })
}

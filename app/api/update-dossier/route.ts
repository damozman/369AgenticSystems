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

  const raw = body as Record<string, unknown>

  const client_domain  = raw.client_domain  as string | undefined
  const payload_status = (raw.payload_status as string | undefined) ?? 'pending'

  // Gumloop sends all values as strings — coerce to correct DB types
  const security_score = raw.security_score != null ? parseInt(String(raw.security_score), 10)   : null
  const seo_visibility = raw.seo_visibility != null ? parseInt(String(raw.seo_visibility), 10)   : null
  const lead_velocity  = raw.lead_velocity  != null ? parseInt(String(raw.lead_velocity),  10)   : null
  const roi_multiplier = raw.roi_multiplier != null ? parseFloat(String(raw.roi_multiplier))      : null
  const leak_detected  = raw.leak_detected  != null
    ? String(raw.leak_detected).toLowerCase() === 'true'
    : null

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
      security_score:  Number.isNaN(security_score) ? null : security_score,
      seo_visibility:  Number.isNaN(seo_visibility) ? null : seo_visibility,
      lead_velocity:   Number.isNaN(lead_velocity)  ? null : lead_velocity,
      leak_detected,
      roi_multiplier:  Number.isNaN(roi_multiplier as number) ? null : roi_multiplier,
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

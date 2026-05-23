import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { diagnosticAlertHtml, dossierHtml } from '@/lib/email-templates'

// Service-role client — bypasses RLS for server-to-server webhook ingestion.
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

  // ── Field extraction ───────────────────────────────────────────────────────
  const client_domain           = body.client_domain           as string | undefined
  const client_email            = body.client_email            as string | undefined
  const client_name             = (body.client_name as string | undefined) ?? 'Business Owner'
  const revenue_leakage         = body.revenue_leakage         as string | undefined
  const booking_link            = body.booking_link            as string | undefined
  const onboarding_dossier_text = body.onboarding_dossier_text as string | undefined
  const payload_status          = (body.payload_status as string | undefined) ?? 'pending'

  // Coerce numeric values
  const security_score = body.security_score != null ? parseInt(String(body.security_score), 10)  : null
  const seo_visibility = body.seo_visibility != null ? parseInt(String(body.seo_visibility), 10)  : null
  const lead_velocity  = body.lead_velocity  != null ? parseInt(String(body.lead_velocity),  10)  : null
  const roi_multiplier = body.roi_multiplier != null ? parseFloat(String(body.roi_multiplier))     : null
  const leak_detected  = body.leak_detected  != null
    ? String(body.leak_detected).toLowerCase() === 'true'
    : null

  if (!client_domain) {
    console.warn('[369 WEBHOOK] ✗  Rejected — missing required field: client_domain')
    return NextResponse.json({ error: 'Missing required field: client_domain' }, { status: 400 })
  }

  // ── STEP 1: Supabase insert ────────────────────────────────────────────────
  const { error: dbError } = await supabaseAdmin
    .from('system_audits')
    .insert({
      client_domain,
      security_score:  Number.isNaN(security_score as number) ? null : security_score,
      seo_visibility:  Number.isNaN(seo_visibility as number) ? null : seo_visibility,
      lead_velocity:   Number.isNaN(lead_velocity  as number) ? null : lead_velocity,
      leak_detected,
      roi_multiplier:  Number.isNaN(roi_multiplier as number) ? null : roi_multiplier,
      payload_status,
      created_at: receivedAt,
    })

  if (dbError) {
    console.error(`[369 WEBHOOK] ✗  Supabase insert failed — ${dbError.message}`)
    return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
  }

  // ── STEP 2 & 3: Parallel Email Dispatch ────────────────────────────────────
  if (client_email && process.env.RESEND_API_KEY) {
    const resend   = new Resend(process.env.RESEND_API_KEY)
    const from     = process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com'
    const scanDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Diagnostic Alert Promise
    const diagnosticPromise = resend.emails.send({
      from,
      to: client_email,
      subject: `⚡ Autonomous Scan Complete — ${client_domain}`,
      html: diagnosticAlertHtml({
        client_name, client_domain,
        security_score, seo_visibility,
        revenue_leakage, booking_link,
        scan_date: scanDate,
      }),
    })

    // Dossier Promise (Only fires if dossier text exists)
    const dossierPromise = onboarding_dossier_text && onboarding_dossier_text.trim().length > 0
      ? resend.emails.send({
          from,
          to: client_email,
          subject: `📋 Your Operational Dossier — ${client_domain}`,
          html: dossierHtml({ client_name, client_domain, onboarding_dossier_text, booking_link }),
        })
      : Promise.resolve({ data: null, error: 'No dossier text provided' })

    // Execute both in parallel
    const [diagRes, dossRes] = await Promise.all([diagnosticPromise, dossierPromise])

    if (diagRes.error) console.error('[369 EMAIL] ✕ Alert 1 failed:', diagRes.error)
    else console.log(`[369 EMAIL] ✓ Alert 1 dispatched | id: ${diagRes.data?.id}`)

    if (typeof dossRes !== 'string' && dossRes.error) {
      console.error('[369 EMAIL] ✕ Dossier 2 failed:', dossRes.error)
    } else {
      console.log(`[369 EMAIL] ✓ Dossier 2 dispatched | id: ${dossRes.data?.id}`)
    }
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
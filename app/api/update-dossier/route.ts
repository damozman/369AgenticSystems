import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { diagnosticAlertHtml, dossierHtml, callBriefHtml, followUpHtml } from '@/lib/email-templates'

// Service-role client — bypasses RLS for server-to-server webhook ingestion.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'

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
  const client_industry         = body.client_industry         as string | undefined
  const revenue_leakage         = body.revenue_leakage         as string | undefined
  const booking_link            = (body.booking_link as string | undefined) ?? 'https://cal.com/369agentic/30min'
  const onboarding_dossier_text = body.onboarding_dossier_text as string | undefined
  const call_brief              = body.call_brief              as string | undefined
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
      client_email:    client_email    ?? null,
      client_name:     client_name     ?? null,
      client_industry: client_industry ?? null,
      revenue_leakage: revenue_leakage ?? null,
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

  // ── Email Dispatch ─────────────────────────────────────────────────────────
  if (process.env.RESEND_API_KEY) {
    const resend    = new Resend(process.env.RESEND_API_KEY)
    const baseFrom  = process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com'
    const scanDate  = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Email 1 — Diagnostic Alert → prospect, immediate
    // FROM: "369 System Scan" signals an automated discovery, not a sales pitch
    const sendAlert = client_email
      ? resend.emails.send({
          from:    `369 System Scan <${baseFrom}>`,
          to:      client_email,
          replyTo: OWNER_EMAIL,
          subject: `⚡ Autonomous Scan Complete — ${client_domain}`,
          html:    diagnosticAlertHtml({
            client_name, client_domain,
            security_score, seo_visibility,
            revenue_leakage, booking_link,
            scan_date: scanDate,
          }),
        })
      : Promise.resolve(null)

    // Email 2 — Full dossier → prospect, scheduled 5 min later
    // FROM: "369 Intelligence Division" frames the dossier as enterprise analysis
    const sendDossier = client_email && onboarding_dossier_text && onboarding_dossier_text.trim().length > 0
      ? resend.emails.send({
          from:        `369 Intelligence Division <${baseFrom}>`,
          to:          client_email,
          replyTo:     OWNER_EMAIL,
          subject:     `📋 Your Operational Dossier — ${client_domain}`,
          html:        dossierHtml({ client_name, client_domain, onboarding_dossier_text, booking_link }),
          scheduledAt: 'in 5 min',
        })
      : Promise.resolve(null)

    // Email 3 — Call Brief → owner (Chris), immediate
    // Internal pre-call intelligence file with metrics + AI-generated talking points
    const sendCallBrief = call_brief && call_brief.trim().length > 0
      ? resend.emails.send({
          from:    `369 Command Center <${baseFrom}>`,
          to:      OWNER_EMAIL,
          subject: `🎯 Call Brief — ${client_name} / ${client_domain}`,
          html:    callBriefHtml({
            client_name, client_domain, client_industry,
            security_score, seo_visibility, revenue_leakage,
            call_brief, booking_link,
          }),
        })
      : Promise.resolve(null)

    // Email 4 — Day-2 follow-up → prospect, 48 hours later
    const day2At = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const sendDay2 = client_email
      ? resend.emails.send({
          from:        `369 Agentic Systems <${baseFrom}>`,
          to:          client_email,
          replyTo:     OWNER_EMAIL,
          subject:     `Quick check-in — ${client_domain}`,
          html:        followUpHtml({ client_name, client_domain, security_score, seo_visibility, revenue_leakage, booking_link, day: 2 }),
          scheduledAt: day2At,
        })
      : Promise.resolve(null)

    // Email 5 — Day-7 follow-up → prospect, 7 days later
    const day7At = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const sendDay7 = client_email
      ? resend.emails.send({
          from:        `369 Agentic Systems <${baseFrom}>`,
          to:          client_email,
          replyTo:     OWNER_EMAIL,
          subject:     `Last note on ${client_domain}`,
          html:        followUpHtml({ client_name, client_domain, security_score, seo_visibility, revenue_leakage, booking_link, day: 7 }),
          scheduledAt: day7At,
        })
      : Promise.resolve(null)

    type ResendResult = { data: { id: string } | null; error: { message: string } | null } | null
    const [r1, r2, r3, r4, r5] = await Promise.allSettled([sendAlert, sendDossier, sendCallBrief, sendDay2, sendDay7])

    const v1 = r1.status === 'fulfilled' ? (r1.value as ResendResult) : null
    const v2 = r2.status === 'fulfilled' ? (r2.value as ResendResult) : null
    const v3 = r3.status === 'fulfilled' ? (r3.value as ResendResult) : null
    const v4 = r4.status === 'fulfilled' ? (r4.value as ResendResult) : null
    const v5 = r5.status === 'fulfilled' ? (r5.value as ResendResult) : null

    if (r1.status === 'rejected')      console.error('[369 EMAIL] ✕ Alert network error:', r1.reason)
    else if (v1?.error)                console.error('[369 EMAIL] ✕ Alert Resend rejected:', JSON.stringify(v1.error))
    else if (v1?.data?.id)             console.log(`[369 EMAIL] ✓ Alert dispatched → ${client_email} | id: ${v1.data.id}`)
    else if (!client_email)            console.warn('[369 EMAIL] ⚠ Alert skipped — client_email missing')

    if (r2.status === 'rejected')      console.error('[369 EMAIL] ✕ Dossier network error:', r2.reason)
    else if (v2?.error)                console.error('[369 EMAIL] ✕ Dossier Resend rejected:', JSON.stringify(v2.error))
    else if (v2?.data?.id)             console.log(`[369 EMAIL] ✓ Dossier scheduled (5 min) → ${client_email} | id: ${v2.data.id}`)
    else if (!onboarding_dossier_text) console.warn('[369 EMAIL] ⚠ Dossier skipped — onboarding_dossier_text missing')

    if (r3.status === 'rejected')      console.error('[369 EMAIL] ✕ Call brief network error:', r3.reason)
    else if (v3?.error)                console.error('[369 EMAIL] ✕ Call brief Resend rejected:', JSON.stringify(v3.error))
    else if (v3?.data?.id)             console.log(`[369 EMAIL] ✓ Call brief dispatched → ${OWNER_EMAIL} | id: ${v3.data.id}`)
    else if (!call_brief)              console.warn('[369 EMAIL] ⚠ Call brief skipped — call_brief missing from payload')

    if (r4.status === 'rejected')      console.error('[369 EMAIL] ✕ Day-2 network error:', r4.reason)
    else if (v4?.error)                console.error('[369 EMAIL] ✕ Day-2 Resend rejected:', JSON.stringify(v4.error))
    else if (v4?.data?.id)             console.log(`[369 EMAIL] ✓ Day-2 follow-up scheduled → ${client_email} | id: ${v4.data.id}`)

    if (r5.status === 'rejected')      console.error('[369 EMAIL] ✕ Day-7 network error:', r5.reason)
    else if (v5?.error)                console.error('[369 EMAIL] ✕ Day-7 Resend rejected:', JSON.stringify(v5.error))
    else if (v5?.data?.id)             console.log(`[369 EMAIL] ✓ Day-7 follow-up scheduled → ${client_email} | id: ${v5.data.id}`)
  }

  return NextResponse.json({ success: true }, { status: 200 })
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

// Vercel cron fires this at 15:00 UTC = 10:00 AM CT, Mon–Fri
// GET is required for Vercel cron jobs
export async function GET(request: NextRequest) {
  // Guard: only allow Vercel cron or internal calls
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now       = new Date()
  const dayOfWeek = now.getUTCDay() // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ skipped: 'weekend' })
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Fetch all active subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from('agent_subscriptions')
    // `company_name` does not exist on this table and never did. Selecting it made PostgREST
    // return an error, which sent this whole cron down the `if (subError)` branch below — so
    // silence-check ran every weekday and alerted nobody, for as long as that line has been
    // there. Found 2026-08-16 by probing production rather than reading the schema file.
    .select('client_domain, user_email, business_name')
    .not('activated_at', 'is', null)

  if (subError || !subscriptions?.length) {
    console.log('[SILENCE CHECK] No active subscriptions or error:', subError?.message)
    return NextResponse.json({ checked: 0 })
  }

  let alerted = 0

  for (const sub of subscriptions) {
    // Check how many calls came in for this client in the last 24 hours
    const { count } = await supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('client_domain', sub.client_domain)
      .gte('created_at', since24h)

    if ((count ?? 0) > 0) continue // They had calls — all good

    // Zero calls in 24 hours on a weekday — send alert
    console.log(`[SILENCE CHECK] Zero calls for ${sub.client_domain} — sending alert`)

    const clientName = (sub as Record<string, unknown>).business_name as string | null ?? sub.user_email

    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
      to:      sub.user_email,
      replyTo: 'chris@369agenticsystems.com',
      subject: `⚠️ Your AI receptionist hasn't received any calls today`,
      html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#0A0A0A;color:#F0F0F0;padding:32px 24px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">

  <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D4AF37;font-family:monospace;">
    369 Agentic Systems
  </p>
  <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#FFFFFF;">Quick check-in</h2>

  <p style="font-size:14px;color:#94A3B8;line-height:1.65;margin:0 0 20px;">
    Hi ${clientName} — your AI receptionist hasn't received any calls in the last 24 hours.
    This is usually one of two things:
  </p>

  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px 20px;margin-bottom:20px;">
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#FFFFFF;">Option A — Call forwarding isn't active</p>
    <p style="margin:0 0 12px;font-size:12px;color:#94A3B8;line-height:1.6;">
      This is the most common reason. Here's how to turn it on (takes 60 seconds):
    </p>
    <ul style="margin:0;padding-left:18px;font-size:12px;color:#94A3B8;line-height:1.9;">
      <li><strong style="color:#F0F0F0;">AT&amp;T / Verizon:</strong> Dial <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;">*72</code> then your Retell number</li>
      <li><strong style="color:#F0F0F0;">T-Mobile:</strong> Settings → Phone → Call Forwarding</li>
      <li><strong style="color:#F0F0F0;">Google Voice:</strong> Settings → Calls → Call Forwarding</li>
    </ul>
    <p style="margin:10px 0 0;font-size:11px;color:#475569;">
      Your dedicated number: <strong style="color:#D4AF37;font-family:monospace;">${process.env.RETELL_PHONE_NUMBER ?? 'check your onboarding email'}</strong>
    </p>
  </div>

  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px 20px;margin-bottom:24px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#FFFFFF;">Option B — It's just a slow day</p>
    <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">
      If forwarding is already on and it's been a quiet day, ignore this. We've got you covered.
    </p>
  </div>

  <a href="https://369agenticsystems.com/client-dashboard"
     style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:13px;">
    View Your Dashboard →
  </a>

  <p style="margin:20px 0 0;font-size:11px;color:#334155;font-family:monospace;">
    Reply to this email or text Chris directly if you need help setting up forwarding.
  </p>
</div>
      `,
    })

    if (!error) {
      alerted++
      // Log to notifications table so it appears in their dashboard
      await supabase.from('notifications').insert({
        client_domain: sub.client_domain,
        type:          'alert',
        title:         'No calls received in 24 hours',
        message:       'Your AI receptionist is standing by but no calls have come through. Check that call forwarding is active.',
        action:        'https://369agenticsystems.com/client-dashboard',
      })
    }
  }

  // Also notify Chris of any silenced clients
  if (alerted > 0) {
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
      to:      'chris@369agenticsystems.com',
      subject: `⚠️ Silence Alert: ${alerted} client(s) with zero calls today`,
      html: `<div style="font-family:monospace;padding:20px;background:#0A0A0A;color:#94A3B8;max-width:400px;">
        <p style="color:#F87171;font-size:13px;margin:0 0 8px;">Daily Silence Check</p>
        <p style="color:#F0F0F0;font-size:16px;font-weight:700;margin:0 0 8px;">${alerted} client(s) with no calls in 24h</p>
        <p style="margin:0;font-size:12px;">Silence alerts sent automatically. Consider a proactive check-in.</p>
      </div>`,
    })
  }

  console.log(`[SILENCE CHECK] Done — ${subscriptions.length} clients checked, ${alerted} alerted`)
  return NextResponse.json({ checked: subscriptions.length, alerted })
}

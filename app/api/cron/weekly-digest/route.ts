import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { RECOVERY_RATE } from '@/lib/roi'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

// Vercel cron fires this at 13:00 UTC every Monday = 8:00 AM CT
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Fetch all active subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from('agent_subscriptions')
    .select('client_domain, user_email, vertical, tier, monthly_cost')
    .not('activated_at', 'is', null)

  if (subError || !subscriptions?.length) {
    console.log('[WEEKLY DIGEST] No active subscriptions:', subError?.message)
    return NextResponse.json({ sent: 0 })
  }

  // Job value estimates by vertical (conservative) for revenue protected calc
  const JOB_VALUE: Record<string, number> = {
    roofing:       2500,
    hvac:          350,
    plumbing:      400,
    legal:         5000,
    'real-estate': 9000,
    insurance:     1200,
    saas:          2400,
    wholesale:     2500,
    dental:        200,
  }

  let sent = 0

  for (const sub of subscriptions) {
    const domain   = sub.client_domain
    const vertical = sub.vertical ?? 'roofing'
    const jobValue = JOB_VALUE[vertical] ?? 1000

    // Calls this week
    const { data: calls } = await supabase
      .from('calls')
      .select('call_outcome, duration_seconds, created_at')
      .eq('client_domain', domain)
      .gte('created_at', since7d)

    const totalCalls   = calls?.length ?? 0
    const bookedCalls  = calls?.filter(c => c.call_outcome === 'booked').length ?? 0
    const capturedLeads = calls?.filter(c => c.call_outcome === 'captured_lead').length ?? 0
    const afterHours   = calls?.filter(c => {
      const h = new Date(c.created_at).getHours()
      return h < 8 || h >= 18
    }).length ?? 0

    // Estimated revenue protected: leads captured × job value × recovery rate
    const revenueProtected = Math.round((bookedCalls + capturedLeads) * jobValue * RECOVERY_RATE)

    // Build status message
    let statusLine = ''
    if (totalCalls === 0) {
      statusLine = `<p style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:12px 16px;font-size:13px;color:#FCA5A5;margin:0 0 20px;">
        ⚠️ No calls received last week. If you haven't set up call forwarding yet, reply to this email and we'll walk you through it in 60 seconds.
      </p>`
    } else if (totalCalls < 5) {
      statusLine = `<p style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:8px;padding:12px 16px;font-size:13px;color:#FCD34D;margin:0 0 20px;">
        📊 Low call volume last week. If this seems lower than normal, verify call forwarding is active.
      </p>`
    } else {
      statusLine = `<p style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15);border-radius:8px;padding:12px 16px;font-size:13px;color:#86EFAC;margin:0 0 20px;">
        ✅ Strong week. Your receptionist was active and capturing leads.
      </p>`
    }

    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
      to:      sub.user_email,
      replyTo: 'chris@369agenticsystems.com',
      subject: `📊 Your Weekly Receptionist Report — Week of ${weekLabel}`,
      html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#F0F0F0;padding:32px 24px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">

  <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D4AF37;font-family:monospace;">
    Weekly Report · ${weekLabel}
  </p>
  <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;">
    Your AI Receptionist Report
  </h2>
  <p style="margin:0 0 24px;font-size:13px;color:#64748B;">${domain}</p>

  ${statusLine}

  <!-- Stats grid -->
  <div style="display:grid;gap:10px;margin-bottom:24px;">
    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px 18px;">
      <span style="font-size:13px;color:#94A3B8;">📞 Calls answered</span>
      <span style="font-size:20px;font-weight:700;color:#FFFFFF;font-family:monospace;">${totalCalls}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px 18px;">
      <span style="font-size:13px;color:#94A3B8;">📋 Leads captured</span>
      <span style="font-size:20px;font-weight:700;color:#60A5FA;font-family:monospace;">${capturedLeads}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px 18px;">
      <span style="font-size:13px;color:#94A3B8;">📅 Appointments booked</span>
      <span style="font-size:20px;font-weight:700;color:#4ADE80;font-family:monospace;">${bookedCalls}</span>
    </div>
    ${afterHours > 0 ? `
    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px 18px;">
      <span style="font-size:13px;color:#94A3B8;">🌙 After-hours calls handled</span>
      <span style="font-size:20px;font-weight:700;color:#A78BFA;font-family:monospace;">${afterHours}</span>
    </div>` : ''}
    ${revenueProtected > 0 ? `
    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.2);border-radius:10px;padding:16px 18px;">
      <span style="font-size:13px;color:#94A3B8;">💰 Estimated revenue protected</span>
      <span style="font-size:20px;font-weight:700;color:#D4AF37;font-family:monospace;">$${revenueProtected.toLocaleString()}</span>
    </div>` : ''}
  </div>

  <a href="https://369agenticsystems.com/client-dashboard"
     style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;margin-bottom:24px;">
    View Full Dashboard →
  </a>

  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;">
    <p style="margin:0;font-size:11px;color:#334155;font-family:monospace;">
      Questions or changes? Reply to this email — Chris responds within 2 hours.<br>
      369 Agentic Systems · ${sub.tier} Plan · $${sub.monthly_cost}/mo
    </p>
  </div>

</div>
      `,
    })

    if (!error) {
      sent++
      console.log(`[WEEKLY DIGEST] Sent to ${domain} — ${totalCalls} calls, ${capturedLeads} leads, ${bookedCalls} bookings`)
    }
  }

  console.log(`[WEEKLY DIGEST] Done — ${sent}/${subscriptions.length} sent`)
  return NextResponse.json({ sent, total: subscriptions.length })
}

import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(_request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: subscription } = await supabaseAdmin
    .from('agent_subscriptions')
    .select('client_domain, vertical, tier')
    .eq('user_email', user.email)
    .maybeSingle()

  if (!subscription) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  // Per-client number would live in agent_configurations eventually.
  // For now use the env var (demo number) as the forwarding target.
  const retellNumber = process.env.RETELL_PHONE_NUMBER ?? '+18176350220'
  const formatted    = retellNumber.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')

  const { error } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
    to:      user.email,
    replyTo: 'chris@369agenticsystems.com',
    subject: '📱 Your AI Receptionist Setup Instructions',
    html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#F0F0F0;padding:32px 24px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">

  <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D4AF37;font-family:monospace;">
    369 Agentic Systems · Setup Guide
  </p>
  <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;">
    Activate Your AI Receptionist
  </h2>
  <p style="margin:0 0 24px;font-size:13px;color:#64748B;">One step — takes 60 seconds.</p>

  <!-- The number -->
  <div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);border-radius:12px;padding:22px 24px;margin-bottom:24px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;font-family:monospace;letter-spacing:0.15em;text-transform:uppercase;color:#D4AF37;">
      Your Dedicated Receptionist Number
    </p>
    <p style="margin:0;font-size:36px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;font-family:monospace;">
      ${formatted}
    </p>
    <p style="margin:8px 0 0;font-size:12px;color:#64748B;">
      Forward your business line to this number to activate Ava.
    </p>
  </div>

  <!-- Carrier instructions -->
  <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#FFFFFF;">How to set up call forwarding:</p>

  <div style="display:grid;gap:10px;margin-bottom:24px;">
    ${[
      ['AT&T', `Dial <strong>*72</strong> then <strong>${formatted}</strong> from your business phone. Press Send/Call.`],
      ['Verizon', `Dial <strong>*72</strong> then <strong>${formatted}</strong>. Press Send/Call. Listen for confirmation tone.`],
      ['T-Mobile', 'Go to <strong>Settings → Phone → Call Forwarding</strong>. Enter the number above.'],
      ['Google Voice', 'Go to <strong>voice.google.com → Settings → Calls → Forwarding</strong>.'],
      ['VoIP / Landline', 'Log into your provider&#39;s admin panel and enable <strong>Call Forwarding</strong> to the number above. Contact us if you need help.'],
    ].map(([carrier, inst]) => `
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#F0F0F0;">${carrier}</p>
      <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.55;">${inst}</p>
    </div>`).join('')}
  </div>

  <!-- Test it -->
  <div style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:16px 18px;margin-bottom:24px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#4ADE80;">Test it in 30 seconds</p>
    <ol style="margin:0;padding-left:18px;font-size:12px;color:#94A3B8;line-height:1.9;">
      <li>Set up forwarding using the steps above</li>
      <li>Have someone call your regular business number</li>
      <li>Ava should answer within 2 rings</li>
      <li>Check your <a href="https://369agenticsystems.com/client-dashboard" style="color:#D4AF37;">dashboard</a> — the call appears within seconds</li>
    </ol>
  </div>

  <!-- To turn it off -->
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px;margin-bottom:24px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#F0F0F0;">To temporarily turn off forwarding:</p>
    <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.55;">
      <strong style="color:#F0F0F0;">AT&T / Verizon:</strong> Dial <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;">*73</code> to cancel forwarding instantly.<br>
      <strong style="color:#F0F0F0;">All others:</strong> Disable it from the same settings menu where you turned it on.
    </p>
  </div>

  <a href="https://369agenticsystems.com/client-dashboard"
     style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;margin-bottom:20px;">
    View Your Dashboard →
  </a>

  <p style="margin:0;font-size:11px;color:#334155;font-family:monospace;line-height:1.7;">
    Having trouble? Reply to this email or text Chris directly.<br>
    We typically respond within 2 hours and can walk you through it live.<br><br>
    369 Agentic Systems · chris@369agenticsystems.com
  </p>

</div>
    `,
  })

  if (error) {
    console.error('[SETUP INSTRUCTIONS] Resend error:', error)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

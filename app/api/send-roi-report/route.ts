import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface ReportPayload {
  businessName:     string
  ownerName:        string
  email:            string
  vertical:         string
  callsPerWeek:     number
  answerRate:       number
  jobValue:         number
  monthlyLost:      number
  monthlyRecoverable: number
  annualLost:       number
  currentSetup:     string
  primaryGoal:      string
  recommendedTier:  string
  recommendedPrice: number
  breakEvenDays:    number
  yearOneProfit:    number
}

const VERTICAL_LABELS: Record<string, string> = {
  roofing:       'Roofing',
  hvac:          'HVAC',
  plumbing:      'Plumbing',
  dental:        'Dental',
  legal:         'Legal',
  'real-estate': 'Real Estate',
  insurance:     'Insurance',
  saas:          'SaaS',
  wholesale:     'Wholesale',
}

const SETUP_LABELS: Record<string, string> = {
  voicemail:        'Voicemail only',
  answering_service:'Third-party answering service',
  employee:         'Another employee picks up',
  nothing:          'Calls go unanswered',
  other:            'Other',
}

const GOAL_LABELS: Record<string, string> = {
  stop_missing_calls: 'Stop missing calls entirely',
  book_more_jobs:     'Book more jobs without more staff',
  better_followup:    'Automate follow-up and nurture',
  all:                'All of the above',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ReportPayload

    const industry    = VERTICAL_LABELS[body.vertical] ?? body.vertical
    const setupLabel  = SETUP_LABELS[body.currentSetup]  ?? body.currentSetup
    const goalLabel   = GOAL_LABELS[body.primaryGoal]    ?? body.primaryGoal

    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
      to:      body.email,
      replyTo: 'chris@369agenticsystems.com',
      subject: `Your ${industry} ROI Report — ${body.businessName}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Inter,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">

  <!-- Header -->
  <div style="margin-bottom:32px;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D4AF37;font-family:monospace;">
      369 Agentic Systems
    </p>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">
      Your Custom ROI Report
    </h1>
    <p style="margin:0;font-size:14px;color:#64748B;">${body.businessName} · ${industry} Industry</p>
  </div>

  <!-- Big number -->
  <div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);border-radius:12px;padding:28px 24px;margin-bottom:20px;">
    <p style="margin:0 0 8px;font-size:10px;font-family:monospace;letter-spacing:0.15em;text-transform:uppercase;color:#F87171;">
      Estimated Annual Revenue Being Lost Right Now
    </p>
    <p style="margin:0 0 8px;font-size:48px;font-weight:800;color:#FCA5A5;letter-spacing:-0.02em;line-height:1;">
      $${body.annualLost.toLocaleString()}
    </p>
    <p style="margin:0;font-size:12px;color:#64748B;">
      Based on ${body.callsPerWeek} calls/week · ${body.answerRate}% answer rate · $${body.jobValue.toLocaleString()} avg job value
    </p>
  </div>

  <!-- 3 metric cards -->
  <div style="display:grid;gap:12px;margin-bottom:28px;">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;color:#94A3B8;">Monthly revenue lost</span>
      <span style="font-size:18px;font-weight:700;color:#FCA5A5;font-family:monospace;">$${body.monthlyLost.toLocaleString()}</span>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;color:#94A3B8;">Recoverable per month (conservative)</span>
      <span style="font-size:18px;font-weight:700;color:#86EFAC;font-family:monospace;">$${body.monthlyRecoverable.toLocaleString()}</span>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;color:#94A3B8;">Break-even on ${body.recommendedTier} plan</span>
      <span style="font-size:18px;font-weight:700;color:#D4AF37;font-family:monospace;">${body.breakEvenDays} days</span>
    </div>
  </div>

  <!-- Recommended plan -->
  <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.25);border-radius:12px;padding:24px;margin-bottom:28px;">
    <p style="margin:0 0 6px;font-size:10px;font-family:monospace;letter-spacing:0.15em;text-transform:uppercase;color:#D4AF37;">
      Recommended Plan
    </p>
    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#FFFFFF;">${body.recommendedTier} — $${body.recommendedPrice}/mo</p>
    <p style="margin:0 0 16px;font-size:12px;color:#64748B;">
      Year-1 net profit after all fees: <strong style="color:#4ADE80;">$${body.yearOneProfit.toLocaleString()}</strong>
    </p>
    <a href="https://369agenticsystems.com/${body.vertical}/pricing?tier=${body.recommendedTier}"
       style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">
      Secure Your Spot →
    </a>
  </div>

  <!-- Their situation -->
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:20px 22px;margin-bottom:28px;">
    <p style="margin:0 0 12px;font-size:10px;font-family:monospace;letter-spacing:0.15em;text-transform:uppercase;color:#475569;">Your Current Situation</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:4px 0;font-size:12px;color:#64748B;width:180px;">Current phone setup</td><td style="font-size:12px;color:#F0F0F0;">${setupLabel}</td></tr>
      <tr><td style="padding:4px 0;font-size:12px;color:#64748B;">Primary goal</td><td style="font-size:12px;color:#F0F0F0;">${goalLabel}</td></tr>
      <tr><td style="padding:4px 0;font-size:12px;color:#64748B;">Calls per week</td><td style="font-size:12px;color:#F0F0F0;">${body.callsPerWeek}</td></tr>
      <tr><td style="padding:4px 0;font-size:12px;color:#64748B;">Current answer rate</td><td style="font-size:12px;color:#F0F0F0;">${body.answerRate}%</td></tr>
      <tr><td style="padding:4px 0;font-size:12px;color:#64748B;">Average job value</td><td style="font-size:12px;color:#F0F0F0;">$${body.jobValue.toLocaleString()}</td></tr>
    </table>
  </div>

  <!-- Guarantee -->
  <div style="padding:16px 20px;background:rgba(74,222,128,0.04);border:1px solid rgba(74,222,128,0.15);border-radius:10px;margin-bottom:28px;">
    <p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">
      🛡 <strong style="color:#4ADE80;">30-Day Results Guarantee</strong> — If you don't capture a lead you would have otherwise missed within 30 days, we refund your setup fee. No questions asked.
    </p>
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:32px;">
    <p style="margin:0 0 16px;font-size:14px;color:#94A3B8;">Ready to stop leaving money on the table?</p>
    <a href="https://369agenticsystems.com/${body.vertical}/pricing?tier=${body.recommendedTier}"
       style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
      Get Started — ${body.recommendedTier} Plan
    </a>
    <p style="margin:12px 0 0;font-size:11px;color:#334155;font-family:monospace;">
      Or reply to this email — we'll get back to you within 2 hours.
    </p>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;color:#334155;font-family:monospace;">
      369 Agentic Systems · chris@369agenticsystems.com
    </p>
    <p style="margin:0;font-size:10px;color:#1E293B;">
      This report was generated from the numbers you provided. Results may vary.
    </p>
  </div>

</div>
</body>
</html>
      `,
    })

    if (error) {
      console.error('[ROI REPORT] Resend error:', error)
      return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
    }

    // Also notify Chris
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
      to:      'chris@369agenticsystems.com',
      subject: `📊 ROI Report Sent: ${body.businessName} (${industry}) — $${body.annualLost.toLocaleString()}/yr at risk`,
      html: `<div style="font-family:monospace;padding:20px;background:#0A0A0A;color:#94A3B8;max-width:480px;">
        <p style="color:#D4AF37;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">New ROI Report Requested</p>
        <p style="color:#F0F0F0;font-size:16px;font-weight:700;margin:8px 0;">${body.businessName}</p>
        <p style="margin:4px 0;">Contact: ${body.ownerName} · ${body.email}</p>
        <p style="margin:4px 0;">Industry: ${industry}</p>
        <p style="margin:4px 0;">Annual at risk: <strong style="color:#FCA5A5;">$${body.annualLost.toLocaleString()}</strong></p>
        <p style="margin:4px 0;">Recommended: ${body.recommendedTier} ($${body.recommendedPrice}/mo)</p>
        <p style="margin:4px 0;">Current setup: ${setupLabel}</p>
        <p style="margin:4px 0;">Goal: ${goalLabel}</p>
      </div>`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ROI REPORT] Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

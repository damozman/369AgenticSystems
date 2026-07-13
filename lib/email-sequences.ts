import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const OWNER_EMAIL = 'chris@369agenticsystems.com'
// 369agenticsystems.com (root domain) was never added/verified in Resend — every
// send from it has failed silently since inception. alerts.369agenticsystems.com
// is the actual verified sending domain.
const FROM        = '369 Agentic Systems <chris@alerts.369agenticsystems.com>'

// ── Tier feature lists for emails (rebranded Retell feature names) ────────────

const TIER_EMAIL_FEATURES: Record<string, string[]> = {
  Starter: [
    '24/7 AI Receptionist',
    'Crystal Clear Call Quality (HD voice via Retell AI — $25/mo value, included free)',
    'Real-time lead capture dashboard',
    'Email booking confirmations',
    'Daily performance summaries',
  ],
  Pro: [
    '24/7 AI Receptionist',
    'Crystal Clear Call Quality (HD voice via Retell AI — $25/mo value, included free)',
    'Lead Follow-up Agent — automated nurture until they convert',
    'Real-time lead capture dashboard',
    'Conversion tracking & advanced reporting',
  ],
  Elite: [
    '24/7 AI Receptionist',
    'Crystal Clear Call Quality (HD voice via Retell AI — $25/mo value, included free)',
    'Lead Follow-up Agent',
    'Review Request Agent — turns completed jobs into 5-star reviews',
    'Custom Business Intelligence (Retell caller analytics — $49/mo value, included free)',
    'Real-time dashboard + priority support',
  ],
}

// ── Vertical copy ─────────────────────────────────────────────────────────────

const VERTICAL_COPY: Record<string, { label: string; tagline: string }> = {
  roofing:  { label: 'Roofing',  tagline: 'Never lose another job to a missed call.' },
  hvac:     { label: 'HVAC',     tagline: 'Emergency calls answered 24/7.' },
  plumbing: { label: 'Plumbing', tagline: 'Burst pipes at 2 AM? We answer.' },
  dental:   { label: 'Dental',   tagline: 'Patient inquiries handled around the clock.' },
}

// ── Welcome email to client ───────────────────────────────────────────────────

export async function sendWelcomeEmail({
  toEmail,
  businessName,
  tier,
  vertical,
  clientDomain,
  retellPhoneNumber,
}: {
  toEmail:           string
  businessName:      string
  tier:              string
  vertical:          string
  clientDomain:      string
  retellPhoneNumber?: string
}) {
  const features = TIER_EMAIL_FEATURES[tier] ?? TIER_EMAIL_FEATURES.Starter
  const vc       = VERTICAL_COPY[vertical] ?? VERTICAL_COPY.roofing
  const agentList = features
    .map(f => `<li style="margin-bottom:6px;">✓ ${f}</li>`)
    .join('')

  const subject = `Your ${vc.label} AI Workforce is being configured — 369 Agentic Systems`

  const phoneSection = retellPhoneNumber ? `
      <div style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:12px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.12em;">
          Your Dedicated Phone Number
        </p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;font-family:monospace;letter-spacing:0.05em;">
          ${retellPhoneNumber}
        </p>
        <p style="margin:12px 0 0;font-size:12px;color:#94A3B8;">
          This number is now live and answering calls 24/7.
        </p>
      </div>
    ` : ''

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#FFFFFF;padding:40px 32px;border-radius:12px;">
      <div style="border-bottom:3px solid #D4AF37;margin-bottom:32px;padding-bottom:16px;">
        <span style="font-size:20px;font-weight:700;color:#D4AF37;">369</span>
        <span style="font-size:14px;font-weight:600;color:#FFFFFF;margin-left:6px;letter-spacing:0.05em;">AGENTIC SYSTEMS</span>
      </div>

      <p style="margin:0 0 8px;font-size:12px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.15em;">
        // ${tier.toUpperCase()} PLAN CONFIRMED
      </p>
      <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Welcome, ${businessName}
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#94A3B8;line-height:1.7;">
        ${vc.tagline} Your digital workforce is being configured now.
        Your dedicated number is live within 24 hours.
      </p>

      ${phoneSection}

      <div style="background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.4);border-radius:10px;padding:24px;margin-bottom:28px;text-align:center;">
        <p style="margin:0 0 16px;font-size:14px;color:#FFFFFF;">
          <strong>Fast-track your setup:</strong> Answer a quick questionnaire so your agent understands your business.
        </p>
        <a href="https://369agenticsystems.com/onboarding/questionnaire/${clientDomain}" style="display:inline-block;background:#D4AF37;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;transition:opacity 0.2s;">
          Complete Questionnaire (5 min)
        </a>
      </div>

      <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.2);border-radius:10px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:11px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.12em;">
          Your Active Agents — ${tier} Plan
        </p>
        <ul style="margin:0;padding:0;list-style:none;font-size:14px;color:#CBD5E1;">
          ${agentList}
        </ul>
      </div>

      <p style="margin:0 0 8px;font-size:14px;color:#64748B;line-height:1.7;">
        <strong style="color:#FFFFFF;">Next steps:</strong> We'll reach out within 24 hours to schedule
        your onboarding call and confirm configuration details.
      </p>
      <p style="margin:0 0 28px;font-size:14px;color:#64748B;line-height:1.7;">
        Questions? Reply to this email or reach us at
        <a href="mailto:${OWNER_EMAIL}" style="color:#D4AF37;">${OWNER_EMAIL}</a>
      </p>

      <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
        <p style="margin:0;font-size:11px;color:#1E293B;font-family:monospace;">
          369 Agentic Systems · ${clientDomain} · ${tier} Plan
        </p>
      </div>
    </div>
  `

  return resend.emails.send({ from: FROM, to: toEmail, subject, html })
}

// ── Owner notification ────────────────────────────────────────────────────────

export async function sendOwnerNotification({
  businessName,
  ownerName,
  email,
  phone,
  tier,
  vertical,
  clientDomain,
  monthlyRevenueLost,
}: {
  businessName:       string
  ownerName:          string
  email:              string
  phone:              string
  tier:               string
  vertical:           string
  clientDomain:       string
  monthlyRevenueLost?: number
}) {
  const vc = VERTICAL_COPY[vertical] ?? VERTICAL_COPY.roofing

  const subject = `🔔 New Client: ${businessName} — ${tier} Plan (${vc.label})`

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#FFFFFF;padding:40px 32px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.15em;">
        // NEW CLIENT SIGNED UP
      </p>
      <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#FFFFFF;">${businessName}</h1>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        ${[
          ['Owner',    ownerName],
          ['Email',    email],
          ['Phone',    phone],
          ['Vertical', vc.label],
          ['Tier',     tier],
          ['Domain',   clientDomain],
          ...(monthlyRevenueLost ? [['Revenue at risk', `$${monthlyRevenueLost.toLocaleString()}/mo`]] : []),
        ].map(([k, v]) => `
          <tr>
            <td style="padding:8px 0;color:#64748B;width:140px;">${k}</td>
            <td style="padding:8px 0;color:#FFFFFF;font-weight:500;">${v}</td>
          </tr>
        `).join('')}
      </table>

      <p style="margin:0;font-size:13px;color:#475569;">
        Log into the dashboard to review and begin configuration.
      </p>
    </div>
  `

  return resend.emails.send({ from: FROM, to: OWNER_EMAIL, subject, html })
}

// ── Auto-activation upgrade nudge to client ───────────────────────────────────

export async function sendUpgradeNudge({
  toEmail,
  businessName,
  currentTier,
  suggestedTier,
  reason,
  vertical,
}: {
  toEmail:       string
  businessName:  string
  currentTier:   string
  suggestedTier: string
  reason:        string
  vertical:      string
}) {
  const subject = `${businessName}: You've outgrown your ${currentTier} plan`

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#FFFFFF;padding:40px 32px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.15em;">
        // UPGRADE RECOMMENDATION
      </p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#FFFFFF;">
        Time to upgrade, ${businessName}
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:#94A3B8;line-height:1.7;">
        ${reason}
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#CBD5E1;line-height:1.7;">
        Your next tier is <strong style="color:#D4AF37;">${suggestedTier}</strong> — reply to this email
        and we'll upgrade your account same-day. No contract changes, just a simple tier bump.
      </p>
      <p style="margin:0;font-size:13px;color:#475569;">
        Questions? Reply here or email
        <a href="mailto:${OWNER_EMAIL}" style="color:#D4AF37;">${OWNER_EMAIL}</a>
      </p>
    </div>
  `

  return resend.emails.send({ from: FROM, to: toEmail, subject, html })
}

// ── Monthly ROI Report to Client ─────────────────────────────────────────────

export async function sendMonthlyROIReport({
  toEmail,
  businessName,
  tier,
  vertical,
  callsThisMonth,
  appointmentsBooked,
  leadsCaptured,
  jobValue,
  monthlyFee,
}: {
  toEmail: string
  businessName: string
  tier: string
  vertical: string
  callsThisMonth: number
  appointmentsBooked: number
  leadsCaptured: number
  jobValue: number
  monthlyFee: number
}) {
  const totalOpportunities = appointmentsBooked + leadsCaptured
  const closeRate = 0.30 // Conservative 30% close rate
  const estimatedRevenue = Math.round(totalOpportunities * jobValue * closeRate)
  const roi = monthlyFee > 0 ? Math.round((estimatedRevenue / monthlyFee) * 100) : 0
  const netProfit = estimatedRevenue - monthlyFee

  const vc = VERTICAL_COPY[vertical] ?? { label: vertical, tagline: '' }
  const subject = `${businessName}: Your AI Receptionist ROI Report — ${estimatedRevenue ? `$${estimatedRevenue.toLocaleString()} Protected` : 'Report Inside'}`

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#FFFFFF;padding:40px 32px;border-radius:12px;">
      <div style="border-bottom:3px solid #D4AF37;margin-bottom:32px;padding-bottom:16px;">
        <span style="font-size:20px;font-weight:700;color:#D4AF37;">369</span>
        <span style="font-size:14px;font-weight:600;color:#FFFFFF;margin-left:6px;letter-spacing:0.05em;">AGENTIC SYSTEMS</span>
      </div>

      <p style="margin:0 0 8px;font-size:12px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.15em;">
        // MONTHLY ROI REPORT
      </p>
      <h1 style="margin:0 0 24px;font-size:28px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        ${businessName}: You protected <span style="color:#D4AF37;">$${estimatedRevenue.toLocaleString()}</span> this month
      </h1>

      <div style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:10px;padding:20px;margin-bottom:32px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="border-bottom:1px solid rgba(212,175,55,0.2);">
            <td style="padding:12px 0;color:#CBD5E1;">Total calls answered</td>
            <td style="padding:12px 0;color:#FFFFFF;text-align:right;font-weight:700;">${callsThisMonth}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(212,175,55,0.2);">
            <td style="padding:12px 0;color:#CBD5E1;">Appointments booked</td>
            <td style="padding:12px 0;color:#FFFFFF;text-align:right;font-weight:700;">${appointmentsBooked}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(212,175,55,0.2);">
            <td style="padding:12px 0;color:#CBD5E1;">Leads captured</td>
            <td style="padding:12px 0;color:#FFFFFF;text-align:right;font-weight:700;">${leadsCaptured}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(212,175,55,0.2);">
            <td style="padding:12px 0;color:#CBD5E1;">Avg job value</td>
            <td style="padding:12px 0;color:#FFFFFF;text-align:right;font-weight:700;">$${jobValue.toLocaleString()}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(212,175,55,0.2);">
            <td style="padding:12px 0;color:#CBD5E1;font-size:13px;">Est. revenue (30% close rate)</td>
            <td style="padding:12px 0;color:#D4AF37;text-align:right;font-weight:700;font-size:13px;">$${estimatedRevenue.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;color:#CBD5E1;font-weight:700;">Your ${tier} plan cost</td>
            <td style="padding:12px 0;color:#FFFFFF;text-align:right;font-weight:700;">$${monthlyFee.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <div style="background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.4);border-radius:10px;padding:20px;margin-bottom:32px;text-align:center;">
        <p style="margin:0 0 12px;font-size:12px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.12em;">
          Return on Investment
        </p>
        <p style="margin:0 0 8px;font-size:40px;font-weight:700;color:#D4AF37;line-height:1;">
          ${roi}x
        </p>
        <p style="margin:0;font-size:13px;color:#94A3B8;">
          For every dollar you spend, you protect ${roi}x in potential revenue
        </p>
      </div>

      <p style="margin:0 0 24px;font-size:14px;color:#CBD5E1;line-height:1.8;">
        <strong style="color:#D4AF37;">${totalOpportunities} qualified leads</strong> were captured by your AI receptionist this month.
        With a ${Math.round(closeRate * 100)}% close rate, that's approximately
        <strong style="color:#D4AF37;">$${estimatedRevenue.toLocaleString()} in revenue protected</strong> —
        against your ${monthlyFee > 0 ? `$${monthlyFee.toLocaleString()} monthly investment` : 'setup cost'}.
      </p>

      <p style="margin:0 0 24px;font-size:13px;color:#64748B;line-height:1.7;">
        📊 <strong>Trend:</strong> These numbers compound. As your team learns from the AI's interactions, close rates typically improve 5–15% within 3 months. More questions? Reply here or email ${OWNER_EMAIL}.
      </p>

      <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
        <p style="margin:0;font-size:11px;color:#1E293B;font-family:monospace;">
          369 Agentic Systems · ${businessName} · ${tier} Plan · ${vc.label}
        </p>
      </div>
    </div>
  `

  return resend.emails.send({ from: FROM, to: toEmail, subject, html })
}

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const OWNER_EMAIL = 'chris@369agenticsystems.com'
const FROM        = '369 Agentic Systems <chris@369agenticsystems.com>'

// ── Tier feature lists for emails (rebranded Retell feature names) ────────────

const TIER_EMAIL_FEATURES: Record<string, string[]> = {
  Starter: [
    '24/7 AI Receptionist',
    'Crystal Clear Call Quality (HD voice via Retell AI — $25/mo value, included free)',
    'Real-time lead capture dashboard',
    'SMS booking confirmations',
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
}: {
  toEmail:      string
  businessName: string
  tier:         string
  vertical:     string
  clientDomain: string
}) {
  const features = TIER_EMAIL_FEATURES[tier] ?? TIER_EMAIL_FEATURES.Starter
  const vc       = VERTICAL_COPY[vertical] ?? VERTICAL_COPY.roofing
  const agentList = features
    .map(f => `<li style="margin-bottom:6px;">✓ ${f}</li>`)
    .join('')

  const subject = `Your ${vc.label} AI Workforce is being configured — 369 Agentic Systems`

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
        We'll have everything live within 5–7 business days.
      </p>

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

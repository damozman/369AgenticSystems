import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const resend    = new Resend(process.env.RESEND_API_KEY)

const OWNER_EMAIL = 'chris@369agenticsystems.com'
const FROM        = 'Nova · 369 Agentic Systems <chris@369agenticsystems.com>'

export type NovaVertical = 'roofing' | 'hvac' | 'plumbing'

const VERTICAL_COPY: Record<NovaVertical, { label: string; accentColor: string; visitNoun: string }> = {
  roofing:  { label: 'Roofing',  accentColor: '#FF4500', visitNoun: 'inspection' },
  hvac:     { label: 'HVAC',     accentColor: '#FF6533', visitNoun: 'service visit' },
  plumbing: { label: 'Plumbing', accentColor: '#0369A1', visitNoun: 'service visit' },
}

function systemPromptFor(vertical: NovaVertical): string {
  const vc = VERTICAL_COPY[vertical]
  return `You are Nova, a pre-visit communications specialist for a ${vc.label.toLowerCase()} company. ` +
    `Write a short, warm email to a customer confirming their upcoming ${vc.visitNoun}. ` +
    `Write exactly 3 short paragraphs, plain text (no bullet points, no markdown, no headers): ` +
    `1) confirm the appointment and thank them, 2) briefly explain how to prepare for the visit, ` +
    `3) reassure them about what to expect and that questions are welcome. ` +
    `Total length 150-200 words. Do not include a subject line, greeting salutation placeholder, or signature — ` +
    `just the 3 paragraphs of body copy.`
}

export interface GenerateNovaEmailInput {
  vertical:         NovaVertical
  callerName?:      string
  serviceType?:     string
  appointmentDate:  string
  appointmentTime:  string
  location?:        string
}

export async function generateNovaEmailBody(input: GenerateNovaEmailInput): Promise<string> {
  const name = input.callerName ? input.callerName.split(' ')[0] : 'there'
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: systemPromptFor(input.vertical),
    messages: [
      {
        role: 'user',
        content: `Customer name: ${name}
Service type: ${input.serviceType ?? 'general service'}
Appointment: ${input.appointmentDate} at ${input.appointmentTime}
Location: ${input.location ?? 'the address on file'}

Write the 3-paragraph email body now.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export interface NovaEmailInput extends GenerateNovaEmailInput {
  toEmail:      string
  clientDomain: string
}

export async function sendNovaBookingEmail(input: NovaEmailInput) {
  const vc = VERTICAL_COPY[input.vertical] ?? VERTICAL_COPY.roofing
  const bodyText = await generateNovaEmailBody(input)
  const name = input.callerName ? input.callerName.split(' ')[0] : 'there'

  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 16px;font-size:15px;color:#94A3B8;line-height:1.7;">${p}</p>`)
    .join('')

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#FFFFFF;padding:40px 32px;border-radius:12px;">
      <div style="border-bottom:3px solid ${vc.accentColor};margin-bottom:32px;padding-bottom:16px;">
        <span style="font-size:20px;font-weight:700;color:${vc.accentColor};">369</span>
        <span style="font-size:14px;font-weight:600;color:#FFFFFF;margin-left:6px;letter-spacing:0.05em;">AGENTIC SYSTEMS</span>
      </div>

      <p style="margin:0 0 8px;font-size:12px;font-family:monospace;color:${vc.accentColor};text-transform:uppercase;letter-spacing:0.15em;">
        // ${vc.label.toUpperCase()} · APPOINTMENT CONFIRMED
      </p>
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#FFFFFF;line-height:1.3;">
        Hi ${name}, you're all set
      </h1>

      <div style="background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#64748B;width:100px;">Date</td><td style="padding:6px 0;color:#FFFFFF;font-weight:500;">${input.appointmentDate}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Time</td><td style="padding:6px 0;color:#FFFFFF;font-weight:500;">${input.appointmentTime}</td></tr>
          ${input.serviceType ? `<tr><td style="padding:6px 0;color:#64748B;">Service</td><td style="padding:6px 0;color:#FFFFFF;font-weight:500;">${input.serviceType}</td></tr>` : ''}
          ${input.location ? `<tr><td style="padding:6px 0;color:#64748B;">Location</td><td style="padding:6px 0;color:#FFFFFF;font-weight:500;">${input.location}</td></tr>` : ''}
        </table>
      </div>

      ${paragraphs}

      <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#64748B;">
          — Nova, Intelligence + Delivery · 369 Agentic Systems
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:#1E293B;font-family:monospace;">
          ${input.clientDomain}
        </p>
      </div>
    </div>
  `

  return resend.emails.send({
    from:    FROM,
    to:      input.toEmail,
    replyTo: OWNER_EMAIL,
    subject: `Your ${vc.label.toLowerCase()} ${vc.visitNoun} is confirmed`,
    html,
  })
}

/** SMS estimate stub — logs instead of sending. Replace with a real Twilio call once TWILIO_* env vars exist. */
export async function sendNovaEstimateSMS(to: string, body: string): Promise<void> {
  console.log(`[SMS STUB] → ${to}: ${body}`)
}

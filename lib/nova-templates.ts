import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const resend    = new Resend(process.env.RESEND_API_KEY)

const OWNER_EMAIL = 'chris@369agenticsystems.com'
// 369agenticsystems.com (root domain) was never added/verified in Resend — every
// send from it has failed silently since inception. alerts.369agenticsystems.com
// is the actual verified sending domain.
const FROM        = 'Nova · 369 Agentic Systems <chris@alerts.369agenticsystems.com>'

export type NovaVertical =
  | 'roofing' | 'hvac' | 'plumbing' | 'legal' | 'real-estate' | 'insurance' | 'saas' | 'wholesale' | 'dental'
  | 'event-rentals' | 'dumpster-rental' | 'equipment-rental'
  /**
   * The honest answer when we do not know the trade. Never a guess at one.
   *
   * This exists because the fallback used to be `roofing`, which does not fail — it sends a
   * fluent, confident email telling someone their bounce-house hire is an "inspection", signed by
   * a Nova who says she writes for a roofing company. Nothing errors and no test call catches it;
   * only reading the email does. Same defect shape as `capture_lead`'s vertical enum and Ava's
   * `item` parameter: **a required value with no truthful option produces a false one.**
   */
  | 'unknown'

// Colors match the vertical palette used everywhere else (CLAUDE.md, Rex's VERTICAL_COPY).
// visitNoun terms match the exact examples already given to Ava in the live book_appointment
// tool description ('Legal consultation', 'Product demo') where one exists, for consistency.
const VERTICAL_COPY: Record<NovaVertical, { label: string; accentColor: string; visitNoun: string }> = {
  roofing:      { label: 'Roofing',     accentColor: '#FF4500', visitNoun: 'inspection' },
  hvac:         { label: 'HVAC',        accentColor: '#FF6533', visitNoun: 'service visit' },
  plumbing:     { label: 'Plumbing',    accentColor: '#0369A1', visitNoun: 'service visit' },
  legal:        { label: 'Legal',       accentColor: '#60A5FA', visitNoun: 'consultation' },
  'real-estate':{ label: 'Real Estate', accentColor: '#0EA5E9', visitNoun: 'showing' },
  insurance:    { label: 'Insurance',   accentColor: '#14B8A6', visitNoun: 'policy review' },
  saas:         { label: 'SaaS',        accentColor: '#8B5CF6', visitNoun: 'demo' },
  wholesale:    { label: 'Wholesale',   accentColor: '#84CC16', visitNoun: 'consultation' },
  dental:       { label: 'Dental',      accentColor: '#EC4899', visitNoun: 'appointment' },

  // A hire is not a visit. "Delivery" is the moment the customer actually cares about and the one
  // the booking holds the unit for; calling it an inspection or a consultation describes a
  // different transaction entirely.
  'event-rentals':    { label: 'Event Rentals',    accentColor: '#D4AF37', visitNoun: 'rental delivery' },
  'dumpster-rental':  { label: 'Dumpster Rental',  accentColor: '#0369A1', visitNoun: 'delivery' },
  'equipment-rental': { label: 'Equipment Rental', accentColor: '#84CC16', visitNoun: 'equipment delivery' },

  // Neutral on purpose: gold is the house accent, and "appointment" claims no trade.
  unknown:      { label: '',            accentColor: '#D4AF37', visitNoun: 'appointment' },
}

function systemPromptFor(vertical: NovaVertical): string {
  const vc = VERTICAL_COPY[vertical]

  // With no trade known, Nova must not invent one — no industry noun, and no advice about
  // preparing for a visit whose nature she cannot know. She confirms and offers to help.
  const who = vertical === 'unknown'
    ? 'You are Nova, a customer communications specialist writing on behalf of a local business. ' +
      'You do NOT know what industry they are in — never name, guess at, or imply a trade, and ' +
      'never describe what will happen on site beyond what the booking details below state.'
    : `You are Nova, a pre-visit communications specialist for a ${vc.label.toLowerCase()} company.`

  const middle = vertical === 'unknown'
    ? '2) restate the date, time and location exactly as given so they can check it, '
    : '2) briefly explain how to prepare for the visit, '

  return `${who} ` +
    `Write a short, warm email to a customer confirming their upcoming ${vc.visitNoun}. ` +
    `Write exactly 3 short paragraphs, plain text (no bullet points, no markdown, no headers): ` +
    `1) confirm the appointment and thank them, ${middle}` +
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
  // Falls back to the trade-neutral template, never to roofing. An unrecognised vertical is a
  // thing we do not know, and roofing copy states it as a fact to somebody's customer.
  const vc = VERTICAL_COPY[input.vertical] ?? VERTICAL_COPY.unknown
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

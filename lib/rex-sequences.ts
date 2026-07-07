import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const OWNER_EMAIL = 'chris@369agenticsystems.com'
const FROM        = 'Rex · 369 Agentic Systems <chris@369agenticsystems.com>'

export type RexVertical = 'roofing' | 'hvac' | 'plumbing'

interface VerticalCopy {
  label:       string
  accentColor: string
  issueNoun:   string // how we refer to "the issue" in copy, e.g. "roof damage"
  step0: { subject: string; hook: string }
  step1: { subject: string; hook: string }
  step2: { subject: string; hook: string }
}

const VERTICAL_COPY: Record<RexVertical, VerticalCopy> = {
  roofing: {
    label: 'Roofing', accentColor: '#FF4500', issueNoun: 'roof damage',
    step0: { subject: "We've got your roof damage on file", hook: "we've logged the details and a specialist will be reaching out shortly to schedule your inspection." },
    step1: { subject: 'Roof damage rarely waits — a quick follow-up', hook: 'roof damage from storms tends to get worse, not better, the longer it sits. Water intrusion and structural issues compound fast.' },
    step2: { subject: 'Last check-in on your roof inspection', hook: "we don't want to keep bothering you, so this is our final check-in. If you'd still like to get your inspection scheduled, just reply YES and we'll get you on the calendar." },
  },
  hvac: {
    label: 'HVAC', accentColor: '#FF6533', issueNoun: 'system issue',
    step0: { subject: "We've got your HVAC request on file", hook: "we've logged the details and a technician will be reaching out shortly to schedule your service call." },
    step1: { subject: 'Still need that HVAC issue resolved?', hook: 'system issues rarely resolve on their own, and small problems tend to turn into bigger repair bills the longer they run.' },
    step2: { subject: 'Last check-in on your HVAC service', hook: "we don't want to keep bothering you, so this is our final check-in. If you'd still like your service call scheduled, just reply YES and we'll get you on the calendar." },
  },
  plumbing: {
    label: 'Plumbing', accentColor: '#0369A1', issueNoun: 'plumbing issue',
    step0: { subject: "We've got your plumbing request on file", hook: "we've logged the details and a plumber will be reaching out shortly to schedule your service call." },
    step1: { subject: 'Still need that plumbing issue fixed?', hook: 'plumbing issues rarely stay small — leaks and clogs tend to get worse (and more expensive) the longer they run.' },
    step2: { subject: 'Last check-in on your plumbing service', hook: "we don't want to keep bothering you, so this is our final check-in. If you'd still like your service call scheduled, just reply YES and we'll get you on the calendar." },
  },
}

export interface RexSequenceEmailInput {
  toEmail:      string
  callerName?:  string
  vertical:     RexVertical
  clientDomain: string
}

function wrapEmail(accentColor: string, label: string, stepTag: string, bodyHtml: string, clientDomain: string): string {
  return `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#FFFFFF;padding:40px 32px;border-radius:12px;">
      <div style="border-bottom:3px solid ${accentColor};margin-bottom:32px;padding-bottom:16px;">
        <span style="font-size:20px;font-weight:700;color:${accentColor};">369</span>
        <span style="font-size:14px;font-weight:600;color:#FFFFFF;margin-left:6px;letter-spacing:0.05em;">AGENTIC SYSTEMS</span>
      </div>

      <p style="margin:0 0 8px;font-size:12px;font-family:monospace;color:${accentColor};text-transform:uppercase;letter-spacing:0.15em;">
        // ${label.toUpperCase()} · ${stepTag}
      </p>

      ${bodyHtml}

      <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;margin-top:28px;">
        <p style="margin:0;font-size:13px;color:#64748B;">
          — Rex, Follow-up Agent · 369 Agentic Systems
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:#1E293B;font-family:monospace;">
          ${clientDomain}
        </p>
      </div>
    </div>
  `
}

function greetingName(callerName?: string): string {
  return callerName ? callerName.split(' ')[0] : 'there'
}

async function sendStepEmail(step: 0 | 1 | 2, input: RexSequenceEmailInput) {
  const vc = VERTICAL_COPY[input.vertical] ?? VERTICAL_COPY.roofing
  const copy = step === 0 ? vc.step0 : step === 1 ? vc.step1 : vc.step2
  const name = greetingName(input.callerName)

  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#FFFFFF;line-height:1.3;">
      Hi ${name},
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#94A3B8;line-height:1.7;">
      ${copy.hook}
    </p>
    ${step === 2 ? `
    <p style="margin:0 0 20px;font-size:15px;color:#94A3B8;line-height:1.7;">
      No pressure either way — just reply and let us know.
    </p>` : `
    <p style="margin:0 0 20px;font-size:15px;color:#94A3B8;line-height:1.7;">
      Reply to this email any time with a good time to reach you, or if anything's changed.
    </p>`}
  `

  return resend.emails.send({
    from:    FROM,
    to:      input.toEmail,
    replyTo: OWNER_EMAIL,
    subject: copy.subject,
    html:    wrapEmail(vc.accentColor, vc.label, `STEP ${step}`, body, input.clientDomain),
  })
}

export const sendRexStep0Email = (input: RexSequenceEmailInput) => sendStepEmail(0, input)
export const sendRexStep1Email = (input: RexSequenceEmailInput) => sendStepEmail(1, input)
export const sendRexStep2Email = (input: RexSequenceEmailInput) => sendStepEmail(2, input)

// ── SMS (stubbed — no Twilio yet) ─────────────────────────────────────────────
// Strings only; not sent anywhere until Twilio is wired in (see build brief for the swap).

export const REX_SMS_TEMPLATES: Record<RexVertical, { step0: string; step1: string; step2: string }> = {
  roofing: {
    step0: "This is 369 Roofing — we've got your info and a specialist will reach out shortly to schedule your inspection.",
    step1: "Just checking in — roof damage tends to get worse over time. Want us to get your inspection on the books?",
    step2: "Last check-in from us — reply YES if you'd still like your roof inspection scheduled.",
  },
  hvac: {
    step0: "This is 369 HVAC — we've got your info and a technician will reach out shortly to schedule service.",
    step1: "Just checking in on your HVAC issue — want us to get a technician out to you?",
    step2: "Last check-in from us — reply YES if you'd still like your service call scheduled.",
  },
  plumbing: {
    step0: "This is 369 Plumbing — we've got your info and a plumber will reach out shortly to schedule service.",
    step1: "Just checking in on your plumbing issue — want us to get a plumber out to you?",
    step2: "Last check-in from us — reply YES if you'd still like your service call scheduled.",
  },
}

/** SMS stub — logs instead of sending. Replace with a real Twilio call once TWILIO_* env vars exist. */
export async function sendSMS(to: string, body: string): Promise<void> {
  console.log(`[SMS STUB] → ${to}: ${body}`)
}

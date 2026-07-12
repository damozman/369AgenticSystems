import { Resend } from 'resend'
import { sendSms } from '@/lib/twilio-sms'

const resend = new Resend(process.env.RESEND_API_KEY)

const OWNER_EMAIL = 'chris@369agenticsystems.com'
const FROM        = 'Rex · 369 Agentic Systems <chris@369agenticsystems.com>'

export type RexVertical = 'roofing' | 'hvac' | 'plumbing' | 'legal' | 'real-estate' | 'insurance' | 'saas' | 'wholesale' | 'dental'

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
  legal: {
    label: 'Legal', accentColor: '#60A5FA', issueNoun: 'case inquiry',
    step0: { subject: "We've received your case inquiry", hook: "we've got your information on file and a member of our team will be reaching out shortly to discuss your legal matter and next steps." },
    step1: { subject: 'Urgent: time may matter on your case', hook: 'legal matters often have deadlines and statutes of limitations that can affect your options. The sooner we discuss your situation, the more possibilities we have to help.' },
    step2: { subject: 'Final follow-up on your legal inquiry', hook: "we don't want to be a bother, but legal timing matters. If you'd still like to discuss your case, just reply and we'll get you connected with someone today." },
  },
  'real-estate': {
    label: 'Real Estate', accentColor: '#0EA5E9', issueNoun: 'property inquiry',
    step0: { subject: "We've got your property inquiry", hook: "we've logged your information and a real estate specialist will be reaching out shortly to discuss your needs." },
    step1: { subject: 'Great opportunities move fast', hook: 'in real estate, timing is everything. The right properties move fast, and qualified buyers are always in demand. Let us know if you want to discuss further.' },
    step2: { subject: 'Last message about your real estate goals', hook: "we don't want to keep reaching out, but we'd hate to see you miss the right opportunity. Reply YES if you'd like to connect with our team." },
  },
  insurance: {
    label: 'Insurance', accentColor: '#14B8A6', issueNoun: 'coverage inquiry',
    step0: { subject: "We've got your insurance inquiry on file", hook: "we've received your information and an insurance specialist will be reaching out shortly to discuss your coverage needs and get you a quote." },
    step1: { subject: 'Protect yourself now: quick follow-up', hook: 'coverage gaps can be expensive. The longer you wait to lock in the right protection, the riskier things get. Let us find the right fit for you.' },
    step2: { subject: 'Last check-in on your coverage', hook: "we don't want to keep bothering you, but protection should not wait. Reply YES and we'll get your quote locked in today." },
  },
  saas: {
    label: 'SaaS', accentColor: '#8B5CF6', issueNoun: 'product inquiry',
    step0: { subject: "We've got your product inquiry", hook: "we've logged your interest and someone from our team will be reaching out shortly to show you how we solve your problem." },
    step1: { subject: 'Time-to-value matters: quick follow-up', hook: 'every day you wait is a day you are not getting results. The sooner we get you set up, the sooner you see ROI. Let us know if you want to chat.' },
    step2: { subject: 'Last offer on getting you started', hook: "we don't want to keep reaching out, but we'd love to help you solve this. Reply YES and let's get you running this week." },
  },
  wholesale: {
    label: 'Wholesale', accentColor: '#84CC16', issueNoun: 'order inquiry',
    step0: { subject: "We've got your order inquiry", hook: "we've logged the details and someone from our team will be reaching out shortly to confirm availability and process your order." },
    step1: { subject: 'Stock is limited: fast follow-up', hook: 'inventory moves quickly, especially for popular items. If you need these units, we should lock this in now before stock runs out.' },
    step2: { subject: 'Last check-in on your order', hook: "we don't want to keep bothering you, but availability is dropping. Reply YES if you'd like us to hold your order." },
  },
  dental: {
    label: 'Dental', accentColor: '#EC4899', issueNoun: 'appointment request',
    step0: { subject: "We've got your appointment request", hook: "we've received your request and our office will be reaching out shortly to confirm your appointment time." },
    step1: { subject: 'Dental health should not wait: reminder', hook: 'putting off dental care often leads to bigger problems down the road. The sooner you get in, the easier and less expensive treatment becomes.' },
    step2: { subject: 'Last check-in on your appointment', hook: "we don't want to keep bothering you, but your health matters. Reply YES and let's get you on the books today." },
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
  legal: {
    step0: "This is 369 Legal — we've got your inquiry and someone will reach out shortly to discuss your case.",
    step1: "Legal timing matters — deadlines can affect your options. Want to talk about your case?",
    step2: "Last check-in from us — reply YES if you'd still like to discuss your legal matter today.",
  },
  'real-estate': {
    step0: "This is 369 Real Estate — we've got your inquiry and a specialist will reach out to discuss your goals.",
    step1: "Great opportunities move fast — want us to help you find the right property or buyer?",
    step2: "Last check-in from us — reply YES if you'd like to explore your real estate options today.",
  },
  insurance: {
    step0: "This is 369 Insurance — we've got your inquiry and someone will reach out shortly with a quote.",
    step1: "Protect yourself now — want us to review your coverage options?",
    step2: "Last check-in from us — reply YES if you'd like to lock in your quote today.",
  },
  saas: {
    step0: "This is 369 SaaS — we've got your inquiry and someone will reach out shortly to show you how we help.",
    step1: "Every day you wait is lost ROI — want to chat about getting started?",
    step2: "Last check-in from us — reply YES and let's get you up and running this week.",
  },
  wholesale: {
    step0: "This is 369 Wholesale — we've got your order inquiry and will reach out to confirm availability.",
    step1: "Inventory moves fast — want us to hold your order before stock runs out?",
    step2: "Last check-in from us — reply YES if you'd like us to lock in your order today.",
  },
  dental: {
    step0: "This is 369 Dental — we've got your appointment request and will reach out to confirm your time.",
    step1: "Your health matters — do not put off dental care. Want to lock in your appointment?",
    step2: "Last check-in from us — reply YES and let's get you scheduled today.",
  },
}

/**
 * Send SMS via Twilio (or stub if not configured)
 * Used for Pro/Elite follow-up sequences
 */
export async function sendSMS(to: string, body: string, trackingId?: string): Promise<boolean> {
  const result = await sendSms({ toPhone: to, message: body, trackingId })
  return result.success
}

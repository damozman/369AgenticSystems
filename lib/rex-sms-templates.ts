/**
 * Rex SMS templates for all 9 verticals
 * Condensed versions of email sequences for SMS (160 char limit)
 */

export type RexVertical = 'roofing' | 'hvac' | 'plumbing' | 'legal' | 'real-estate' | 'insurance' | 'saas' | 'wholesale' | 'dental'

interface VerticalSmsTemplates {
  label: string
  step0: string  // Acknowledgment
  step1: string  // Urgency reminder
  step2: string  // Final call-to-action
}

export const REX_SMS_TEMPLATES: Record<RexVertical, VerticalSmsTemplates> = {
  roofing: {
    label: 'Roofing',
    step0: "We've got your roof damage on file. A specialist will reach out shortly.",
    step1: "Roof damage gets worse, not better. Storm damage + water intrusion = big repair bills. Ready to schedule?",
    step2: "Last check-in: Your roof inspection. Ready to move forward? Reply YES.",
  },
  hvac: {
    label: 'HVAC',
    step0: "We've logged your HVAC request. A technician will call shortly to schedule.",
    step1: "HVAC issues get worse and more expensive the longer they run. Ready to fix it?",
    step2: "Final check-in: Your HVAC service. Ready to schedule? Reply YES.",
  },
  plumbing: {
    label: 'Plumbing',
    step0: "We've got your plumbing request. A plumber will call shortly to schedule.",
    step1: "Leaks and clogs get worse and more expensive. Don't wait. Ready to fix it?",
    step2: "Final check-in: Your plumbing service. Ready to schedule? Reply YES.",
  },
  legal: {
    label: 'Legal',
    step0: "We've received your case inquiry. Our team will reach out shortly.",
    step1: "Legal matters have deadlines. Time matters. Ready to discuss your case?",
    step2: "Final follow-up: Your legal matter. Deadlines matter. Ready to discuss? Reply YES.",
  },
  'real-estate': {
    label: 'Real Estate',
    step0: "We've got your property inquiry. A specialist will reach out shortly.",
    step1: "Great properties move fast. Qualified buyers are always in demand. Interested?",
    step2: "Last message: Your real estate goals. Don't miss the right opportunity. Reply YES.",
  },
  insurance: {
    label: 'Insurance',
    step0: "We've got your insurance inquiry. A specialist will reach out shortly with a quote.",
    step1: "Coverage gaps are expensive. Don't wait. Protect yourself now. Ready?",
    step2: "Final check-in: Your coverage. Protection should not wait. Ready? Reply YES.",
  },
  saas: {
    label: 'SaaS',
    step0: "We've got your inquiry. Someone from our team will reach out shortly.",
    step1: "Every day you wait is a day you're not getting results. Ready to get started?",
    step2: "Last offer: Get started this week and see ROI fast. Ready? Reply YES.",
  },
  wholesale: {
    label: 'Wholesale',
    step0: "We've got your order inquiry. Our team will reach out shortly to confirm.",
    step1: "Stock is limited and moves fast. Lock this in now before it runs out.",
    step2: "Final check-in: Your order. Availability is dropping. Ready? Reply YES.",
  },
  dental: {
    label: 'Dental',
    step0: "We've got your appointment request. Our office will reach out shortly.",
    step1: "Dental health should not wait. The sooner you come in, the easier treatment is.",
    step2: "Final check-in: Your appointment. Your health matters. Ready? Reply YES.",
  },
}

/**
 * Get SMS template for a specific step
 */
export function getSmsTemplate(vertical: RexVertical, step: 0 | 1 | 2): string | null {
  const templates = REX_SMS_TEMPLATES[vertical]
  if (!templates) return null

  const key = `step${step}` as 'step0' | 'step1' | 'step2'
  return templates[key] || null
}

/**
 * Validate SMS content (Twilio has length limits)
 */
export function validateSmsLength(text: string): { valid: boolean; length: number; segments: number } {
  const length = text.length
  const segments = Math.ceil(length / 160)  // SMS is 160 chars per segment

  return {
    valid: segments <= 3,  // Allow up to 3 segments (480 chars)
    length,
    segments,
  }
}

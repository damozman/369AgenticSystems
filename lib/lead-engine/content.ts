/**
 * Questionnaire answers → what the page renders.
 *
 * One rule governs this file, inherited from `lib/audit-call.ts` and the dossier: **we may shape
 * what the customer told us, we may never add what they did not.** A mini-site is a page a
 * stranger will judge a real business by, and an invented certification or a filler tagline is a
 * claim made on someone else's behalf.
 *
 * So every field is optional, absence is preserved rather than defaulted, and the templates omit
 * whole sections instead of rendering an empty frame or a placeholder.
 */

import type {
  CtaKind, FaqItem, NewPatientInfo, PracticeAccess, QuestionnaireAnswers, ServiceItem, SiteContent,
  SiteCta, TeamMember, Testimonial,
} from '@/lib/lead-engine/types'

/** Bounds. Long enough for anything real, short enough that a paste cannot wreck the layout. */
const MAX_SERVICES = 8
const MAX_SERVICE_LENGTH = 60
const MAX_AREAS = 12
const MAX_AREA_LENGTH = 40
const MAX_PROSE = 600

/** Trim, collapse whitespace, cap. Returns undefined for anything that is not usable text. */
function text(raw: unknown, max = MAX_PROSE): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.replace(/\s+/g, ' ').trim().slice(0, max).trim()
  return s.length > 0 ? s : undefined
}

/**
 * A list the customer typed, however they typed it.
 *
 * People answer "what areas do you serve?" with commas, newlines, semicolons, or "Fort Worth and
 * Arlington" — all of which are the same answer. Duplicates are dropped case-insensitively but the
 * customer's own capitalisation is kept, because "HVAC" is not "Hvac".
 */
function list(raw: unknown, maxItems: number, maxLength: number): string[] | undefined {
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;\n\r]+|\s+\band\b\s+/i)
      : []

  const seen = new Map<string, string>()
  for (const part of parts) {
    const s = text(part, maxLength)
    if (!s) continue
    const key = s.toLowerCase()
    if (!seen.has(key)) seen.set(key, s)
    if (seen.size >= maxItems) break
  }
  return seen.size > 0 ? [...seen.values()] : undefined
}

/**
 * A phone number kept as the customer wrote it, plus a `tel:` form derived from it.
 *
 * Displayed as typed — reformatting "817-635-0220" into "(817) 635-0220" is a cosmetic change to
 * something a business has printed on a truck, and getting it wrong on an international or
 * extension-bearing number is worse than leaving it alone.
 */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return `tel:${digits}`
}

/** Whether a phone number is dialable at all. A CTA that opens the dialler with nothing in it is worse than a form. */
function isDialable(phone: string | undefined): phone is string {
  return !!phone && phone.replace(/\D/g, '').length >= 7
}

const CTA_LABELS: Record<Exclude<CtaKind, 'other'>, string> = {
  call:         'Call Now',
  estimate:     'Get a Free Estimate',
  availability: 'Check Availability',
}

/**
 * Resolve the call to action into something the page can actually do.
 *
 * The one non-obvious rule: **"Call Now" degrades to the form when there is no usable phone
 * number.** A `tel:` link built from a blank field renders as a button that opens an empty dialler,
 * which looks broken on exactly the click the whole page exists to earn.
 */
export function ctaFrom(answers: QuestionnaireAnswers, phone: string | undefined): SiteCta {
  const kind = answers.primary_cta
  const custom = text(answers.primary_cta_other, 40)

  if (kind === 'other' && custom) {
    return { label: custom, kind: 'form' }
  }
  if (kind === 'call') {
    return isDialable(phone)
      ? { label: CTA_LABELS.call, kind: 'call' }
      : { label: CTA_LABELS.estimate, kind: 'form' }
  }
  if (kind === 'estimate' || kind === 'availability') {
    return { label: CTA_LABELS[kind], kind: 'form' }
  }

  // Unanswered. The form is the safe default: it works with no phone number and it is the thing
  // this product is sold to do.
  return { label: CTA_LABELS.estimate, kind: 'form' }
}

/**
 * A Google Business Profile link, or undefined.
 *
 * Only `http(s)` URLs survive. A `javascript:` or `data:` value pasted into this box would
 * otherwise become an anchor href on a public page — the customer is not the attacker here, but
 * the questionnaire is reachable with a signed link and this is one line of defence for free.
 */
export function profileUrlFrom(raw: unknown): string | undefined {
  const s = text(raw, 500)
  if (!s) return undefined
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const MAX_DESCRIPTION = 140
const MAX_TESTIMONIALS = 3
const MAX_FAQS = 6

/**
 * Services, from either shape the form may post.
 *
 * Descriptions are carried straight through and are never generated — not here, not at render.
 * A description is a claim about what a business does, and the questionnaire asks for it precisely
 * so that nothing has to invent one. A service with no description is a name on its own, which
 * layout 5b renders perfectly well.
 */
function servicesFrom(raw: unknown): ServiceItem[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const seen = new Map<string, ServiceItem>()
  for (const entry of raw) {
    const name = text(typeof entry === 'string' ? entry : (entry as ServiceItem)?.name, MAX_SERVICE_LENGTH)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    const description = typeof entry === 'object' && entry
      ? text((entry as ServiceItem).description, MAX_DESCRIPTION)
      : undefined
    seen.set(key, description ? { name, description } : { name })
    if (seen.size >= MAX_SERVICES) break
  }
  return seen.size > 0 ? [...seen.values()] : undefined
}

/** Quotes, kept whole. Trust renders nothing at all rather than a partial or invented one. */
function testimonialsFrom(raw: unknown): Testimonial[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Testimonial[] = []
  for (const entry of raw) {
    const quote = text((entry as Testimonial)?.quote, 400)
    const name  = text((entry as Testimonial)?.name, 60)
    // Both are required: an unattributed quote is indistinguishable from one we wrote ourselves.
    if (!quote || !name) continue
    out.push({
      quote, name,
      ...(text((entry as Testimonial).city, 40) ? { city: text((entry as Testimonial).city, 40)! } : {}),
      ...(text((entry as Testimonial).jobType, 40) ? { jobType: text((entry as Testimonial).jobType, 40)! } : {}),
    })
    if (out.length >= MAX_TESTIMONIALS) break
  }
  return out.length > 0 ? out : undefined
}

function faqsFrom(raw: unknown): FaqItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: FaqItem[] = []
  for (const entry of raw) {
    const question = text((entry as FaqItem)?.question, 160)
    const answer   = text((entry as FaqItem)?.answer, 600)
    if (!question || !answer) continue
    out.push({ question, answer })
    if (out.length >= MAX_FAQS) break
  }
  return out.length > 0 ? out : undefined
}

const MAX_INSURERS = 12
const MAX_TEAM = 6
const MAX_HOURS_LINES = 7

/**
 * The access facts — the four things a patient checks before ringing.
 *
 * `acceptingNewPatients` is carried across **only when it is an actual boolean**. A practice that
 * skipped the question has not said no, and it has not said yes: `undefined` renders nothing.
 * Coercing it — `!!answers.accepting_new_patients`, the obvious line — would silently turn every
 * unanswered questionnaire into "Not taking new patients right now" on a practice that is.
 */
function accessFrom(answers: QuestionnaireAnswers): PracticeAccess | undefined {
  const access: PracticeAccess = {
    ...(typeof answers.accepting_new_patients === 'boolean'
      ? { acceptingNewPatients: answers.accepting_new_patients }
      : {}),
    ...(list(answers.insurance_accepted, MAX_INSURERS, 60) ? { insuranceAccepted: list(answers.insurance_accepted, MAX_INSURERS, 60)! } : {}),
    // Hours split on lines and semicolons only — NOT on commas, because "Mon, Wed, Fri 8-5" is one
    // line and the generic list splitter would shred it into three meaningless fragments.
    ...(hoursFrom(answers.hours) ? { hours: hoursFrom(answers.hours)! } : {}),
    ...(text(answers.location, 160) ? { location: text(answers.location, 160)! } : {}),
  }
  return Object.keys(access).length > 0 ? access : undefined
}

function hoursFrom(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string') return undefined
  const lines = raw.split(/[;\n\r]+/).map(l => text(l, 60)).filter((l): l is string => !!l)
  return lines.length > 0 ? lines.slice(0, MAX_HOURS_LINES) : undefined
}

/** The team. A member with no role is dropped — see `TeamMember`. */
function teamFrom(raw: unknown): TeamMember[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: TeamMember[] = []
  for (const entry of raw) {
    const name = text((entry as TeamMember)?.name, 60)
    const role = text((entry as TeamMember)?.role, 60)
    if (!name || !role) continue
    out.push({
      name, role,
      ...(text((entry as TeamMember).credentials, 80) ? { credentials: text((entry as TeamMember).credentials, 80)! } : {}),
      ...(text((entry as TeamMember).bio, 240) ? { bio: text((entry as TeamMember).bio, 240)! } : {}),
    })
    if (out.length >= MAX_TEAM) break
  }
  return out.length > 0 ? out : undefined
}

function newPatientInfoFrom(answers: QuestionnaireAnswers): NewPatientInfo | undefined {
  const info: NewPatientInfo = {
    ...(text(answers.first_visit) ? { firstVisit: text(answers.first_visit)! } : {}),
    ...(list(answers.what_to_bring, 6, 80) ? { whatToBring: list(answers.what_to_bring, 6, 80)! } : {}),
    ...(profileUrlFrom(answers.patient_forms_url) ? { formsUrl: profileUrlFrom(answers.patient_forms_url)! } : {}),
  }
  return Object.keys(info).length > 0 ? info : undefined
}

/**
 * Build the renderable content.
 *
 * `pain_points` is deliberately absent from the output. It is the answer to "what is going wrong in
 * your business" — sales intelligence and the opening for an Ava conversation, and the single worst
 * thing that could appear on the customer's own shop window. `content.test.ts` asserts it cannot
 * reach the page, because the failure mode is silent: it would simply render, and look like copy.
 */
export function contentFrom(answers: QuestionnaireAnswers, fallbackBusinessName: string): SiteContent {
  const businessName = text(answers.business_name, 80) ?? fallbackBusinessName.trim()
  const phone = text(answers.phone, 40)

  return {
    businessName,
    phone,
    cta:              ctaFrom(answers, phone),
    services:         servicesFrom(answers.services),
    serviceAreas:     list(answers.service_areas, MAX_AREAS, MAX_AREA_LENGTH),
    testimonials:     testimonialsFrom(answers.testimonials),
    faqs:             faqsFrom(answers.faqs),
    differentiator:   text(answers.differentiator),
    credentials:      text(answers.credentials),
    yearsInBusiness:  text(answers.years_in_business, 40),
    googleProfileUrl: profileUrlFrom(answers.google_profile_url),
    intro:            text(answers.visitor_message),
    access:           accessFrom(answers),
    team:             teamFrom(answers.team),
    newPatientInfo:   newPatientInfoFrom(answers),
  }
}

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

import type { CtaKind, QuestionnaireAnswers, SiteContent, SiteCta } from '@/lib/lead-engine/types'

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
    services:         list(answers.services, MAX_SERVICES, MAX_SERVICE_LENGTH),
    serviceAreas:     list(answers.service_areas, MAX_AREAS, MAX_AREA_LENGTH),
    differentiator:   text(answers.differentiator),
    credentials:      text(answers.credentials),
    yearsInBusiness:  text(answers.years_in_business, 40),
    googleProfileUrl: profileUrlFrom(answers.google_profile_url),
    intro:            text(answers.visitor_message),
  }
}

/**
 * Which template to render.
 *
 * `showcase_grid` leads with a photo grid and `trade_classic` opens on a photo — so a site with no
 * photos falls back to the copy-forward layout rather than rendering empty frames. Absence of a
 * photo is not a reason to show a placeholder; it is a reason to show a different page.
 */
export function effectiveTemplate(
  template: string | null | undefined,
  photoCount: number,
): 'trade_classic' | 'service_clean' | 'showcase_grid' {
  if (photoCount === 0) return 'service_clean'
  if (template === 'trade_classic' || template === 'showcase_grid' || template === 'service_clean') {
    return template
  }
  return 'service_clean'
}

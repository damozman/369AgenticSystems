/**
 * Lead Engine's shared shapes.
 *
 * Two of these describe the same site from different sides and must not be confused:
 * `QuestionnaireAnswers` is what the customer typed, `SiteContent` is what renders. The database
 * stores both in separate columns for the same reason — see the migration's comment on why a
 * re-submitted questionnaire must never rewrite a live page.
 */

// Template, Theme and Brand live in `theme.ts` — the design layer owns them, and re-declaring them
// here is how two lists of five templates end up disagreeing. Re-exported so callers that only
// care about a site's shape have one import.
export type { Template, Theme, Brand, AccentMode, PaperShade, LogoTreatment } from '@/lib/lead-engine/theme'
import type { Template, Theme, Brand } from '@/lib/lead-engine/theme'

export const SITE_STATUSES = [
  'draft', 'awaiting_answers', 'in_build', 'live', 'suspended', 'cancelled',
] as const
export type SiteStatus = (typeof SITE_STATUSES)[number]

/** The four call-to-action choices the questionnaire offers, plus the free-text escape. */
export const CTA_KINDS = ['call', 'estimate', 'availability', 'other'] as const
export type CtaKind = (typeof CTA_KINDS)[number]

/**
 * One service, as the customer describes it.
 *
 * The description is collected, never generated. A one-line description is a claim about what a
 * business does — "full tear-off and re-roof" on a roofer who subcontracts tear-offs is a false
 * statement on their own website — so Q2 asks for it rather than a phrase bank inventing it.
 * Chris's call, 2026-08-23: add the field while Chunk B is unshipped and it is free.
 */
export interface ServiceItem {
  name: string
  description?: string
}

/** A real customer quote. Trust renders only from these and never invents one. */
export interface Testimonial {
  quote: string
  name: string
  city?: string
  jobType?: string
}

export interface FaqItem {
  question: string
  answer: string
}

/**
 * Raw questionnaire answers, exactly as submitted.
 *
 * Everything is optional. A customer who skips a question has not answered it, and that is
 * different from answering it with an empty string — the renderer omits a section it has no data
 * for rather than showing an empty frame or inventing filler.
 */
export interface QuestionnaireAnswers {
  business_name?: string
  phone?: string
  /**
   * Accepts both shapes. Q2 now posts `{name, description}` rows, but a browser holding a cached
   * copy of the form keeps posting a flat string list long after a deploy, and a service list is
   * worth more than a tidy contract.
   */
  services?: Array<string | ServiceItem>
  testimonials?: Testimonial[]
  faqs?: FaqItem[]
  service_areas?: string
  differentiator?: string
  credentials?: string
  years_in_business?: string
  primary_cta?: CtaKind
  primary_cta_other?: string
  google_profile_url?: string
  has_photos?: boolean
  /**
   * INTERNAL ONLY. This is sales intelligence and the Ava wedge — never site copy.
   * `contentFrom()` does not carry it across, and a test asserts that it cannot.
   */
  pain_points?: string
  visitor_message?: string
  /** Operational, not rendered: where lead notifications go, and the requested URL. */
  notify_email?: string
  preferred_slug?: string
}

/** A call to action, already resolved to something the page can actually do. */
export interface SiteCta {
  label: string
  /** `call` renders a tel: link — only ever chosen when a phone number exists. */
  kind: 'call' | 'form'
}

/**
 * What the public page renders. Every field is optional except the two a site cannot exist
 * without, and the renderer omits any section whose field is absent.
 */
export interface SiteContent {
  businessName: string
  cta: SiteCta
  phone?: string
  services?: ServiceItem[]
  serviceAreas?: string[]
  differentiator?: string
  credentials?: string
  yearsInBusiness?: string
  googleProfileUrl?: string
  intro?: string
  testimonials?: Testimonial[]
  faqs?: FaqItem[]
}

/** A site row as the renderer needs it. Narrower than the table on purpose. */
export interface LeadEngineSite {
  id: string
  slug: string
  business_name: string
  status: SiteStatus
  /** Stated intent. The no-photo degrade is computed at render and never stored. */
  template: Template
  theme: Theme
  brand: Brand
  content: SiteContent | null
  notify_email: string | null
  client_domain: string | null
  launched_at: string | null
  revisions_used: number
}

/** A photo, as the gallery needs it. Populated in Phase 6; the templates already read it. */
export interface SitePhoto {
  id: string
  url: string
  caption: string | null
}

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
 * One practitioner, as the practice describes them.
 *
 * `role` is required and `credentials` is not, because "Dr Elena Ruiz" with no role beside it is
 * an unattributed name and a patient cannot tell the dentist from the office manager. Credentials
 * are a licence claim and are simply omitted when the practice did not state them.
 */
export interface TeamMember {
  name: string
  role: string
  credentials?: string
  bio?: string
}

/**
 * The four things a patient checks before ringing a practice, and the reason Practice is a separate
 * template rather than Service Clean in a different palette.
 *
 * **`acceptingNewPatients` is a tri-state on purpose.** `undefined` means the practice never
 * answered, and it renders nothing — printing "Accepting new patients" on a books-closed practice
 * generates a call the receptionist has to turn away, which is worse than saying nothing. `false`
 * renders honestly as "Not taking new patients right now", which is a real answer a patient is
 * grateful for.
 */
export interface PracticeAccess {
  acceptingNewPatients?: boolean
  /** Plan names exactly as the practice typed them. Never expanded, never abbreviated. */
  insuranceAccepted?: string[]
  /** One line per day or per group, e.g. "Mon–Thu 8:00–5:00". */
  hours?: string[]
  location?: string
}

/** What happens at a first appointment. Every field the practice's own words, or absent. */
export interface NewPatientInfo {
  firstVisit?: string
  whatToBring?: string[]
  formsUrl?: string
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

  /**
   * ── Practice-only questions (Q9–Q11) ──
   *
   * Asked only of the practice verticals — dental, medical, veterinary, chiropractic, optometry.
   * Before these existed the Practice template was Service Clean in the Clinic palette: its three
   * distinguishing sections had no data behind them and therefore did not render.
   *
   * Every one is optional and the sections omit rather than default. `accepting_new_patients` is
   * tri-state — see `PracticeAccess`.
   */
  accepting_new_patients?: boolean
  insurance_accepted?: string | string[]
  /** Free text; split on newlines and semicolons into one line per row. */
  hours?: string
  location?: string
  team?: TeamMember[]
  first_visit?: string
  what_to_bring?: string | string[]
  patient_forms_url?: string
  /** Q4a — "What's one thing you do that other [vertical] businesses typically don't?" The hero's lede, verbatim. */
  differentiator?: string
  /** Q4b — "What's the first thing customers usually say about you?" An externally-observed impression, not a self-assessment. */
  customer_impression?: string
  /** Q5. Feeds the proof bar always, and a third Why-us item when answered — see `sections.ts`'s `credentialWhyUsLine`. */
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
  /**
   * What the business does, for the hero headline — "Roofing", "Legal counsel".
   *
   * Not written by `contentFrom`: it is a column on the site row, merged in at render. The
   * questionnaire never asks for it, and re-submitting the questionnaire must not change it.
   */
  headlineNoun?: string
  phone?: string
  services?: ServiceItem[]
  serviceAreas?: string[]
  /** Q4a, verbatim — also the hero's lede. */
  differentiator?: string
  /** Q4b, verbatim — the second guaranteed Why-us item. */
  customerImpression?: string
  credentials?: string
  yearsInBusiness?: string
  googleProfileUrl?: string
  testimonials?: Testimonial[]
  faqs?: FaqItem[]
  /** Practice only. Absent on every other template, and the sections omit when it is. */
  access?: PracticeAccess
  team?: TeamMember[]
  newPatientInfo?: NewPatientInfo
}

/** A site row as the renderer needs it. Narrower than the table on purpose. */
export interface LeadEngineSite {
  id: string
  slug: string
  business_name: string
  status: SiteStatus
  /**
   * What the business does, for the hero headline — resolved from the vertical at creation via
   * VERTICAL_NOUNS, operator-overridable. NOT the vertical key: the vertical is deliberately not
   * stored. Null falls the hero back to the business name.
   */
  headline_noun: string | null
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

/** One generated size of a photo, always both encodings at the same width. */
export interface PhotoVariant {
  width: number
  webp: string
  jpg: string
}

/**
 * A photo, as the gallery needs it. Populated in Phase 6; the templates already read `url` and
 * `caption`. `variants` / `aspectRatio` / `dominantHex` / `isPrimary` come from the Part B ingest
 * pipeline (`lib/lead-engine/photo-pipeline.ts`) and are optional because a photo uploaded before
 * that pipeline shipped has none of them — every consumer must degrade to `url` alone rather than
 * assume they exist.
 */
export interface SitePhoto {
  id: string
  /** The largest stored variant. What every pre-Part-B caller already reads. */
  url: string
  caption: string | null
  /** Ascending by width. Empty when this photo predates the pipeline. */
  variants?: PhotoVariant[]
  /** width / height of the source, after EXIF rotation. Undefined when never measured. */
  aspectRatio?: number
  /** Placeholder background while the real image loads. */
  dominantHex?: string
  /** The customer's stated best photo — overrides sort_order for the hero slot only. */
  isPrimary?: boolean
}

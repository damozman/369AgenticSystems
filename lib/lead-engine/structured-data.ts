/**
 * What Google reads. None of it is visible on the page.
 *
 * ── The rule this file runs on ──
 * Every value here is a claim made in the customer's name, to a search engine, about their real
 * business. So the same discipline `lib/lead-engine/content.ts` applies to prose applies here
 * harder: a field is emitted when we actually have it, and omitted otherwise. There is no
 * default, no placeholder, and nothing inferred.
 *
 * `aggregateRating` is the sharp one. Google penalises a rating that does not correspond to
 * reviews a visitor can verify, and an invented star count is a lie told on a customer's behalf
 * that they never see. It is emitted only when the client supplied a real figure from their own
 * Google profile — never derived from the testimonials on the page, which are hand-picked and
 * would overstate every time.
 */
import type { SiteContent } from '@/lib/lead-engine/types'

/** A LocalBusiness subtype per trade, so the markup says what they actually are. */
const BUSINESS_TYPE: Readonly<Record<string, string>> = {
  plumbing: 'Plumber',
  electrical: 'Electrician',
  roofing: 'RoofingContractor',
  hvac: 'HVACBusiness',
  'general-contracting': 'GeneralContractor',
  legal: 'LegalService',
  dental: 'Dentist',
  medical: 'MedicalBusiness',
  veterinary: 'VeterinaryCare',
  'real-estate': 'RealEstateAgent',
  insurance: 'InsuranceAgency',
  'tree-service': 'HomeAndConstructionBusiness',
  concrete: 'HomeAndConstructionBusiness',
  cleaning: 'HomeAndConstructionBusiness',
}

/**
 * The vertical is deliberately not stored on a site, so the subtype is resolved from whatever the
 * caller knows and falls back to the generic type rather than guessing a trade. `LocalBusiness` is
 * always valid; a wrong subtype is a wrong statement about the business.
 */
export function businessType(vertical?: string | null): string {
  if (!vertical) return 'LocalBusiness'
  return BUSINESS_TYPE[vertical.trim().toLowerCase()] ?? 'LocalBusiness'
}

export interface BusinessSchemaInput {
  content: SiteContent
  url: string
  vertical?: string | null
  /** Only from the client's own Google profile. Omitted entirely when absent. */
  rating?: { value: number; count: number } | null
}

export function businessSchema(input: BusinessSchemaInput): Record<string, unknown> {
  const { content, url, rating } = input

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': businessType(input.vertical),
    name: content.businessName,
    url,
  }

  if (content.phone) schema.telephone = content.phone
  if (content.serviceAreas?.length) schema.areaServed = content.serviceAreas
  if (content.differentiator) schema.description = content.differentiator
  if (content.googleProfileUrl) schema.sameAs = [content.googleProfileUrl]

  // The services they actually offer, which is also what the service pages are built from.
  if (content.services?.length) {
    schema.makesOffer = content.services.map(s => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.name, ...(s.description ? { description: s.description } : {}) },
    }))
  }

  // Emitted ONLY from a real supplied figure. See this file's own note — a rating a visitor cannot
  // verify is a penalty and a false claim, in that order of how much it costs.
  if (rating && rating.count > 0 && rating.value > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(rating.value),
      reviewCount: String(rating.count),
    }
  }

  return schema
}

export function serviceSchema(input: {
  service: { name: string; description?: string; involves?: string }
  content: SiteContent
  url: string
  vertical?: string | null
}): Record<string, unknown> {
  const { service, content, url } = input
  const description = service.involves ?? service.description

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    url,
    ...(description ? { description } : {}),
    provider: { '@type': businessType(input.vertical), name: content.businessName, ...(content.phone ? { telephone: content.phone } : {}) },
    ...(content.serviceAreas?.length ? { areaServed: content.serviceAreas } : {}),
  }
}

/**
 * FAQ markup, which is the one type here that can put the customer's own words directly into a
 * search result. Returns null below two questions: a single-entry FAQPage is not worth the markup
 * and Google is inconsistent about honouring it.
 */
export function faqSchema(faqs: { question: string; answer: string }[]): Record<string, unknown> | null {
  if (faqs.length < 2) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

/**
 * The page title, which is the line someone reads in a search result and decides on.
 *
 * Trade plus town beats the business name alone, because the name is what people search once they
 * already know it — and someone who already knows it is not the visitor these pages exist to win.
 * Falls back cleanly: no noun and no area still produces the business name rather than a title
 * with a dangling separator.
 */
export function pageTitle(content: SiteContent, opts: { service?: string } = {}): string {
  const what = opts.service ?? content.headlineNoun
  const where = content.serviceAreas?.[0]

  const lead = what && where ? `${what} in ${where}` : what || where || null
  return lead ? `${lead} | ${content.businessName}` : content.businessName
}

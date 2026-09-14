/**
 * A site row as the sections read it.
 *
 * Extracted from the home page when service pages arrived, and that is the whole point: the two
 * routes must agree about how the column overrides merge over `content`. Two copies of this would
 * be the two-writers shape this project has been bitten by repeatedly -- a home page and a service
 * page for the SAME business, quietly disagreeing about the footer disclaimer.
 */
import type { LeadEngineSite, SiteContent } from '@/lib/lead-engine/types'

export function contentOf(
  site: Pick<LeadEngineSite, 'content' | 'business_name' | 'headline_noun' | 'footer_note'>,
): SiteContent {
  const base: SiteContent = site.content ?? {
    businessName: site.business_name,
    cta: { label: 'Get a Free Estimate', kind: 'form' },
  }

  // The noun is a COLUMN, not questionnaire content — merged in here so the sections can read one
  // object. Keeping it off `content` is what stops a re-submitted questionnaire from silently
  // clearing it: `contentFrom` rebuilds that jsonb wholesale and knows nothing about this field.
  return {
    ...base,
    ...(site.headline_noun ? { headlineNoun: site.headline_noun } : {}),
    ...(site.footer_note ? { footerNote: site.footer_note } : {}),
  }
}

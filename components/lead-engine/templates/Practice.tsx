/**
 * T4 · Practice — "Can I get in, and do you take my insurance?"
 *
 * Header · Hero (split anchor) · Proof · Services · Why us (band) · Gallery · Coverage · Trust ·
 * FAQ · Terminal CTA.
 *
 * Verticals: dental, medical, veterinary, chiropractic, optometry, on the Clinic kit — the one kit
 * where the accent is used generously rather than reserved for CTAs. Calm, and never urgent: a
 * patient's first questions are practical and slightly anxious.
 *
 * ── What this template deliberately does NOT render ──
 * The SKILL's full Practice order has an access bar (accepting new patients · insurance accepted ·
 * hours), a team section and new-patient information. **The questionnaire asks for none of them**,
 * so none renders. "Accepting new patients" on a practice that is not, or an insurance list nobody
 * gave us, is the exact failure this system exists to prevent — and it is the one a template author
 * is most tempted by, because the empty space is obvious. FAQ carries the insurance and cost
 * questions in the meantime, from answers the practice actually wrote.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { allocatePhotos, servicesLayout } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, Gallery, LeadFormPlaceholder, HeroSplit,
  coverageRenders, ProofBar, Section, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'

export default function Practice({
  content, photos, logoUrl,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string }) {
  const services = content.services ?? []
  const layout = servicesLayout(services.length, Math.max(0, photos.length - 1))
  const shot = allocatePhotos(photos, {
    hero: true,
    ladderRows: layout === 'ladder' ? services.length : 0,
  })

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      <HeroSplit content={content} photo={shot.hero} />

      <Section density="connector">
        <ProofBar content={content} showAreas={!coverageRenders(content)} />
      </Section>

      {/* Grouped by care type in the SKILL; we hold a flat list, so it renders flat rather than
          being invented into groups the practice never stated. */}
      <Services content={content} photos={shot.ladder} layout={layout} eyebrow="What we treat" heading="Our services" />

      <WhyUs content={content} band />
      <Gallery photos={shot.gallery} eyebrow="Our practice" heading="Inside the practice" />
      <Coverage content={content} />
      <Trust testimonials={content.testimonials} />
      <Faq faqs={content.faqs} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

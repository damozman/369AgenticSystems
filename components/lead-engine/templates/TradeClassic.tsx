/**
 * T1 · Trade Classic — "Can I trust you with my property?"
 *
 * Header · Hero (split anchor) · Proof · Services · Photo band · Why us · Gallery · Coverage ·
 * Trust · FAQ · Terminal CTA.
 *
 * Verticals: roofing, HVAC, plumbing, electrical, concrete, tree work, general contracting — and
 * real estate, property management and mortgage on the Threshold kit. Same buying question,
 * different identity.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { allocatePhotos, servicesLayout } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, Gallery, LeadFormPlaceholder, HeroSplit, PhotoBand,
  coverageRenders, ProofBar, Section, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'

export default function TradeClassic({
  content, photos, logoUrl,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string }) {
  const services = content.services ?? []
  const layout = servicesLayout(services.length, Math.max(0, photos.length - 2))
  const shot = allocatePhotos(photos, {
    hero: true,
    band: true,
    ladderRows: layout === 'ladder' ? services.length : 0,
  })

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      <HeroSplit content={content} photo={shot.hero} />

      <Section density="connector">
        <ProofBar content={content} showAreas={!coverageRenders(content)} />
      </Section>

      <Services content={content} photos={shot.ladder} layout={layout} />

      {/* Ironclad's signature, and the break in the run of paper sections before Why us. */}
      <PhotoBand photo={shot.band} businessName={content.businessName} />

      <WhyUs content={content} />
      <Gallery photos={shot.gallery} />
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

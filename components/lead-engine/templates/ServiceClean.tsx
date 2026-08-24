/**
 * T2 · Service Clean — "Are you the right professional for my situation?"
 *
 * Header · Hero (editorial, no image) · Proof · Services · Why us (band) · Gallery · Coverage ·
 * Trust · FAQ · Terminal CTA.
 *
 * Verticals: legal, insurance, accounting, consulting, cleaning.
 *
 * Also the **universal fallback** — any site with no usable photos renders this layout whatever its
 * stated template, and the theme does not change with it. A roofer with no photos gets this
 * structure in Ironclad's identity and still reads as a roofer. So nothing here assumes photos
 * exist, and it still renders a gallery when they do.
 *
 * Why us sits on a structure band: with no hero image, hero → services → why → gallery would be
 * four consecutive sections on paper, and the rhythm rule allows two.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { allocatePhotos, servicesLayout } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, Gallery, LeadFormPlaceholder, HeroEditorial,
  ProofBar, Section, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'

export default function ServiceClean({
  content, photos, logoUrl,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string }) {
  const services = content.services ?? []
  const layout = servicesLayout(services.length, photos.length)
  const shot = allocatePhotos(photos, {
    ladderRows: layout === 'ladder' ? services.length : 0,
  })

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      <HeroEditorial content={content} />

      <Section density="connector">
        {/* Areas get their own section further down, so the bar would only repeat them. */}
        <ProofBar content={content} showAreas={false} />
      </Section>

      <Services content={content} photos={shot.ladder} layout={layout} />
      <WhyUs content={content} band />
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

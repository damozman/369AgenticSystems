/**
 * T1 · Trade Classic — "Can I trust you with my property?"
 *
 * Header · Hero (split anchor) · **Proof (band)** · Services · Photo band · Why us ·
 * **Gallery (band)** · Coverage · **Trust (band)** · FAQ · Terminal CTA.
 *
 * Verticals: roofing, HVAC, plumbing, electrical, concrete, tree work, general contracting — and
 * real estate, property management and mortgage on the Threshold kit. Same buying question,
 * different identity.
 *
 * ── Background rhythm ──
 * Every kit defines a --structure dark tone, and until this pass it was used in exactly one place
 * on this template: the terminal CTA. Nine content sections ran paper-paper-paper-paper-paper-
 * paper-paper-paper before hitting the first non-paper background — Ironclad, the template's own
 * reference kit, had ZERO non-paper sections outside the CTA.
 *
 * Proof always bands when it renders (wrapped directly, not through `bandPlan` — nothing precedes
 * it but the hero, so the dynamic segment always starts a fresh run regardless of whether Proof
 * rendered). Services through Faq are computed by `bandPlan()` from what will ACTUALLY render —
 * see that function's own doc for why a hand-picked "band Coverage" is not safe: the first version
 * of this template did exactly that, and it broke the moment a customer had too few service areas
 * for Coverage to render at all, landing two chosen bands directly against each other.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import LeadForm from '@/components/lead-engine/LeadForm'
import { allocatePhotos, servicesLayout } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, Gallery, HeroSplit, PhotoBand,
  coverageRenders, ProofBar, Section, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'
import { bandPlan, galleryLayout, whyUsRenders } from '@/lib/lead-engine/sections'

export default function TradeClassic({
  content, photos, logoUrl, siteId,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string; siteId: string }) {
  const services = content.services ?? []
  const layout = servicesLayout(services.length, Math.max(0, photos.length - 2))
  const shot = allocatePhotos(photos, {
    hero: true,
    band: true,
    ladderRows: layout === 'ladder' ? services.length : 0,
  })

  // Services is `bandable: false` and its slot in the returned array is unused — it is here only
  // so its render state still occupies a position in the run, exactly as it does on the page.
  const [, whyBand, galleryBand, coverageBand, trustBand] = bandPlan([
    { key: 'services', renders: services.length > 0, bandable: false },
    { key: 'why', renders: whyUsRenders(content), bandable: true },
    { key: 'gallery', renders: galleryLayout(shot.gallery) !== null, bandable: true },
    { key: 'coverage', renders: coverageRenders(content), bandable: true },
    { key: 'trust', renders: (content.testimonials?.length ?? 0) > 0, bandable: true },
  ])

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      <HeroSplit content={content} photo={shot.hero} />

      <Section density="connector" band>
        <ProofBar content={content} showAreas={!coverageRenders(content)} />
      </Section>

      <Services content={content} photos={shot.ladder} layout={layout} />

      {/* Ironclad's signature, and the break in the run of paper sections before Why us. */}
      <PhotoBand photo={shot.band} businessName={content.businessName} />

      <WhyUs content={content} band={whyBand} />
      <Gallery photos={shot.gallery} businessName={content.businessName} band={galleryBand} />
      <Coverage content={content} band={coverageBand} />
      <Trust testimonials={content.testimonials} band={trustBand} />
      <Faq faqs={content.faqs} />

      <Contact content={content}>
        <LeadForm siteId={siteId} />
      </Contact>

      <Footer content={content} />
    </>
  )
}

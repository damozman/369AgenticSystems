/**
 * T5 · Supply — "Can you supply what I need, at my volume, on my timeline?"
 *
 * Header · Hero (editorial) · Capability bar (band) · Product categories · Gallery · Why us ·
 * Coverage · Trust · FAQ · Terminal CTA.
 *
 * Verticals: wholesale, distribution, B2B supply, on the Ledger kit — whose signature is dense
 * mono-set rows treated as a design element rather than tidied away. Operational and spec-dense,
 * because a trade buyer wants a catalogue and a terms sheet, not a story about the company.
 *
 * ── Composition decisions the fix brief does not cover (mine, for review) ──
 * • **Product categories use the two-column list (5b), never the image ladder.** A supply buyer
 *   scans category names; eight categories with a description each is a catalogue page, whereas
 *   eight alternating photo rows is an enormous page that says less.
 * • **No hero image.** Ledger carries a page on type and hairlines, and a stock warehouse shot adds
 *   nothing a category list does not already say.
 * • **The terms block is NOT built.** MOQ, payment terms, freight and returns are commercial
 *   commitments a buyer can hold a supplier to, and we collect none of them — which makes them the
 *   most dangerous filler on any of the five templates. The capability bar therefore carries only
 *   answered facts, and FAQ carries lead times and minimums when the supplier has written them.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { allocatePhotos } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, Gallery, LeadFormPlaceholder, HeroEditorial,
  coverageRenders, ProofBar, Section, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'

export default function Supply({
  content, photos, logoUrl,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string }) {
  const shot = allocatePhotos(photos, {})

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      <HeroEditorial content={content} eyebrow="Trade supply" />

      {/* Capability, carrying only answered facts. Never a minimum order quantity or a lead time. */}
      <Section density="connector" band>
        <ProofBar content={content} showAreas={!coverageRenders(content)} />
      </Section>

      <Services content={content} layout="list" eyebrow="What we supply" heading="Product categories" />

      <Gallery photos={shot.gallery} eyebrow="Our stock" heading="What we carry" />
      <WhyUs content={content} />

      {/* Distribution footprint — the buyer's real question is whether you reach them. */}
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

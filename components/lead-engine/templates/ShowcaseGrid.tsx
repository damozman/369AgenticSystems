/**
 * T3 · Showcase Grid — "What have you got, and is it available?"
 *
 * Header · Hero (compact split) · Inventory grid · Services · **Proof (band)** · Coverage ·
 * Why us · **Trust (band)** · FAQ · Terminal CTA.
 *
 * Verticals: dumpster rental, equipment rental, event & party rentals, hauling. The gallery leads
 * because for a hire customer the photo IS the argument — someone planning a birthday wants to see
 * the bounce house before they read about the company.
 *
 * `effectiveTemplate` never selects this layout for a site with no photos: a showcase with nothing
 * to show is the worst of the five, so such a site falls back to Service Clean.
 *
 * ── Composition decisions the fix brief does not cover (mine, for review) ──
 * • **THREE photos, not six.** Six photographs headed "What we have" sitting directly above eight
 *   named items headed "Everything we stock" was the page saying its inventory twice, in two
 *   shapes, neither complete. The two ways out were captioning every cell and cutting the text
 *   list, or cutting the grid and keeping the list. **The list wins**: it carries the item names
 *   and the customer's own descriptions, which is what a hire buyer actually needs, and captioning
 *   the cells needs per-photo labels the questionnaire does not collect — pairing photo *i* with
 *   service *i* to manufacture them asserts a correspondence nobody stated. Three photos above the
 *   list read as a look at the kit rather than as a second, worse catalogue. A captioned catalogue
 *   grid is the better end state and returns when photo captions are collected.
 * • **The sizing strip is deliberately NOT built.** A strip of sizes, prices and availability is
 *   what a Yard buyer wants, and we collect none of them. Filling it with service areas and years
 *   in business — which was my first attempt — just reprints the proof bar in the proof bar's own
 *   shape. Being right not to invent sizes means cutting the section, not recycling data into it.
 *   It returns when the questionnaire collects real inventory specs.
 *
 * ── Background rhythm ──
 * Proof already banded (the comment above predates this pass), and — Gallery being the template's
 * whole point and Services sitting right in front of Proof — that segment is left as two paper
 * sections by construction, no room or need to band either. After Proof, Coverage, Why us, Trust
 * and Faq are computed by `bandPlan()` from what will actually render, the same way as every other
 * template in this pass, rather than the static "band Trust" this comment used to describe — that
 * static choice is what put two chosen bands directly against each other on a customer whose
 * content made Coverage or Why us drop out. See `bandPlan`'s own doc for the incident that forced
 * the change.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import LeadForm from '@/components/lead-engine/LeadForm'
import { allocatePhotos, servicesLayout } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, Gallery, HeroSplit,
  coverageRenders, ProofBar, Section, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'
import { SHOWCASE_GALLERY_PHOTOS, bandPlan, whyUsRenders } from '@/lib/lead-engine/sections'

export default function ShowcaseGrid({
  content, photos, logoUrl, siteId,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string; siteId: string }) {
  const services = content.services ?? []
  const layout = servicesLayout(services.length, Math.max(0, photos.length - 1))
  const shot = allocatePhotos(photos, {
    hero: true,
    ladderRows: layout === 'ladder' ? services.length : 0,
  })

  // Proof is always band when it renders and nothing (a fallback proof bar, say) ever renders it
  // as paper instead — so whether or not it renders, the segment after it always starts a fresh
  // run. See TradeClassic for the same reasoning stated once in full.
  const [coverageBand, whyBand, trustBand] = bandPlan([
    { key: 'coverage', renders: coverageRenders(content), bandable: true },
    { key: 'why', renders: whyUsRenders(content), bandable: true },
    { key: 'trust', renders: (content.testimonials?.length ?? 0) > 0, bandable: true },
    { key: 'faq', renders: (content.faqs?.length ?? 0) > 0, bandable: false },
  ])

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      <HeroSplit content={content} photo={shot.hero} />

      {/* The whole point of this template: show the kit before talking about the company. Three
          photos, because the named list below is the actual catalogue — see the note above. */}
      <Gallery
        photos={shot.gallery.slice(0, SHOWCASE_GALLERY_PHOTOS)}
        businessName={content.businessName}
        eyebrow="Photographs"
        heading="A look at our kit"
      />

      <Services
        content={content}
        photos={shot.ladder}
        layout={layout}
        eyebrow="What we hire out"
        heading="Everything we stock"
      />

      {/* On a band, breaking the run of paper sections. These are the facts a hire customer checks
          before ringing — and they are facts we actually hold. */}
      <Section density="connector" band className="le-proof-band">
        <ProofBar content={content} showAreas={!coverageRenders(content)} />
      </Section>

      <Coverage content={content} band={coverageBand} />
      <WhyUs content={content} band={whyBand} />
      <Trust testimonials={content.testimonials} band={trustBand} />
      <Faq faqs={content.faqs} />

      <Contact content={content}>
        <LeadForm siteId={siteId} />
      </Contact>

      <Footer content={content} />
    </>
  )
}

/**
 * T3 · Showcase Grid — "What have you got, and is it available?"
 *
 * Header · Hero (compact split) · Inventory grid · Services · Proof (band) · Coverage · Why us ·
 * Trust · FAQ · Terminal CTA.
 *
 * Verticals: dumpster rental, equipment rental, event & party rentals, hauling. The gallery leads
 * because for a hire customer the photo IS the argument — someone planning a birthday wants to see
 * the bounce house before they read about the company.
 *
 * `effectiveTemplate` never selects this layout for a site with no photos: a showcase with nothing
 * to show is the worst of the five, so such a site falls back to Service Clean.
 *
 * ── Composition decisions the fix brief does not cover (mine, for review) ──
 * • The inventory grid is the standard gallery shape rather than a bespoke one. Six items at fixed
 *   ratios reads as a catalogue; the alternative was captioned cells, which needs per-photo labels
 *   the questionnaire does not collect.
 * • **The sizing strip is deliberately NOT built.** A strip of sizes, prices and availability is
 *   what a Yard buyer wants, and we collect none of them. Filling it with service areas and years
 *   in business — which was my first attempt — just reprints the proof bar in the proof bar's own
 *   shape. Being right not to invent sizes means cutting the section, not recycling data into it.
 *   It returns when the questionnaire collects real inventory specs.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { allocatePhotos, servicesLayout } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, Gallery, LeadFormPlaceholder, HeroSplit,
  ProofBar, Section, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'

export default function ShowcaseGrid({
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

      {/* The whole point of this template: what we have, before who we are.
          "Our range", not "Our work" — a rental business hires things out. */}
      <Gallery photos={shot.gallery} eyebrow="Our range" heading="What we have" />

      <Services
        content={content}
        photos={shot.ladder}
        layout={layout}
        eyebrow="What we hire out"
        heading="Everything we stock"
      />

      {/* On a band, breaking the run of paper sections. These are the facts a hire customer checks
          before ringing — and they are facts we actually hold. */}
      <Section density="connector" band>
        <ProofBar content={content} showAreas={false} />
      </Section>

      <Coverage content={content} />
      <WhyUs content={content} />
      <Trust testimonials={content.testimonials} />
      <Faq faqs={content.faqs} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

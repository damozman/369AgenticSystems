/**
 * T5 · Supply — "Can you supply what I need, at my volume, on my timeline?"
 *
 * Header · Hero (editorial, carrying the capability facts) · **Product categories (band)** ·
 * Photo band · Why us · Coverage · **Trust (band)** · FAQ · Terminal CTA.
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
 *   most dangerous filler on any of the five templates. The capability facts therefore carry only
 *   answered ones, and FAQ carries lead times and minimums when the supplier has written them.
 * • **No photo gallery — ONE full-bleed band instead.** Six warehouse photographs is the same
 *   catalogue the category list already gives, in a shape that says less. The alternative Chris
 *   offered — three photos captioned with a product category — needs per-photo captions the
 *   questionnaire does not collect, and pairing photo *i* with category *i* to manufacture them
 *   asserts a correspondence nobody stated. A single band makes no claim about its own contents and
 *   breaks a page that is otherwise entirely type.
 * • **The hero carries the capability facts** in columns 9–12, so the bar is not a section of its
 *   own printing them a second time.
 *
 * ── Background rhythm ──
 * With no proof bar and no gallery, this is the thinnest template — five content sections before
 * the CTA, and until this pass every one of them ran paper. Services, Why us, Coverage, Trust and
 * Faq are computed by `bandPlan()` from what will actually render, same as every other template in
 * this pass — nothing here is fixed ahead of it (no AccessBar, no wrapped Proof bar), so the
 * dynamic segment simply covers the whole page.
 *
 * ── The editorial hero has no colour of its own, same gap as Service Clean ──
 * Found 2026-08-24 on Service Clean and confirmed here too: the editorial hero carries no colour,
 * so hero → Product categories → Why us ran three consecutive paper sections before the first
 * band — later than any split-anchor template ever goes, and later than Chris's instruction
 * allows ("no later than the section after the hero"). Same fix, same mechanism: `services` moves
 * to `bandable: true` (a one-off, same exception as Service Clean's, not a change to the general
 * rule that Services stays paper elsewhere) and `bandPlan()` is seeded with `startingPaperRun: 2`
 * so the hero counts as having already spent the two paper sections the algorithm would otherwise
 * wait for. Product categories bands immediately; Trust bands instead of Coverage as a direct
 * consequence of the shifted starting point, not a separate decision.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { allocatePhotos } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, LeadFormPlaceholder, HeroEditorial, PhotoBand,
  coverageRenders, editorialHeroFacts, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'
import { bandPlan, whyUsRenders } from '@/lib/lead-engine/sections'

export default function Supply({
  content, photos, logoUrl,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string }) {
  const shot = allocatePhotos(photos, { band: true })

  const [servicesBand, whyBand, coverageBand, trustBand] = bandPlan(
    [
      { key: 'services', renders: (content.services?.length ?? 0) > 0, bandable: true },
      { key: 'why', renders: whyUsRenders(content), bandable: true },
      { key: 'coverage', renders: coverageRenders(content), bandable: true },
      { key: 'trust', renders: (content.testimonials?.length ?? 0) > 0, bandable: true },
    ],
    2, // the editorial hero carries no colour of its own — see the doc comment above
  )

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      {/* Capability, carrying only answered facts. Never a minimum order quantity or a lead time. */}
      <HeroEditorial
        content={content}
        eyebrow="Trade supply"
        facts={editorialHeroFacts(content, { showAreas: !coverageRenders(content) })}
      />

      <Services content={content} layout="list" eyebrow="What we supply" heading="Product categories" band={servicesBand} />

      <PhotoBand photo={shot.band} businessName={content.businessName} />
      <WhyUs content={content} band={whyBand} />

      {/* Distribution footprint — the buyer's real question is whether you reach them. */}
      <Coverage content={content} band={coverageBand} />
      <Trust testimonials={content.testimonials} band={trustBand} />
      <Faq faqs={content.faqs} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

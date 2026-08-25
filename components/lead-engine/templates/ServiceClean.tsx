/**
 * T2 · Service Clean — "Are you the right professional for my situation?"
 *
 * Header · Hero (editorial, carrying the proof facts) · Services · **Why us (band)** · Coverage ·
 * **Trust (band)** · FAQ · Terminal CTA.
 *
 * Verticals: legal, insurance, accounting, consulting, cleaning.
 *
 * Also the **universal fallback** — any site with no usable photos renders this layout whatever its
 * stated template, and the theme does not change with it. A roofer with no photos gets this
 * structure in Forge's identity and still reads as a roofer. So nothing here assumes photos
 * exist, and it still renders a gallery when they do.
 *
 * Why us sits on a structure band: with no hero image, hero → services → why would be three
 * consecutive sections on paper, and the rhythm rule allows two.
 *
 * ── Two composition decisions, both mine, both reversals of Chunk A ──
 * • **No photo gallery.** A solicitor, an accountant, a consultant and a cleaning firm are chosen
 *   on what they do and who they act for. Six photographs of an office is the filler that makes a
 *   page look generated, and it was the largest block on the page.
 *   Photos are not discarded with it. They go to the services ladder, where each one sits beside
 *   the service it illustrates — and when the list is too long for a ladder, ONE becomes a
 *   full-bleed band. Dropping the gallery outright rendered nought of a customer's twelve
 *   photographs, which is not what "a gallery is filler here" was ever meant to mean.
 * • **The hero carries the proof facts** in columns 9–12 and the proof bar is dropped. The bar was
 *   the same four facts one section lower, while the hero left four columns empty.
 *
 * ── ONE photograph in the hero, added 2026-08-25 ──
 * Two rules had been collapsed into one. "Must survive with zero photos" is why this template is
 * the universal fallback and is untouched. "Must never show photos" is a different claim, it was
 * never argued for, and for a professional practice it is wrong: people hire a person, and the
 * photograph IS the pitch. The gallery stays off — `TEMPLATE_RENDERS_GALLERY.service_clean` is
 * still false, because a wall of six office shots is the filler the decision above removed.
 *
 * The photograph takes columns 8–12, which is where the proof facts used to stack, so they move to
 * a hairline row directly beneath — still inside the hero element. That is deliberate rather than
 * incidental: `heroCarriesProof(template)` tells `sectionCount` this template has no proof section,
 * and if that predicate had to depend on whether a customer uploaded a photo, the count would drift
 * from what renders. The hero still carries the proof; it draws it as a row instead of a column.
 *
 * With no photograph, every line of this renders exactly as it did before.
 *
 * ── Background rhythm ──
 * With the proof bar absorbed into the hero, this template's only pre-existing band was Why us,
 * hand-picked. That broke on `review-sparse`: with Coverage not rendering (one service area is
 * below the three-area minimum), a SECOND hand-picked band (Trust) landed directly against it —
 * two bands touching, reading as one large dark block instead of alternation. Services, Why us,
 * Coverage, Trust and Faq are now computed by `bandPlan()` from what will actually render, which
 * makes that adjacency structurally impossible rather than merely unlikely on the fixtures this
 * pass happened to check. See `bandPlan`'s own doc for the full incident.
 *
 * ── The editorial hero has no colour of its own, and that left a second gap ──
 * Found 2026-08-24. The split-anchor hero's photo half already reads as a colour break — the
 * editorial hero has no image, so on THIS template hero → services → why ran three consecutive
 * PAPER sections before the first band, later than the split-anchor templates ever go. Chris's
 * instruction: put a break no later than the section immediately after the hero.
 *
 * Services now bands, via `startingPaperRun: 2` — the editorial hero counts as having already
 * "spent" two paper sections for this template specifically, so the very first dynamic candidate
 * bands immediately rather than waiting for two more to accumulate. This is the same mechanism
 * Practice uses to account for its own fixed prefix (Access bar / the fallback proof bar), applied
 * here for a different reason: not a fixed section that might render as paper, but a HERO that
 * never carries colour at all on this template. `services` moves from `bandable: false` (every
 * other template's choice) to `bandable: true` here alone — a one-off, not a change to the
 * general rule, and worth the exception because there is nothing before it left to band instead.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import LeadForm from '@/components/lead-engine/LeadForm'
import { allocatePhotos, servicesLayout } from '@/lib/lead-engine/photos'
import {
  Contact, Coverage, Faq, Footer, HeroEditorial, PhotoBand,
  coverageRenders, editorialHeroFacts, Services, SiteHeader, Trust, WhyUs,
} from '@/components/lead-engine/SiteSections'
import { bandPlan, whyUsRenders } from '@/lib/lead-engine/sections'

export default function ServiceClean({
  content, photos, logoUrl, siteId,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string; siteId: string }) {
  const services = content.services ?? []
  // One fewer photo is available to the ladder than the customer uploaded, because the hero takes
  // the first pick. Counting the full array here is how a ladder gets chosen and then rendered with
  // its last row empty — the same arithmetic Trade Classic already does with its own hero and band.
  const layout = servicesLayout(services.length, Math.max(0, photos.length - 1))
  // The band is asked for ONLY when the ladder is not in use. `allocatePhotos` hands out the band
  // before the ladder, so requesting both on a customer with exactly enough photos would take one
  // away from a ladder row and leave it half-built — degrading the structural thing to feed the
  // decorative one, which is the reverse of that module's rule.
  const shot = allocatePhotos(photos, {
    hero: true,
    band: layout === 'list',
    ladderRows: layout === 'ladder' ? services.length : 0,
  })

  const [servicesBand, whyBand, coverageBand, trustBand] = bandPlan(
    [
      { key: 'services', renders: services.length > 0, bandable: true },
      { key: 'why', renders: whyUsRenders(content), bandable: true },
      { key: 'coverage', renders: coverageRenders(content), bandable: true },
      { key: 'trust', renders: (content.testimonials?.length ?? 0) > 0, bandable: true },
    ],
    2, // the editorial hero carries no colour of its own — see the doc comment above
  )

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      {/* Areas get their own section further down, so the hero would only repeat them.
          The photograph, when there is one, takes columns 8-12 and the facts move to a hairline
          row beneath — inside the hero, so `heroCarriesProof` stays true and the section count
          does not change with whether a customer uploaded anything. */}
      <HeroEditorial
        content={content}
        photo={shot.hero}
        facts={editorialHeroFacts(content, { showAreas: !coverageRenders(content) })}
      />

      <Services content={content} photos={shot.ladder} layout={layout} band={servicesBand} />
      <WhyUs content={content} band={whyBand} />
      <PhotoBand photo={shot.band} businessName={content.businessName} />
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

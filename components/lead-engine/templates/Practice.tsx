/**
 * T4 · Practice — "Can I get in, and do you take my insurance?"
 *
 * Header · Hero (split anchor) · **Access bar (band)** · Services · **Meet the team** ·
 * **New patients (band)** · Why us · Gallery · **Coverage (band)** · Trust · FAQ · Terminal CTA.
 *
 * Verticals: dental, medical, veterinary, chiropractic, optometry, on the Clinic kit — the one kit
 * where the accent is used generously rather than reserved for CTAs. Calm, and never urgent: a
 * patient's first questions are practical and slightly anxious.
 *
 * ── What makes this a template rather than a palette ──
 * Until 2026-08-23 it rendered Service Clean's section list in Clinic's colours, because the three
 * sections that distinguish it had no data behind them: the questionnaire never asked whether the
 * practice was taking new patients, which plans it accepted, when it was open, who worked there, or
 * what happens at a first visit. **The questions now exist** (Q9–Q11), and the sections render from
 * the answers or not at all.
 *
 * The rule has not moved an inch. "Accepting new patients" on a practice that is not, or an
 * insurance list nobody gave us, is exactly what this system exists to prevent — and it is the
 * temptation a template author feels most, because the empty space is obvious. So
 * `accepting_new_patients` is tri-state: unanswered renders nothing, and `false` renders honestly.
 *
 * The team carries no photographs. Headshots are not collected, and a grey avatar circle where a
 * face should be is worse than a name set properly.
 *
 * ── Background rhythm ──
 * At ten sections this is the longest template, and its two pre-existing hand-picked bands (Access
 * bar, Why us) sat far enough apart to leave runs of three and four consecutive paper sections
 * either side. New patients, Why us, Gallery, Coverage and Trust are now computed by `bandPlan()`
 * from what will actually render — Access bar and the fallback proof bar are FIXED points outside
 * that computation (Access bar bands unconditionally when it renders; the fallback proof bar,
 * shown only when Access bar does not, never bands), so `startingPaperRun` tells the dynamic
 * segment how many paper sections that fixed prefix already spent before it gets a say.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import LeadForm from '@/components/lead-engine/LeadForm'
import { allocatePhotos, servicesLayout } from '@/lib/lead-engine/photos'
import {
  AccessBar, Contact, Coverage, Faq, Footer, Gallery, HeroSplit,
  NewPatientInfo, ProofBar, Section, Services, SiteHeader, Team, Trust, WhyUs,
  accessBarRenders, coverageRenders,
} from '@/components/lead-engine/SiteSections'
import { bandPlan, galleryLayout, newPatientRenders, proofBarRenders, teamRenders, whyUsRenders } from '@/lib/lead-engine/sections'

export default function Practice({
  content, photos, logoUrl, siteId,
}: { content: SiteContent; photos: SitePhoto[]; logoUrl?: string; siteId: string }) {
  const services = content.services ?? []
  const layout = servicesLayout(services.length, Math.max(0, photos.length - 1))
  const shot = allocatePhotos(photos, {
    hero: true,
    serviceSlots: layout === 'list' ? 0 : services.length,
  })

  // Two bars of four cells in a row is one bar too many, and the access facts are the ones a
  // patient came for. Years in business and credentials still reach the page — the footer and the
  // Why us section carry them — but they do not get a band above the practical answers.
  const accessRenders = accessBarRenders(content)
  const showProof = !accessRenders
  const proofRenders = showProof && proofBarRenders(content, { showAreas: !coverageRenders(content) })

  const [, , newPatientsBand, whyBand, , coverageBand, trustBand] = bandPlan(
    [
      { key: 'services', renders: services.length > 0, bandable: false },
      { key: 'team', renders: teamRenders(content), bandable: false },
      { key: 'new-patients', renders: newPatientRenders(content), bandable: true },
      { key: 'why', renders: whyUsRenders(content), bandable: true },
      { key: 'gallery', renders: galleryLayout(shot.gallery) !== null, bandable: false },
      { key: 'coverage', renders: coverageRenders(content), bandable: true },
      { key: 'trust', renders: (content.testimonials?.length ?? 0) > 0, bandable: true },
      { key: 'faq', renders: (content.faqs?.length ?? 0) > 0, bandable: false },
    ],
    // AccessBar bands unconditionally when it renders, so the run resets — 0. The fallback proof
    // bar, shown only when AccessBar does not, is never itself banded, so it spends one paper
    // section before the dynamic segment gets a say.
    proofRenders ? 1 : 0,
  )

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} />
      <HeroSplit content={content} photo={shot.hero} />

      {/* The four things a patient checks before ringing. */}
      <AccessBar content={content} />

      {showProof ? (
        <Section density="connector">
          <ProofBar content={content} showAreas={!coverageRenders(content)} />
        </Section>
      ) : null}

      {/* Grouped by care type in the SKILL; we hold a flat list, so it renders flat rather than
          being invented into groups the practice never stated. */}
      <Services content={content} photos={shot.services} layout={layout} eyebrow="What we treat" heading="Our services" />

      <Team content={content} />
      <NewPatientInfo content={content} band={newPatientsBand} />

      <WhyUs content={content} band={whyBand} />
      <Gallery photos={shot.gallery} businessName={content.businessName} eyebrow="Our practice" heading="Inside the practice" />
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

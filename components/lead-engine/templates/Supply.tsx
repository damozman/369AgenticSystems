/**
 * T5 · Supply — "Can you supply what I need, at my volume, on my timeline?"
 *
 * Operational and spec-dense. Reads like a catalogue and a terms sheet, because that is what a
 * trade buyer wants — not a story about the company.
 *
 * Verticals: wholesale, distribution, B2B supply. Runs on the Ledger kit, whose signature is dense
 * mono-set rows treated as a design element rather than tidied away.
 *
 * ── What this template deliberately does NOT render ──
 * The SKILL's full Supply order includes a capability bar (categories · minimums · lead time ·
 * shipping radius), a terms block (MOQ, payment terms, freight, returns), and a buyer-type list.
 * **The questionnaire asks for none of them.** A minimum order quantity or a payment term invented
 * on a supplier's behalf is a commercial claim a buyer may hold them to, which makes it the most
 * dangerous kind of filler on any of the five templates.
 *
 * So the capability bar renders only what was actually answered, and terms do not render at all.
 * They arrive when the questionnaire asks for them.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import {
  About, Contact, Coverage, CtaButton, Footer, Gallery, LeadFormPlaceholder,
  PhoneLink, ProofBar, Section, Services,
} from '@/components/lead-engine/SiteSections'

export default function Supply({ content, photos }: { content: SiteContent; photos: SitePhoto[] }) {
  const hasFacts = !!(content.yearsInBusiness || content.credentials)

  return (
    <>
      {/* No hero image: a buyer scanning for capability wants the capability statement, and Ledger
          carries a page on type and hairlines rather than photography. */}
      <header className="le-hero">
        <div className="le-wrap">
          <h1 className="le-h1" style={{ maxWidth: '20ch' }}>{content.businessName}</h1>
          {content.differentiator ? <p className="le-p le-lede" style={{ marginTop: 28 }}>{content.differentiator}</p> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginTop: 32 }}>
            <CtaButton content={content} />
            {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
          </div>
        </div>
      </header>

      {/* The capability bar, carrying only answered facts. Never a minimum order quantity or a lead
          time — we do not ask for either, and a buyer would hold a supplier to both. */}
      {hasFacts ? (
        <Section id="capability" density="connector" band>
          <p className="le-eyebrow">Capability</p>
          <ProofBar content={content} showAreas={false} />
        </Section>
      ) : null}

      <Services content={content} eyebrow="What we supply" heading="Product categories" />
      <Gallery photos={photos} eyebrow="Our stock" heading="What we carry" />

      <About content={content} showDifferentiator={false} band />

      {/* Distribution footprint — the buyer's real question is whether you reach them. */}
      <Coverage content={content} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

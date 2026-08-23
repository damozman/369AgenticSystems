/**
 * T2 · Service Clean — "Are you the right professional for my situation?"
 *
 * Copy-forward, low-photo. Carries a page on type and structure alone: an editorial hero with no
 * image, display type doing the work photography does elsewhere.
 *
 * Verticals: legal, insurance, accounting, consulting, cleaning.
 *
 * It is also the **universal fallback**. Any site with no usable photos renders this layout
 * whatever its stated template — see `effectiveTemplate`. The theme does not change with it, so a
 * roofer with no photos gets this structure in Ironclad's identity and still reads as a roofer.
 * That is why nothing here assumes photos exist, and why it still renders a gallery when they do.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import {
  About, Contact, Coverage, CtaButton, Footer, Gallery, LeadFormPlaceholder,
  PhoneLink, ProofBar, Services,
} from '@/components/lead-engine/SiteSections'

export default function ServiceClean({ content, photos }: { content: SiteContent; photos: SitePhoto[] }) {
  return (
    <>
      <header className="le-hero">
        <div className="le-wrap">
          {/* Editorial stack, not a centred hero over a flat colour — the SKILL lists that as a
              tell, and every template here is asymmetric or image-anchored. */}
          <div style={{ maxWidth: '18ch' }}>
            <h1 className="le-h1">{content.businessName}</h1>
          </div>
          {content.differentiator ? <p className="le-p le-lede" style={{ marginTop: 28 }}>{content.differentiator}</p> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginTop: 32 }}>
            <CtaButton content={content} />
            {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
          </div>
          <div style={{ marginTop: 48 }}>
            {/* Areas get their own section further down, so the bar would only repeat them. */}
            <ProofBar content={content} showAreas={false} />
          </div>
        </div>
      </header>

      <Services content={content} />

      {/* On a structure band deliberately: with no hero image, hero → services → about → coverage
          would be four consecutive sections on paper, and the rhythm rule allows two. */}
      <About content={content} showDifferentiator={false} band />

      <Gallery photos={photos} />
      <Coverage content={content} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

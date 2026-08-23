/**
 * Service Clean — copy-forward, low-photo.
 *
 * Hero (headline + CTA, no large image) → services → why us → areas served → contact → footer.
 *
 * For legal, insurance, consulting, cleaning — businesses whose credibility is words rather than
 * pictures, and businesses that simply have no good photos. A photo-hungry layout with nothing to
 * put in it looks worse than a layout that never asked, which is why `effectiveTemplate()` falls
 * back to this one whenever a site has no photos at all.
 *
 * It still renders a gallery if photos exist — a site can legitimately be chosen for this layout
 * and have three good pictures — but nothing here depends on them.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { About, Contact, CtaButton, Footer, Gallery, LeadFormPlaceholder, Section, Services, TrustBar } from '../SiteSections'

export default function ServiceClean({ content, photos }: { content: SiteContent; photos: SitePhoto[] }) {
  return (
    <>
      <header className="le-hero">
        <div className="le-wrap">
          <h1>{content.businessName}</h1>
          {content.differentiator ? <p className="le-p" style={{ fontSize: 19 }}>{content.differentiator}</p> : null}
          <div style={{ marginTop: 24 }}><CtaButton content={content} /></div>
          {/* Areas get their own section further down, so the bar would only repeat them. */}
          <TrustBar content={content} showAreas={false} />
        </div>
      </header>

      <Services content={content} />

      {/* The hero carries the differentiator, so About here is the visitor message only. */}
      <About content={content} showDifferentiator={false} />

      <Gallery photos={photos} />

      {content.serviceAreas?.length ? (
        <Section id="areas">
          <p className="le-eyebrow">Where we work</p>
          <h2 className="le-h2">Areas we serve</h2>
          <p className="le-p">{content.serviceAreas.join(' · ')}</p>
        </Section>
      ) : null}

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

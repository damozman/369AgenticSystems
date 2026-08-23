/**
 * Showcase Grid — inventory-forward.
 *
 * Compact hero → gallery FIRST → services/packages → areas → contact → footer.
 *
 * For event and party rentals, equipment rental, dumpsters. The buying question in those trades is
 * "what have you actually got", not "who are you" — a customer planning a birthday wants to see the
 * bounce house before they read about the company. So the grid comes before the prose, which is the
 * one genuinely different decision among the three templates.
 *
 * `effectiveTemplate()` will not select this layout for a site with no photos: a showcase with
 * nothing to show is the worst of the three, so such a site falls back to Service Clean.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { About, Contact, CtaButton, Footer, Gallery, LeadFormPlaceholder, Section, Services, TrustBar } from '../SiteSections'

export default function ShowcaseGrid({ content, photos }: { content: SiteContent; photos: SitePhoto[] }) {
  return (
    <>
      <header className="le-hero" style={{ paddingBottom: 24 }}>
        <div className="le-wrap">
          <h1 style={{ fontSize: 36 }}>{content.businessName}</h1>
          {content.differentiator ? <p className="le-p">{content.differentiator}</p> : null}
          <div style={{ marginTop: 20 }}><CtaButton content={content} /></div>
        </div>
      </header>

      {/* The whole point of this template: what we have, before who we are.
          "Our range", not the default "Our work" — a rental business hires things out. */}
      <Gallery photos={photos} eyebrow="Our range" heading="What we have" />

      <Services content={content} />

      {/* Guarded, not just left to TrustBar's own null: an empty <Section> still paints its
          top border, which reads as a stray rule across the page. */}
      {(content.yearsInBusiness || content.credentials || content.serviceAreas?.length) ? (
        <Section id="details">
          {/* An eyebrow so the bar is not an orphaned row of stats between two headed sections. */}
          <p className="le-eyebrow">Good to know</p>
          <TrustBar content={content} />
        </Section>
      ) : null}

      <About content={content} showDifferentiator={false} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

/**
 * Trade Classic — photo-forward, credentials-first.
 *
 * Hero (photo + name + CTA) → trust bar → services → gallery → about → contact → footer.
 *
 * For roofing, HVAC, plumbing, tree work, concrete: trades where a stranger wants to see the work
 * and the licence before they pick up the phone. The lead photo and the trust bar sit above the
 * fold together for that reason — "who are you and are you real" is the question this layout
 * answers first.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { About, Contact, CtaButton, Footer, Gallery, LeadFormPlaceholder, Services, TrustBar } from '../SiteSections'

export default function TradeClassic({ content, photos }: { content: SiteContent; photos: SitePhoto[] }) {
  // The hero photo is spent here, so the gallery below shows the rest rather than repeating it.
  const [lead, ...rest] = photos

  return (
    <>
      <header className="le-hero">
        <div className="le-wrap">
          <div className="le-hero-split">
            <div>
              <h1>{content.businessName}</h1>
              {content.differentiator ? <p className="le-p">{content.differentiator}</p> : null}
              <div style={{ marginTop: 24 }}><CtaButton content={content} /></div>
            </div>
            {lead ? (
              // Eager, and no lazy attribute: this is the largest paint on the page and lazy-loading
              // the hero image is how a mobile visitor sees a blank rectangle first.
              <img className="le-photo" src={lead.url} alt={lead.caption ?? `Work by ${content.businessName}`} />
            ) : null}
          </div>
          <TrustBar content={content} />
        </div>
      </header>

      <Services content={content} />
      <Gallery photos={rest} />
      {/* The hero already carries the differentiator; repeating it here would read as a mistake
          by the business rather than by us. */}
      <About content={content} showDifferentiator={false} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

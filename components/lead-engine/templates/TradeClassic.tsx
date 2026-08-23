/**
 * T1 · Trade Classic — "Can I trust you with my property?"
 *
 * Photo-forward, credentials early. A stranger wants to see finished work and a licence before
 * they call, so the hero photo and the proof bar sit above the fold together.
 *
 * Verticals: roofing, HVAC, plumbing, electrical, concrete, tree work, general contracting, and —
 * on the Threshold kit rather than Ironclad — real estate, property management, mortgage. Same
 * buying question, different identity.
 *
 * Section order per the SKILL. No hex, no font-family, no literal radius anywhere in this file.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import {
  About, Contact, Coverage, CtaButton, Footer, Gallery, LeadFormPlaceholder,
  PhoneLink, PhotoBand, ProofBar, Services,
} from '@/components/lead-engine/SiteSections'

export default function TradeClassic({ content, photos }: { content: SiteContent; photos: SitePhoto[] }) {
  // The hero photo is spent here and the band takes the next one, so the gallery shows the rest
  // rather than repeating either.
  const [hero, band, ...rest] = photos

  return (
    <>
      <header className="le-hero">
        <div className="le-wrap">
          <div className="le-hero-split">
            <div>
              <h1 className="le-h1">{content.businessName}</h1>
              {content.differentiator ? <p className="le-p le-lede" style={{ marginTop: 24 }}>{content.differentiator}</p> : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginTop: 32 }}>
                <CtaButton content={content} />
                {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
              </div>
            </div>
            {hero ? (
              <div className="le-hero-media">
                {/* Eager and unlazy: this is the LCP element, and lazy-loading it is how a mobile
                    visitor gets a blank rectangle for the first second. */}
                <img className="le-photo" src={hero.url} alt={hero.caption ?? `Work by ${content.businessName}`} />
              </div>
            ) : null}
          </div>
          <div style={{ marginTop: 48 }}>
            <ProofBar content={content} />
          </div>
        </div>
      </header>

      <Services content={content} />

      {/* Ironclad's signature — a photo band breaking the container edge to edge, which also breaks
          the run of paper sections before About. */}
      <PhotoBand photo={band} businessName={content.businessName} />

      {/* The hero already carries the differentiator; repeating it reads as a mistake by the
          business rather than by us. */}
      <About content={content} showDifferentiator={false} />
      <Gallery photos={rest} />
      <Coverage content={content} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

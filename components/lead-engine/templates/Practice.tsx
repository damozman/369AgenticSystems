/**
 * T4 · Practice — "Can I get in, and do you take my insurance?"
 *
 * Access-forward and calm. A patient's first questions are practical and slightly anxious, so the
 * page answers what it can straight away and never uses urgency as a device.
 *
 * Verticals: dental, medical, veterinary, chiropractic, optometry. Runs on the Clinic kit — the one
 * kit where the accent is used generously rather than reserved for CTAs.
 *
 * ── What this template deliberately does NOT render ──
 * The SKILL's full Practice order has an access bar (accepting new patients · insurance accepted ·
 * hours), a team section, and new-patient information. **The questionnaire asks for none of those**,
 * so none of them renders. Inventing "Accepting new patients" for a practice that is not, or an
 * insurance list nobody gave us, is the exact failure this whole system is built to avoid — and it
 * is the one a template author is most tempted by, because the empty space is obvious.
 *
 * Those blocks arrive when the questionnaire asks for them, and not before. Recorded here so the
 * gap is visible rather than mistaken for an oversight.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import {
  About, Contact, Coverage, CtaButton, Footer, Gallery, LeadFormPlaceholder,
  PhoneLink, ProofBar, Services,
} from '@/components/lead-engine/SiteSections'

export default function Practice({ content, photos }: { content: SiteContent; photos: SitePhoto[] }) {
  const [hero, ...rest] = photos

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
                {/* The phone sits beside the primary action rather than below it: a patient who
                    wants to speak to someone should not have to hunt. */}
                {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
              </div>
            </div>
            {hero ? (
              <div className="le-hero-media">
                <img className="le-photo" src={hero.url} alt={hero.caption ?? `${content.businessName}`} />
              </div>
            ) : null}
          </div>
          <div style={{ marginTop: 48 }}>
            <ProofBar content={content} />
          </div>
        </div>
      </header>

      {/* Grouped by care type in the SKILL; we have a flat list, so it renders flat rather than
          being invented into groups the practice never stated. */}
      <Services content={content} eyebrow="What we treat" heading="Our services" />

      <About content={content} showDifferentiator={false} band />

      <Gallery photos={rest} eyebrow="Our practice" heading="Inside the practice" />
      <Coverage content={content} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

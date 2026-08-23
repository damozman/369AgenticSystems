/**
 * T3 · Showcase Grid — "What have you got, and is it available?"
 *
 * Inventory-forward. The gallery IS the argument, so it comes before the company story: a customer
 * planning a birthday wants to see the bounce house before they read about the business.
 *
 * Verticals: dumpster rental, equipment rental, event & party rentals, hauling.
 *
 * `effectiveTemplate` will never select this layout for a site with no photos — a showcase with
 * nothing to show is the worst of the five, so such a site falls back to Service Clean.
 *
 * Nothing here claims live availability. The Yard kit's buyer wants a size, a price and a date, but
 * we have no availability system and Twilio is unconfigured, so the page says what it can honestly
 * say: here is the range, here is the phone number.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import {
  About, Contact, Coverage, CtaButton, Footer, Gallery, LeadFormPlaceholder,
  PhoneLink, ProofBar, Section, Services,
} from '@/components/lead-engine/SiteSections'

export default function ShowcaseGrid({ content, photos }: { content: SiteContent; photos: SitePhoto[] }) {
  const hasFacts = !!(content.yearsInBusiness || content.credentials || content.serviceAreas?.length)

  return (
    <>
      {/* Compact by design: the grid below is the hero. */}
      <header className="le-hero" style={{ paddingBottom: 40 }}>
        <div className="le-wrap">
          <h1 className="le-h1" style={{ maxWidth: '16ch' }}>{content.businessName}</h1>
          {content.differentiator ? <p className="le-p le-lede" style={{ marginTop: 24 }}>{content.differentiator}</p> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginTop: 28 }}>
            <CtaButton content={content} />
            {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
          </div>
        </div>
      </header>

      {/* The whole point of this template: what we have, before who we are.
          "Our range", not the default "Our work" — a rental business hires things out. */}
      <Gallery photos={photos} eyebrow="Our range" heading="What we have" />

      {/* On a band, and placed here rather than at the end: it breaks the run of paper sections,
          and these are the facts a hire customer checks before they ring. */}
      {hasFacts ? (
        <Section id="details" density="connector" band>
          <p className="le-eyebrow">Good to know</p>
          <ProofBar content={content} showAreas={false} />
        </Section>
      ) : null}

      {/* Not "Our range" again — the gallery above already carries that label, and the same words
          twice on one page reads as a template nobody adapted. */}
      <Services content={content} eyebrow="What we hire out" heading="Everything we stock" />
      <Coverage content={content} />
      <About content={content} showDifferentiator={false} />

      <Contact content={content}>
        <LeadFormPlaceholder />
      </Contact>

      <Footer content={content} />
    </>
  )
}

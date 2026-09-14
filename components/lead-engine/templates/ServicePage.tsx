import type { ReactNode } from 'react'
import type { ServiceItem, SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import {
  Contact, Faq, Footer, Coverage, Section, SectionHead, SiteHeader, Trust,
  CtaButton, PhoneLink, SitePhotoImg,
} from '@/components/lead-engine/SiteSections'
import { serviceSlug } from '@/lib/lead-engine/sections'
import LeadForm from '@/components/lead-engine/LeadForm'

/**
 * One service, on its own page.
 *
 * Composed from the sections the home page already uses rather than a parallel set — a service
 * page that drifts visually from the site it belongs to reads as a different company's page.
 * The only genuinely new blocks are the three the customer answered specifically for this: what
 * the work involves, how someone knows they need it, and what to expect.
 *
 * Every block is omitted when unanswered. A page reaches here only by clearing
 * `serviceEarnsPage`, so there is always enough for a real page — but "enough overall" does not
 * mean "all three", and a heading over nothing is worse than one fewer section.
 */
export default function ServicePage({
  content, service, photo, morePhotos = [], faqs, testimonials, otherServices, logoUrl, siteId, slug, nav,
}: {
  content: SiteContent
  service: ServiceItem
  /** The lead photograph — pinned to this service, or the first one nobody has spoken for. */
  photo?: SitePhoto
  /** A short strip further down. Empty on a site with few photos, which is the normal case. */
  morePhotos?: SitePhoto[]
  /** Only the FAQs tagged to this service. */
  faqs: SiteContent['faqs']
  /** Only the testimonials whose jobType names this service. */
  testimonials: SiteContent['testimonials']
  /** The other services that have pages, for the footer links. */
  otherServices: string[]
  logoUrl?: string
  siteId: string
  slug: string
  nav?: { label: string; href: string; current?: boolean }[]
}) {
  const where = content.serviceAreas?.[0]

  return (
    <>
      <SiteHeader content={content} logoUrl={logoUrl} nav={nav} />

      <Section id="top" density="anchor">
        <div className="le-grid">
          <div className="le-c1-8">
            <p className="le-eyebrow">
              <a href={`/sites/${slug}`} className="le-crumb">{content.businessName}</a>
            </p>
            {/* The service and the town. This is the phrase people type, and the home page
                cannot rank for all of a business's services at once. */}
            <h1 className="le-h1">
              {where ? `${service.name} in ${where}` : service.name}
            </h1>
            {service.description ? (
              <p className="le-p le-lede" style={{ marginTop: 24 }}>{service.description}</p>
            ) : null}
            <div className="le-actions">
              <CtaButton content={content} />
              {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
            </div>
          </div>
        </div>
      </Section>

      {photo ? (
        <div className="le-svc-shot">
          <SitePhotoImg
            photo={photo}
            alt={photo.caption ?? `${content.businessName} — ${service.name}`}
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      ) : null}

      {service.involves ? (
        <Section density="connector">
          <div className="le-grid">
            <div className="le-c1-6"><SectionHead eyebrow="What's involved" heading={`How we handle ${service.name.toLowerCase()}`} /></div>
            <div className="le-c7-12"><p className="le-p">{service.involves}</p></div>
          </div>
        </Section>
      ) : null}

      {/* The strip. Placed AFTER "what's involved" rather than beside the lead photo: the words
          are what someone came for, and a second row of pictures above them pushes the answer off
          the screen. Renders nothing at all when there are no spare photos, which is the common
          case on a real site and must not leave a gap. */}
      {morePhotos.length ? (
        <Section density="connector">
          <div className="le-svc-strip">
            {morePhotos.map(p => (
              <figure key={p.id} style={{ margin: 0 }}>
                <SitePhotoImg
                  photo={p}
                  alt={p.caption ?? `${content.businessName} — ${service.name}`}
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </figure>
            ))}
          </div>
        </Section>
      ) : null}

      {service.signs?.length ? (
        <Section density="connector" band>
          <div className="le-grid">
            <div className="le-c1-6"><SectionHead eyebrow="How you know" heading="Signs you need this" /></div>
            <div className="le-c7-12">
              <ul className="le-signs">
                {service.signs.map(sign => <li key={sign}>{sign}</li>)}
              </ul>
            </div>
          </div>
        </Section>
      ) : null}

      {service.expect ? (
        <Section density="connector">
          <div className="le-grid">
            <div className="le-c1-6"><SectionHead eyebrow="What to expect" heading="Time and cost" /></div>
            <div className="le-c7-12"><p className="le-p">{service.expect}</p></div>
          </div>
        </Section>
      ) : null}

      <Trust testimonials={testimonials} band />
      <Faq faqs={faqs} />
      <Coverage content={content} />

      {otherServices.length > 0 ? (
        <Section density="connector" band>
          <div className="le-grid">
            <div className="le-c1-6"><SectionHead eyebrow="Also from us" heading="Other services" /></div>
          </div>
          <div className="le-other">
            {otherServices.map(name => (
              <a key={name} className="le-other-item" href={`/sites/${slug}/${serviceSlug(name)}`}>
                {name}
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      <Contact content={content}>
        <LeadForm siteId={siteId} />
      </Contact>
      <Footer content={content} />
    </>
  )
}

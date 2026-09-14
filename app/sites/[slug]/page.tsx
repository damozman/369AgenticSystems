/**
 * The public mini-site: /sites/<slug>.
 *
 * Server-rendered from the database on every request. Only a site with `status = 'live'` renders;
 * a draft, a suspended account and a slug that never existed all produce the same 404, so a
 * stranger cannot tell an unfinished site from a typo.
 *
 * `force-dynamic` on purpose. These pages are edited by an operator and must reflect a change the
 * moment it is saved: a customer who rings to say their phone number is wrong, watches it get
 * fixed, and still sees the old one has been shown that the product does not work. Caching is worth
 * revisiting once there is traffic to justify it, and it is a revalidation strategy rather than a
 * one-line change.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPhotos, loadSiteBySlug } from '@/lib/lead-engine/site'
import { accentModeFor, effectiveTemplate } from '@/lib/lead-engine/theme'
import { ThemeShell } from '@/components/lead-engine/SiteSections'
import { allocatePhotos } from '@/lib/lead-engine/photos'
import { coverageRenders, pageDensity, servicePages, serviceSlug } from '@/lib/lead-engine/sections'
import { fontClassFor } from '@/components/lead-engine/fonts'
import TradeClassic from '@/components/lead-engine/templates/TradeClassic'
import ServiceClean from '@/components/lead-engine/templates/ServiceClean'
import ShowcaseGrid from '@/components/lead-engine/templates/ShowcaseGrid'
import Practice from '@/components/lead-engine/templates/Practice'
import Supply from '@/components/lead-engine/templates/Supply'
import type { LeadEngineSite, SiteContent } from '@/lib/lead-engine/types'
import { businessSchema, faqSchema, pageTitle } from '@/lib/lead-engine/structured-data'
import { contentOf } from '@/lib/lead-engine/site-content'

export const dynamic = 'force-dynamic'

const TEMPLATES = {
  trade_classic: TradeClassic,
  service_clean: ServiceClean,
  showcase_grid: ShowcaseGrid,
  practice:      Practice,
  supply:        Supply,
} as const

/**
 * A site whose `content` was never built still has a name, so it renders a minimal page rather than
 * a 500. In practice an operator publishes with content; this guards the case where someone flips a
 * status by hand.
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const site = await loadSiteBySlug(slug)
  if (!site) return { title: 'Not found' }

  const content = contentOf(site)
  // The description is the business's own words or nothing at all — never a generated summary.
  // An invented sentence here is the one that appears in a Google result under their name. Q4a
  // (differentiator) is the closest thing to a required field this content model has — see
  // `whyUsItems`'s own note — so it is the only fallback; there is no second field to reach for.
  const description = content.differentiator

  return {
    // Trade plus town, not the business name alone. The name is what people search once they
    // already know the business -- and someone who already knows it is not the visitor these
    // pages exist to win. See `pageTitle` for how it degrades when either half is missing.
    title: pageTitle(content),
    ...(description ? { description } : {}),
    alternates: { canonical: `/sites/${slug}` },
    // ── Indexable since 2026-09-14 ──
    // This used to be `index: false`, on the reasoning that a mini-site must not compete with the
    // customer's own domain. That reasoning held while the mini-site was a supplement. Chris's
    // decision this session is that it IS the customer's website, and for a client who has no
    // other site the old setting meant we built them a page nobody could ever find.
    robots: { index: true, follow: true },
  }
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const site = await loadSiteBySlug(slug)
  if (!site) notFound()

  const photos = await loadPhotos(site.id)
  const content = contentOf(site)
  const template = effectiveTemplate(site.template, photos.length)
  const Template = TEMPLATES[template]

  // Re-validated at render rather than trusted from storage: the stored value was checked against
  // whatever theme the site had when it was saved, and an operator can change the theme afterwards.
  // The mode drives whether buttons use ink or paper for their label, which is the difference
  // between a readable CTA and an invisible one.
  const brand = site.brand ?? {}
  // Computed from the accent actually in force, whether the customer supplied one or the kit did.
  // Gating this on `brand.accent` defaulted every un-branded site to text_safe — which is wrong for
  // Yard, whose own equipment yellow is surface_only, so every rental site had unreadable buttons.
  const accentMode = accentModeFor(site.theme, brand)

  // brand.logo_url is a Storage path, not a URL — the same shape loadPhotos resolves.
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const logoUrl = brand.logo_url
    ? (/^https?:\/\//i.test(brand.logo_url) ? brand.logo_url : `${base}/storage/v1/object/public/${brand.logo_url}`)
    : undefined

  // Density decides the vertical rhythm: 128px between sections is rhythm on a full page and void
  // on a short one. Counted from the same predicates the sections render from, so it cannot drift.
  const galleryPhotos = allocatePhotos(photos, {
    hero: true,
    band: template === 'trade_classic',
  }).gallery
  // The template matters: Service Clean and Supply render no gallery at all, and counting one they
  // do not render is what gives a short page full rhythm — the void this whole pass removed.
  const density = pageDensity({ content, galleryPhotos, template, showAreasInProof: !coverageRenders(content) })

  // ── What Google reads ──
  // Built from what the customer actually answered; every absent field is omitted rather than
  // defaulted. See lib/lead-engine/structured-data.ts for why `aggregateRating` is the one that
  // must never be inferred.
  const origin = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '').replace(/\/+$/, '')
  const pageUrl = `${origin}/sites/${site.slug}`
  // ── The nav ──
  // Computed from `servicePages`, which is the single source for which service pages exist, so the
  // nav can never offer a link that 404s. Omitted entirely below two entries: a nav with one item
  // is worse than no nav.
  const navServices = servicePages(content, {
    photos,
    faqs: content.faqs ?? [],
    testimonials: content.testimonials ?? [],
  })
  const nav = navServices.length >= 2
    ? [
        { label: 'Home', href: `/sites/${site.slug}`, current: true },
        ...navServices.map(name => ({ label: name, href: `/sites/${site.slug}/${serviceSlug(name)}` })),
      ]
    : undefined

  const schemas = [
    businessSchema({ content, url: pageUrl, rating: content.rating ?? null }),
    faqSchema(content.faqs ?? []),
  ].filter(Boolean)

  return (
    // accentMode and density go ON .le-site, not on a wrapper around it — the CSS selectors are
    // `.le-site[data-accent-mode=...]`, and setting the attribute on a parent meant they never
    // matched and the button-contrast correction never fired.
    <ThemeShell
      theme={site.theme}
      brand={brand}
      fontClass={fontClassFor(site.theme)}
      accentMode={accentMode}
      density={density}
    >
      {/* Invisible to a visitor, and the half that decides whether one ever arrives. Rendered
          inside ThemeShell so it ships with the page rather than depending on a head-level
          mechanism that server components handle differently. */}
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <Template content={content} photos={photos} logoUrl={logoUrl} siteId={site.id} nav={nav} />
    </ThemeShell>
  )
}

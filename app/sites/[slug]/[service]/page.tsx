import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPhotos, loadSiteBySlug } from '@/lib/lead-engine/site'
import { contentOf } from '@/lib/lead-engine/site-content'
import { accentModeFor } from '@/lib/lead-engine/theme'
import { fontClassFor } from '@/components/lead-engine/fonts'
import { findServiceBySlug, serviceSlug, servicePages } from '@/lib/lead-engine/sections'
import { pageTitle, serviceSchema, faqSchema } from '@/lib/lead-engine/structured-data'
import { ThemeShell } from '@/components/lead-engine/SiteSections'
import ServicePage from '@/components/lead-engine/templates/ServicePage'
import type { SitePhoto } from '@/lib/lead-engine/types'

export const dynamic = 'force-dynamic'

/** Case- and whitespace-insensitive, the same comparison every other name match here uses. */
const sameName = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Everything the page needs, resolved once.
 *
 * `generateMetadata` and the page body both run this. Next dedupes the two `loadSiteBySlug` calls
 * within a request, and doing the 404 decision in one place is what stops the title and the body
 * disagreeing about whether a service exists.
 */
async function resolve(slug: string, serviceParam: string) {
  const site = await loadSiteBySlug(slug)
  if (!site) return null

  const photos = await loadPhotos(site.id)
  const content = contentOf(site)
  const context = {
    photos,
    faqs: content.faqs ?? [],
    testimonials: content.testimonials ?? [],
  }

  const service = findServiceBySlug(content, serviceParam, context)
  if (!service) return null

  return { site, content, photos, service, context }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; service: string }> },
): Promise<Metadata> {
  const { slug, service: serviceParam } = await params
  const found = await resolve(slug, serviceParam)
  if (!found) return { title: 'Not found' }

  const { content, service } = found
  // The service's own words, never a generated summary — the same rule the home page follows.
  const description = service.involves ?? service.description

  return {
    title: pageTitle(content, { service: service.name }),
    ...(description ? { description } : {}),
    alternates: { canonical: `/sites/${slug}/${serviceParam}` },
    robots: { index: true, follow: true },
  }
}

export default async function LeadEngineServicePage(
  { params }: { params: Promise<{ slug: string; service: string }> },
) {
  const { slug, service: serviceParam } = await params
  const found = await resolve(slug, serviceParam)
  // One 404 for three different situations — no such service, a service that has not earned a
  // page, and no site at all. A visitor must not be able to tell "they do not do that" from
  // "that page is not written yet".
  if (!found) notFound()

  const { site, content, photos, service, context } = found

  const photo: SitePhoto | undefined = photos.find(
    p => p.slot === 'service' && sameName(p.slotKey, service.name),
  )
  const faqs = (content.faqs ?? []).filter((f: { service?: string }) => sameName(f.service, service.name))
  const testimonials = (content.testimonials ?? []).filter((t: { jobType?: string }) => sameName(t.jobType, service.name))
  const allPages = servicePages(content, context)
  const otherServices = allPages.filter(n => n !== service.name)
  const navFor = allPages.length >= 2
    ? [
        { label: 'Home', href: `/sites/${slug}` },
        ...allPages.map(name => ({
          label: name,
          href: `/sites/${slug}/${serviceSlug(name)}`,
          current: name === service.name,
        })),
      ]
    : undefined

  const brand = site.brand ?? {}
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const logoUrl = brand.logo_url
    ? (/^https?:\/\//i.test(brand.logo_url) ? brand.logo_url : `${base}/storage/v1/object/public/${brand.logo_url}`)
    : undefined

  const origin = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '').replace(/\/+$/, '')
  const pageUrl = `${origin}/sites/${slug}/${serviceSlug(service.name)}`
  const schemas = [
    serviceSchema({ service, content, url: pageUrl }),
    faqSchema(faqs),
  ].filter(Boolean)

  return (
    <ThemeShell
      theme={site.theme}
      brand={brand}
      fontClass={fontClassFor(site.theme)}
      accentMode={accentModeFor(site.theme, brand)}
      density="full"
    >
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <ServicePage
        nav={navFor}
        content={content}
        service={service}
        photo={photo}
        faqs={faqs}
        testimonials={testimonials}
        otherServices={otherServices}
        logoUrl={logoUrl}
        siteId={site.id}
        slug={slug}
      />
    </ThemeShell>
  )
}

/**
 * The public mini-site: /sites/<slug>.
 *
 * Server-rendered from the database on every request. Only a site with `status = 'live'` renders;
 * everything else — a draft, a suspended account, a slug that never existed — is the same 404, so
 * a stranger cannot tell an unfinished site from a typo.
 *
 * `force-dynamic` on purpose. These pages are edited by an operator and must reflect a change the
 * moment it is saved: a customer who rings to say their phone number is wrong, watches it get
 * fixed, and still sees the old one has been told the product does not work. Caching is worth
 * revisiting once there is traffic to justify it, and it is a revalidation strategy rather than a
 * one-line change.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPhotos, loadSiteBySlug } from '@/lib/lead-engine/site'
import { effectiveTemplate } from '@/lib/lead-engine/content'
import { siteStyles } from '@/components/lead-engine/SiteSections'
import TradeClassic from '@/components/lead-engine/templates/TradeClassic'
import ServiceClean from '@/components/lead-engine/templates/ServiceClean'
import ShowcaseGrid from '@/components/lead-engine/templates/ShowcaseGrid'
import type { SiteContent } from '@/lib/lead-engine/types'

export const dynamic = 'force-dynamic'

const TEMPLATES = {
  trade_classic: TradeClassic,
  service_clean: ServiceClean,
  showcase_grid: ShowcaseGrid,
} as const

/**
 * A site whose `content` was never built still has a name, so it can still render a minimal page
 * rather than 500. In practice an operator publishes with content; this is the guard for the case
 * where someone flips a status by hand.
 */
function contentOf(site: { content: SiteContent | null; business_name: string }): SiteContent {
  return site.content ?? {
    businessName: site.business_name,
    cta: { label: 'Get a Free Estimate', kind: 'form' },
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const site = await loadSiteBySlug(slug)
  if (!site) return { title: 'Not found' }

  const content = contentOf(site)
  // The description is the business's own words or nothing at all — never a generated summary.
  // An invented sentence here is the one that shows up in a Google result under their name.
  const description = content.differentiator ?? content.intro

  return {
    title: content.businessName,
    ...(description ? { description } : {}),
    // A mini-site is not part of our marketing surface and must not compete with the customer's
    // own domain in search. Revisit if a customer points a real domain at us.
    robots: { index: false, follow: true },
  }
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const site = await loadSiteBySlug(slug)
  if (!site) notFound()

  const photos = await loadPhotos(site.id)
  const content = contentOf(site)
  const Template = TEMPLATES[effectiveTemplate(site.template, photos.length)]

  return (
    <div className="le-site">
      <style dangerouslySetInnerHTML={{ __html: siteStyles() }} />
      <Template content={content} photos={photos} />
    </div>
  )
}

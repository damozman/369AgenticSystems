import type { MetadataRoute } from 'next'
import { loadLiveSitesForSitemap } from '@/lib/lead-engine/site'
import { sitePaths } from '@/lib/lead-engine/sitemap'
import { siteOrigin } from '@/lib/lead-engine/origin'

/**
 * The sitemap `robots.txt` points at, and therefore the only one a crawler finds on its own.
 *
 * ── Why this reads the database ──
 * Every Lead Engine mini-site is a page on this domain, and as of 2026-09-14 they are indexable —
 * the decision that the mini-site IS the customer's website. A per-site sitemap that nothing links
 * to is a file nobody fetches, so without this the mini-sites would be discoverable only by
 * someone who already had the URL. That is the whole point of removing `noindex`.
 *
 * Failure degrades to the three static pages rather than throwing: a Supabase outage must not take
 * down `/sitemap.xml` for the marketing site.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin()

  const base: MetadataRoute.Sitemap = [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    // Listed so Google's OAuth verification reviewer can find them from the domain itself,
    // not only from the console entry.
    {
      url: `${origin}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${origin}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  let sites: Awaited<ReturnType<typeof loadLiveSitesForSitemap>> = []
  try {
    sites = await loadLiveSitesForSitemap()
  } catch (err) {
    console.error('[LEAD-ENGINE] Sitemap could not list live sites:', err)
  }

  const siteEntries: MetadataRoute.Sitemap = sites.flatMap(site =>
    // Same `sitePaths` the per-site sitemap and the nav use, so a URL here always resolves.
    sitePaths(site.slug, site.content, {
      photos: site.photos,
      faqs: site.content.faqs ?? [],
      testimonials: site.content.testimonials ?? [],
    }).map(path => ({ url: `${origin}${path}` })),
  )

  return [...base, ...siteEntries]
}

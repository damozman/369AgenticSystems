/**
 * One mini-site's sitemap: /sites/<slug>/sitemap.xml
 *
 * Exists so a customer's site can be submitted to Google Search Console on its own — that is the
 * form the console asks for, one sitemap per property — and so an operator can see at a glance
 * exactly which pages a client's site publishes.
 *
 * The root /sitemap.xml lists every live site's pages as well, and that is the one a crawler finds
 * by itself, because robots.txt points at it. This route is the per-client view of the same facts,
 * built from the same `sitePaths()`, so the two cannot disagree.
 *
 * A slug that is not live 404s, exactly as the page does. A sitemap is a public statement that a
 * page exists; answering for a draft would leak one.
 *
 * ── There is deliberately no sibling robots.txt ──
 * A crawler only ever fetches robots.txt from the ROOT of an origin. Every mini-site is served from
 * this domain, so `/sites/<slug>/robots.txt` would be a file no crawler requests — decoration that
 * looks like coverage. The file that governs these pages is `app/robots.ts`, and it allows them.
 * If a customer's own domain is ever mapped to their site, THAT origin needs its own root
 * robots.txt, and it becomes worth building at the same time as the mapping.
 */
import { NextResponse } from 'next/server'
import { loadSiteBySlug, loadPhotos } from '@/lib/lead-engine/site'
import { contentOf } from '@/lib/lead-engine/site-content'
import { siteOrigin } from '@/lib/lead-engine/origin'
import { sitePaths, sitemapXml } from '@/lib/lead-engine/sitemap'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const site = await loadSiteBySlug(slug)
  if (!site) return new NextResponse('Not found', { status: 404 })

  const content = contentOf(site)
  const photos = await loadPhotos(site.id)
  const origin = siteOrigin(request.url)

  const xml = sitemapXml(
    sitePaths(site.slug, content, {
      photos,
      faqs: content.faqs ?? [],
      testimonials: content.testimonials ?? [],
    }).map(path => ({ loc: `${origin}${path}` })),
  )

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Short, not zero. The pages themselves are force-dynamic because a customer watching their
      // phone number get corrected must see it immediately; nobody watches a sitemap, and an hour
      // of staleness there costs nothing while a crawler re-fetching it every time costs a query.
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  })
}

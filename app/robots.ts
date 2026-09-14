import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/lib/lead-engine/origin'

/**
 * `/sites` is deliberately NOT disallowed. The Lead Engine mini-sites became indexable on
 * 2026-09-14 — they are the customer's website, and a page nobody can find is not one.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin()
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/login', '/api/'] },
    sitemap: `${origin}/sitemap.xml`,
  }
}

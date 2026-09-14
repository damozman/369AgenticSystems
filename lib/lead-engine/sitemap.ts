/**
 * What a mini-site offers a crawler.
 *
 * Pure. The database reads live in `site.ts` and the HTTP shape lives in the route — this file only
 * answers "which pages exist" and "what does that look like as XML", which is the part worth
 * testing exhaustively.
 *
 * ── The rule ──
 * A sitemap lists only pages that exist. `servicePages()` is the single source for which service
 * pages a site has, and it is the same call the nav and the route itself make, so the sitemap
 * cannot advertise a URL that 404s. Submitting URLs that 404 is not neutral: it is the signal that
 * tells Google the site is unmaintained.
 */
import { servicePages, serviceSlug } from '@/lib/lead-engine/sections'
import type { SiteContent } from '@/lib/lead-engine/types'

export interface SitemapEntry {
  loc: string
  /** ISO date, omitted when nothing truthful is known. A guessed lastmod is worse than none. */
  lastmod?: string
}

/**
 * Every path a site publishes, home page first.
 *
 * Paths, not URLs — the origin is decided once, at the edge, by `siteOrigin()`.
 */
export function sitePaths(
  slug: string,
  content: SiteContent,
  context: Parameters<typeof servicePages>[1] = {},
): string[] {
  return [
    `/sites/${slug}`,
    ...servicePages(content, context).map(name => `/sites/${slug}/${serviceSlug(name)}`),
  ]
}

/** XML text escaping. Ampersands in a `<loc>` are what break a sitemap parse most often. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * A sitemap document.
 *
 * No `changefreq` and no `priority`: Google has stated for years that it ignores both, and a field
 * that is ignored is a field that can only ever be wrong. `lastmod` is emitted only when the caller
 * has a real date.
 */
export function sitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(entry => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

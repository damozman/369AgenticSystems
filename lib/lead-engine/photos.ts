/**
 * Which photo goes where.
 *
 * A page can want an image in four places — the hero, a full-bleed band, one per row of the
 * services ladder, and the gallery — and a customer has at most twelve. Without a single allocator
 * each section reaches into the same array from the top and the same roof appears three times on
 * one page. That is the cheapest possible tell that a site was generated, and it is invisible in
 * every test because each section is individually correct.
 *
 * So: one function, disjoint slices, deterministic by `sort_order` (the array arrives already in
 * that order). Pure — no I/O, no React.
 */

import type { SitePhoto } from '@/lib/lead-engine/types'

export const MAX_GALLERY_PHOTOS = 6

export interface PhotoAllocation {
  hero?: SitePhoto
  band?: SitePhoto
  /** One per services-ladder row, in row order. Empty when the ladder layout is not in use. */
  ladder: SitePhoto[]
  gallery: SitePhoto[]
}

/**
 * Hand out photos in a fixed priority: hero, band, ladder, gallery.
 *
 * **The ladder wins when there are not enough for both**, and the gallery reduces — to nothing, at
 * which point it does not render. That order is deliberate: a ladder row with a missing image is a
 * broken layout, whereas a shorter gallery is just a shorter gallery. Degrade the decorative thing,
 * never the structural one.
 *
 * **Two Part B additions, both structured so disjointness still holds by construction** — every
 * pick removes its photo from the same pool before the next pick runs, so no path can hand the
 * same photo to two slots:
 *
 * - `isPrimary` overrides sort_order for the hero slot only. The customer told us their best
 *   photo; it is spliced out of the pool up front so every later pick already excludes it.
 * - Hero and band prefer the pool's most/least-wide photo by `aspectRatio` when that data exists
 *   — the band wants the widest available, the hero the least-wide (a 21:9 landscape cropped into
 *   a tall hero slot loses most of its subject). **A photo with no `aspectRatio` (everything
 *   uploaded before Part B shipped) falls back to plain `sort_order`**, which is exactly the old
 *   behaviour — this is why the pre-Part-B tests below are unchanged.
 */
export function allocatePhotos(
  photos: SitePhoto[],
  need: { hero?: boolean; band?: boolean; ladderRows?: number } = {},
): PhotoAllocation {
  const pool = [...photos]

  let primary: SitePhoto | undefined
  if (need.hero) {
    const i = pool.findIndex(p => p.isPrimary)
    if (i !== -1) primary = pool.splice(i, 1)[0]
  }

  const takeByAspect = (prefer: 'widest' | 'narrowest'): SitePhoto | undefined => {
    if (pool.length === 0) return undefined
    const withRatio = pool.filter(p => typeof p.aspectRatio === 'number')
    if (withRatio.length === 0) return pool.shift()
    let best = withRatio[0]
    for (const p of withRatio) {
      const better = prefer === 'widest' ? p.aspectRatio! > best.aspectRatio! : p.aspectRatio! < best.aspectRatio!
      if (better) best = p
    }
    pool.splice(pool.indexOf(best), 1)
    return best
  }

  const hero = need.hero ? (primary ?? takeByAspect('narrowest')) : undefined
  const band = need.band ? takeByAspect('widest') : undefined

  const ladder: SitePhoto[] = []
  for (let i = 0; i < (need.ladderRows ?? 0); i++) {
    const next = pool.shift()
    if (!next) break
    ladder.push(next)
  }

  return { hero, band, ladder, gallery: pool.slice(0, MAX_GALLERY_PHOTOS) }
}

/**
 * Which services layout to use.
 *
 * The image ladder needs a photo per row, so it is only worth choosing when the list is short
 * enough that they exist. Seven or more services in a ladder is a very long page of alternating
 * images; that is what the two-column list is for.
 */
export function servicesLayout(serviceCount: number, photosAvailable: number): 'ladder' | 'list' {
  if (serviceCount < 3 || serviceCount > 6) return 'list'
  return photosAvailable >= serviceCount ? 'ladder' : 'list'
}

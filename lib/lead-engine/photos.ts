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
  /**
   * Photos for the Services section, in order. Serves the ladder (one per row) and the mosaic
   * (one per photo tile). Named for the SECTION rather than for one of its two layouts, because
   * a field called `ladder` feeding a mosaic is exactly the misleading-name trap this repo has
   * already been bitten by.
   */
  services: SitePhoto[]
  gallery: SitePhoto[]
}

/**
 * Hand out photos in a fixed priority: hero, band, services, gallery.
 *
 * **The services section wins when there are not enough for both**, and the gallery reduces — to nothing, at
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
  need: { hero?: boolean; band?: boolean; serviceSlots?: number } = {},
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

  const services: SitePhoto[] = []
  for (let i = 0; i < (need.serviceSlots ?? 0); i++) {
    const next = pool.shift()
    if (!next) break
    services.push(next)
  }

  return { hero, band, services, gallery: pool.slice(0, MAX_GALLERY_PHOTOS) }
}

/**
 * Which services layout to use.
 *
 * The image ladder needs a photo per row, so it is only worth choosing when the list is short
 * enough that they exist. Seven or more services in a ladder is a very long page of alternating
 * images; that is what the two-column list is for.
 *
 * ── The mosaic is OPT-IN, and that is a deliberate constraint rather than caution ──
 * Four templates share this function. A photo mosaic of "practice areas" is wrong for a law firm
 * and wrong for a dental surgery, so it cannot be a global return — Trade Classic asks for it and
 * nobody else does. It is equally NOT driven by the kit: `data-theme` is bounded to paint and
 * chrome on identical markup, and a mosaic is different markup, so keying it off `forge` would
 * quietly turn a theme into a layout.
 *
 * **The mosaic needs FEWER photos than the ladder, which is the point.** A ladder row without an
 * image is a broken row, so the ladder demands one per service. A mosaic tile without an image is
 * a deliberate block of colour, so it only needs enough photos to read as a photo composition —
 * half the tiles, rounded up. That band (half the services up to all of them) is a real range
 * where the ladder cannot render at all and the two-column list throws every photo away.
 */
export function servicesLayout(
  serviceCount: number,
  photosAvailable: number,
  opts: { allowMosaic?: boolean } = {},
): 'mosaic' | 'ladder' | 'list' {
  if (serviceCount < 3 || serviceCount > 6) return 'list'
  if (opts.allowMosaic && photosAvailable >= Math.ceil(serviceCount / 2)) return 'mosaic'
  return photosAvailable >= serviceCount ? 'ladder' : 'list'
}

// ── The mosaic ──────────────────────────────────────────────────────────────

/** A 1- or 2-column-wide tile. `photoIndex` null means it is a colour block instead. */
export interface MosaicTile {
  span: 1 | 2
  photoIndex: number | null
  fill: 'accent' | 'structure' | null
}

/**
 * Column spans per tile, for a three-column grid.
 *
 * A fixed table rather than an algorithm, because the only property that matters is that **every
 * row fills exactly** — a trailing half-empty row is the void this layout exists to remove, and it
 * is the failure the hand-built mockup actually had at six services. Each row of the table sums to
 * a multiple of three; `mosaicSpans.test` asserts that for every count rather than trusting it.
 *
 * Counts outside 3-6 never reach here: `servicesLayout` sends them to the list.
 */
export function mosaicSpans(serviceCount: number): (1 | 2)[] {
  switch (serviceCount) {
    case 3:  return [1, 1, 1]           // one row
    case 4:  return [2, 1, 1, 2]        // two rows, feature at each end
    case 5:  return [2, 1, 1, 1, 1]     // a feature, then an even row
    case 6:  return [2, 1, 2, 1, 2, 1]  // three rows, alternating feature and narrow
    default: return []
  }
}

/**
 * Which tiles carry a photograph, and what the rest are filled with.
 *
 * **The widest tiles take the photographs first.** A feature tile is the biggest thing in the
 * section and a flat colour block at that size reads as a missing image, where the same block at
 * one column reads as a deliberate change of pace. With the 6-service pattern this also produces
 * the alternating photo/colour rhythm without anyone placing it by hand — the wides sit at 0, 2
 * and 4, so three photographs land interleaved rather than bunched at the front.
 *
 * Colour tiles alternate accent and structure so two identical blocks never touch.
 *
 * Photo INDEXES are handed out in the same widest-first order, so index 0 — the first photo the
 * allocator assigned to this section — lands on the largest tile rather than wherever it happens
 * to fall in document order.
 */
export function mosaicPlan(serviceCount: number, photosAvailable: number): MosaicTile[] {
  const spans = mosaicSpans(serviceCount)
  if (spans.length === 0) return []

  // Widest first, ties broken by position, so the result is deterministic rather than
  // sort-implementation dependent.
  const byWidth = spans.map((span, i) => ({ span, i }))
    .sort((a, b) => b.span - a.span || a.i - b.i)

  const photoAt = new Map<number, number>()
  for (const { i } of byWidth.slice(0, Math.max(0, Math.min(photosAvailable, serviceCount)))) {
    photoAt.set(i, photoAt.size)
  }

  let colourTurn = 0
  return spans.map((span, i) => {
    const photoIndex = photoAt.get(i)
    if (photoIndex !== undefined) return { span, photoIndex, fill: null }
    return { span, photoIndex: null, fill: colourTurn++ % 2 === 0 ? 'accent' as const : 'structure' as const }
  })
}

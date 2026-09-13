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
import { WARN_PHOTO_LONG_EDGE } from '@/lib/lead-engine/limits'

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
  services: (SitePhoto | undefined)[]
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
  need: { hero?: boolean; band?: boolean; serviceSlots?: number; serviceNames?: string[] } = {},
): PhotoAllocation {
  const pool = [...photos]

  /** Pull one photo out of the pool by predicate, or undefined. */
  const claim = (match: (p: SitePhoto) => boolean): SitePhoto | undefined => {
    const i = pool.findIndex(match)
    return i === -1 ? undefined : pool.splice(i, 1)[0]
  }

  // ── Explicit placements come out FIRST, before anything automatic runs ──
  // An operator pointing at a photo and naming its slot is a stated intent, and the automatic
  // rules exist only to answer the question nobody answered. Claiming these up front is also what
  // guarantees disjointness: a pinned photo is out of the pool before any preference can pick it.
  const pinnedHero = need.hero ? claim(p => p.slot === 'hero') : undefined
  const pinnedBand = need.band ? claim(p => p.slot === 'band') : undefined

  // Photos pinned to the gallery are held back so no automatic slot can take them, and put back
  // at the end. Without this a "gallery" pin would be silently ignored whenever a service tile
  // needed filling.
  const pinnedGallery: SitePhoto[] = []
  for (;;) {
    const g = claim(p => p.slot === 'gallery')
    if (!g) break
    pinnedGallery.push(g)
  }

  // ⚠ SERVICE PINS COME OUT NOW, not when the tiles are filled further down.
  //
  // This line is the whole bug it was written to fix, and it is worth being blunt about: the first
  // version claimed hero/band/gallery pins here and left service pins in the pool until the
  // services loop. By then `takeByAspect` had already run for the band -- and on a real site it
  // chose the widest photo in the pool, which was the one pinned to "Drain cleaning". The band got
  // a service's photograph and the drain tile rendered empty.
  //
  // Held as a list rather than resolved against `serviceNames` here, because an unmatched pin (the
  // service was renamed) must fall back into the automatic pool rather than disappear -- so the
  // ones that find no tile are returned below.
  const pinnedServices: SitePhoto[] = []
  for (;;) {
    const sv = claim(p => p.slot === 'service')
    if (!sv) break
    pinnedServices.push(sv)
  }

  let primary: SitePhoto | undefined
  if (need.hero && !pinnedHero) {
    const i = pool.findIndex(p => p.isPrimary)
    if (i !== -1) primary = pool.splice(i, 1)[0]
  }

  /**
   * Whether a photo is big enough for a slot that renders it very large.
   *
   * Unknown size counts as eligible. Every photo uploaded before the Part B pipeline has no
   * dimensions, and excluding those would empty the hero on every older site — the same
   * degrade-don't-disappear rule the aspect preference already follows.
   */
  const bigEnough = (p: SitePhoto): boolean =>
    typeof p.width !== 'number' || typeof p.height !== 'number'
      ? true
      : Math.max(p.width, p.height) >= WARN_PHOTO_LONG_EDGE

  const takeByAspect = (prefer: 'widest' | 'narrowest', needsSize = false): SitePhoto | undefined => {
    if (pool.length === 0) return undefined

    // Resolution first, aspect second -- a softened hero is more visible than a slightly
    // wrong crop. A PREFERENCE with a fallback, never a filter: if nothing in the pool clears
    // the threshold, the slot still gets the best available rather than rendering empty.
    const eligible = needsSize && pool.some(bigEnough) ? pool.filter(bigEnough) : pool

    const withRatio = eligible.filter(p => typeof p.aspectRatio === 'number')
    if (withRatio.length === 0) {
      const first = eligible[0]
      if (!first) return undefined
      pool.splice(pool.indexOf(first), 1)
      return first
    }
    let best = withRatio[0]
    for (const p of withRatio) {
      const better = prefer === 'widest' ? p.aspectRatio! > best.aspectRatio! : p.aspectRatio! < best.aspectRatio!
      if (better) best = p
    }
    pool.splice(pool.indexOf(best), 1)
    return best
  }

  // `primary` is NOT size-checked, deliberately. It is a person pointing at a photo and saying
  // "this one"; overriding a stated choice on pixel count is the system second-guessing intent.
  // The size preference governs only the automatic pick.
  const hero = need.hero ? (pinnedHero ?? primary ?? takeByAspect('narrowest', true)) : undefined
  const band = need.band ? (pinnedBand ?? takeByAspect('widest', true)) : undefined

  // ── Services: named pins land on their own tile, the rest fill in order ──
  // `serviceNames` is what makes a pin resolvable at all; without it there is nothing to match a
  // slotKey against and the old positional behaviour is the only thing available. Callers that do
  // not care still pass `serviceSlots`.
  const names = need.serviceNames
  const slotCount = names?.length ?? need.serviceSlots ?? 0
  const services: (SitePhoto | undefined)[] = new Array(slotCount).fill(undefined)

  if (names) {
    // Exact, case-insensitive match on the service name.
    names.forEach((name, i) => {
      const key = name.trim().toLowerCase()
      const j = pinnedServices.findIndex(p => (p.slotKey ?? '').trim().toLowerCase() === key)
      if (j !== -1) services[i] = pinnedServices.splice(j, 1)[0]
    })
  }

  // Any pin that matched no tile -- its service was renamed or deleted after the photo was pinned
  // -- rejoins the pool at the front rather than being dropped. Stale intent degrades to automatic
  // placement; it never costs the customer a photograph. `unshift` keeps them ahead of genuinely
  // unassigned photos, since someone did at least mean these to appear in the services section.
  pool.unshift(...pinnedServices)

  // Fill whatever is still empty from the pool, in order. A tile left empty by an unmatched pin
  // gets a photo here rather than rendering blank.
  for (let i = 0; i < slotCount; i++) {
    if (services[i]) continue
    const next = pool.shift()
    if (!next) break
    services[i] = next
  }

  // Trailing empties are dropped so `services.length` still means "how many photos this section
  // actually has" for the layout maths. Interior holes are kept: they belong to a named tile that
  // could not be filled, and both the ladder and the mosaic already guard on a missing photo.
  while (services.length > 0 && !services[services.length - 1]) services.pop()

  return {
    hero,
    band,
    services,
    gallery: [...pinnedGallery, ...pool].slice(0, MAX_GALLERY_PHOTOS),
  }
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
export function mosaicPlan(
  serviceCount: number,
  photosAvailable: number,
  /**
   * Which tiles actually hold a photo, index-aligned with the services.
   *
   * ⚠ Pass this whenever the caller knows, which is every real render. Without it the photo index
   * is a COUNTER handed out widest-tile-first, so tile 3 can point at photo 1 — fine when photos
   * are an interchangeable pool, wrong the moment a photo is pinned to a named service, and the
   * reason a pinned mosaic scrambles at four services or more. It also cannot express a hole: a
   * tile pointing at a missing photo rendered with no image AND no colour fill, which is a white
   * box on a customer's page.
   *
   * The count-only form is kept for the pure span tests below, which have no photos at all.
   */
  hasPhotoAt?: readonly boolean[],
): MosaicTile[] {
  const spans = mosaicSpans(serviceCount)
  if (spans.length === 0) return []

  const photoAt = new Map<number, number>()

  if (hasPhotoAt) {
    // Identity: tile i shows photo i. The allocator already decided which service gets which
    // photograph, and that decision may have been made by a person.
    spans.forEach((_, i) => { if (hasPhotoAt[i]) photoAt.set(i, i) })
  } else {
    // Widest first, ties broken by position, so the result is deterministic rather than
    // sort-implementation dependent.
    const byWidth = spans.map((span, i) => ({ span, i }))
      .sort((a, b) => b.span - a.span || a.i - b.i)

    for (const { i } of byWidth.slice(0, Math.max(0, Math.min(photosAvailable, serviceCount)))) {
      photoAt.set(i, photoAt.size)
    }
  }

  let colourTurn = 0
  return spans.map((span, i) => {
    const photoIndex = photoAt.get(i)
    if (photoIndex !== undefined) return { span, photoIndex, fill: null }
    return { span, photoIndex: null, fill: colourTurn++ % 2 === 0 ? 'accent' as const : 'structure' as const }
  })
}

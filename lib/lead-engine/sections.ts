/**
 * What each section will actually render, decided in one place.
 *
 * These were inline in the components, which had two costs. They could not be tested — every
 * defect in this file's history was found by looking at a rendered page — and no caller could ask
 * "how many sections will this page have?", which is what decides whether the vertical rhythm
 * reads as deliberate or as void.
 *
 * Pure. No React, no I/O.
 */

import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'

// ── Proof bar ────────────────────────────────────────────────────────────────

export type ProofFact = readonly [label: string, value: string]

/**
 * The facts a proof bar can show.
 *
 * `Google Business Profile` is deliberately NOT one of them. It was rendering under a REVIEWS
 * label, which is a slot built for a number — "4.8 · 127 reviews" is proof, a link name is not.
 * The link already lives in the footer, which is where a link belongs.
 */
export function proofFacts(content: SiteContent, opts: { showAreas?: boolean } = {}): ProofFact[] {
  const facts: ProofFact[] = []
  if (content.yearsInBusiness) facts.push(['In business', content.yearsInBusiness])
  if (content.credentials)     facts.push(['Credentials', content.credentials])
  if (opts.showAreas !== false && content.serviceAreas?.length) {
    facts.push(['Serving', content.serviceAreas.slice(0, 3).join(' · ')])
  }
  return facts.slice(0, 4)
}

/**
 * One fact is not a bar.
 *
 * A single cell spanning the full width between two rules is the thing that made `review-sparse`
 * read as broken. Below two facts the bar does not render and the hero carries the fact instead.
 */
export function proofBarRenders(content: SiteContent, opts: { showAreas?: boolean } = {}): boolean {
  return proofFacts(content, opts).length >= 2
}

// ── Why us ───────────────────────────────────────────────────────────────────

/**
 * The differentiator items.
 *
 * **Credentials are NOT part of this.** They used to be joined into the same string and split on
 * sentence boundaries — but a credential rarely ends in a full stop, so "Licensed and insured in
 * Texas" glued itself to the front of the next sentence and shipped on five of eight pages as
 * *"Licensed and insured in Texas Most people call us after a storm…"*.
 *
 * Credentials already render in the proof bar. Joining two independently-authored fields and
 * hoping punctuation separates them is the bug; keeping them apart is the fix.
 */
function sentences(s: string | undefined): string[] {
  return (s ?? '').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 20)
}

/**
 * The hero's lede: the FIRST sentence of the differentiator.
 *
 * One sentence, because a hero lede that runs to three is a paragraph and stops working as a lede.
 * The rest is not discarded — it feeds Why us below, which is what stops the two sections printing
 * the same words.
 */
export function heroLede(content: SiteContent): string | undefined {
  return sentences(content.differentiator)[0] ?? content.differentiator
}

/**
 * The differentiator items.
 *
 * **Credentials are NOT part of this.** They used to be joined into the same string and split on
 * sentence boundaries — but a credential rarely ends in a full stop, so "Licensed and insured in
 * Texas" glued itself to the front of the next sentence and shipped on five of eight pages as
 * *"Licensed and insured in Texas Most people call us after a storm…"*. Credentials render in the
 * proof bar. Joining two independently-authored fields and hoping punctuation separates them is
 * the bug; keeping them apart is the fix.
 *
 * **The hero's lede is not part of this either.** Every hero renders the first differentiator
 * sentence, so including it here printed the same sentence twice on one page — and on a thin site
 * it was the entire Why us section.
 */
export function whyUsItems(content: SiteContent): string[] {
  return [...sentences(content.differentiator).slice(1), ...sentences(content.intro)].slice(0, 4)
}

export function whyUsRenders(content: SiteContent): boolean {
  return whyUsItems(content).length > 0
}

// ── Coverage ─────────────────────────────────────────────────────────────────

/** Below three areas, a 4-column grid holding one city is a void, and the proof bar carries them. */
export function coverageRenders(content: SiteContent): boolean {
  return (content.serviceAreas?.length ?? 0) >= 3
}

/**
 * Column count from item count, so the last row never orphans.
 *
 * Five counties in a four-column grid leaves one alone on row two; six leaves two. Choosing the
 * column count from the item count is what makes the grid look intended.
 */
export function coverageColumns(count: number): number {
  if (count <= 4) return count
  if (count <= 6) return 3
  return 4
}

// ── Services ─────────────────────────────────────────────────────────────────

/**
 * The two-column list orphans an odd final item, so an odd short list goes to one column.
 *
 * Three services in two columns leaves the third beside an empty cell — which is exactly the
 * "more empty space than content" test. Under four items, one centred column reads as deliberate.
 */
export function servicesColumns(count: number): 1 | 2 {
  return count < 4 ? 1 : 2
}

// ── Gallery ──────────────────────────────────────────────────────────────────

export interface GalleryLayout {
  feature?: SitePhoto
  stack: SitePhoto[]
  /** The bottom row, with the column span each item takes in a 12-column grid. */
  rest: SitePhoto[]
  restSpan: number
}

/**
 * The gallery, reflowed to the number of photos it actually has.
 *
 * The allocator spends photos on the hero and the full-bleed band first, so the gallery routinely
 * gets five rather than six — and a fixed three-up row rendering two items left the right third
 * of the grid empty on Ironclad and Threshold. The bottom row's span is therefore computed from
 * what is left rather than assumed.
 */
export function galleryLayout(photos: SitePhoto[]): GalleryLayout | null {
  if (photos.length === 0) return null

  // Too few for a feature row — one balanced row instead.
  if (photos.length < 4) {
    return { stack: [], rest: photos, restSpan: 12 / photos.length }
  }

  const rest = photos.slice(3, 6)
  return {
    feature: photos[0],
    stack: photos.slice(1, 3),
    rest,
    restSpan: 12 / Math.max(1, rest.length),
  }
}

// ── Page density ─────────────────────────────────────────────────────────────

/**
 * How many sections a page will render, and therefore how tall its gaps should be.
 *
 * 128px between sections is rhythm on a full page and void on a short one. `review-sparse` — the
 * site a customer with no photos receives — had 128px gaps between sections holding three lines
 * each, and read as broken rather than as minimal.
 *
 * Counted from the same predicates the components use, so the count cannot drift from what renders.
 */
export function sectionCount(input: {
  content: SiteContent
  galleryPhotos: SitePhoto[]
  showAreasInProof?: boolean
}): number {
  const { content, galleryPhotos } = input
  let n = 1 // the hero always renders
  if (proofBarRenders(content, { showAreas: input.showAreasInProof })) n++
  if (content.services?.length) n++
  if (whyUsRenders(content)) n++
  if (galleryPhotos.length > 0) n++
  if (coverageRenders(content)) n++
  if (content.testimonials?.length) n++
  if (content.faqs?.length) n++
  n++ // the terminal CTA always renders
  return n
}

/** Fewer than five sections gets tighter rhythm — deliberate rather than sparse. */
export function pageDensity(input: Parameters<typeof sectionCount>[0]): 'full' | 'compact' {
  return sectionCount(input) < 5 ? 'compact' : 'full'
}

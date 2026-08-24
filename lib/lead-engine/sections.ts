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

import type { SiteContent, SitePhoto, Template } from '@/lib/lead-engine/types'

// ── Which templates render a photo gallery ───────────────────────────────────

/**
 * A gallery is not free page real estate — it is the largest element on the page and the one with
 * the least to say, and on two of the five templates it was there because the component existed
 * rather than because the buyer wanted it.
 *
 * **Service Clean and Supply render none.** A solicitor, an accountant and a trade supplier are
 * chosen on what they do and who they act for; six photographs of an office are the filler that
 * makes a page look generated. Their photos go to the services ladder and, on Supply, to a single
 * full-bleed band — one image, making no claim about its own contents.
 *
 * **Showcase Grid renders three, not six.** Six photographs above eight named items was the page
 * saying its inventory twice. See `SHOWCASE_GALLERY_PHOTOS`.
 *
 * This lives here rather than in the templates because `pageDensity` has to know: a page counted as
 * having a gallery it does not render gets full rhythm on a short page, which is the exact void
 * this module exists to remove.
 */
export const TEMPLATE_RENDERS_GALLERY: Record<Template, boolean> = {
  trade_classic: true,
  service_clean: false,
  showcase_grid: true,
  practice:      true,
  supply:        false,
}

/**
 * Showcase Grid shows three.
 *
 * At six it rendered a photo grid headed "What we have" directly above a list of eight named items
 * headed "Everything we stock" — the same inventory, twice, in two shapes. Chris's two options were
 * captioning every cell and cutting the list, or cutting the grid and keeping the list. The list
 * wins: it carries the item NAMES and the customer's own descriptions, which is the information a
 * hire buyer actually needs, and captioning the cells would require per-photo labels the
 * questionnaire does not collect. Pairing photo *i* with service *i* to manufacture them asserts a
 * correspondence nobody stated.
 *
 * Revisit when photo captions are collected — a captioned catalogue grid is the better end state.
 */
export const SHOWCASE_GALLERY_PHOTOS = 3

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
 * The hero's lede: Q4a, verbatim.
 *
 * Q4a ("what's one thing you do that other [vertical] businesses typically don't?") is a single
 * short-answer prompt, not an open paragraph — so unlike the field it replaced, there is no
 * sentence to extract. The whole answer IS the lede.
 */
export function heroLede(content: SiteContent): string | undefined {
  return content.differentiator
}

/**
 * A bare Q5 credential, given a subject and a verb so it reads as a sentence beside two
 * first-person ones rather than as a spec-sheet fragment.
 *
 * Settled 2026-08-24 against a real rendered comparison ("Class A CDL", "EPA certified", "Better
 * Business Bureau A+ rated" — see `docs/LEAD-ENGINE-PLAN.md`'s "Credentials read twice" section):
 * a bare credential reads oddly beside two full sentences in every case, so the lead-in is never
 * optional. A value that already opens with a subject and a verb ("We are fully licensed...") is
 * left alone — prefixing it would double up. Otherwise the value is either a licence/certification
 * NAME ("Class A CDL"), which reads naturally after "Holds ", or a STATUS or RATING phrase ("EPA
 * certified", "...A+ rated"), which does not parse after "Holds " and needs "We are " instead. The
 * two known rough edges (a participle like "certified" is not itself proof of "already a
 * sentence"; one fixed prefix cannot cover both shapes) are why this is two branches, not one.
 *
 * The status word can open the phrase ("Licensed and insured in Texas") as easily as close it
 * ("EPA certified") — a trailing-only check missed the first shape, which is one of the most
 * common answers this exact field collects across the templates already shipped.
 */
export function credentialWhyUsLine(raw: string): string {
  const value = raw.trim()
  const endWithPeriod = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

  if (/^(i|we|is|are|has|have)\b/i.test(value)) return endWithPeriod(value)
  if (/\b(certified|rated|licensed|insured|accredited|approved|registered|bonded|verified)\b/i.test(value)) {
    return endWithPeriod(`We are ${value}`)
  }
  return endWithPeriod(`Holds ${value}`)
}

/**
 * Why us's items: Q4a, Q4b, and — only when the business stated one — a Q5 credential.
 *
 * **Two items (4a, 4b) is the floor for anyone who answers the questionnaire at all**, not an edge
 * case: both are guaranteed, unskippable prompts (no 4a, no hero, no page — the same reasoning
 * that made the old single-paragraph Q4 required). The credential item is genuinely optional and
 * always third when present; it is never used to pad a short answer, unlike Q11 in the model this
 * replaced.
 *
 * **4a appears here AND as the hero lede, deliberately** — this is not the old duplication bug.
 * The old bug was one field split on sentence boundaries, where the first fragment was reused
 * *verbatim* in two places by construction. Here 4a and 4b are two independently-authored answers
 * to two different questions; 4a carries the hero's opening claim and is restated as this
 * section's own first item ("Our promise: <what 4a said>"), the same way a real credential
 * legitimately appears in both the proof bar and here — see `credentialWhyUsLine`'s own note.
 *
 * **Credentials are never concatenated into another item's string.** The original bug —
 * `differentiator + credentials + intro`, joined and split on sentence boundaries with no
 * separator — is not possible here: each source produces its own array entry, never a merge.
 *
 * **The credential item never appears alone.** It is the THIRD item, and only ever added once at
 * least one of 4a/4b is already present — a lone reformatted credential standing in for the whole
 * section is thin content earning its own heading, the same reasoning `proofBarRenders` already
 * applies to a single proof fact. In practice this never bites: 4a and 4b are the two unskippable
 * prompts, so a real submission always has at least one before Q5 is ever considered.
 */
export function whyUsItems(content: SiteContent): string[] {
  const items: string[] = []
  if (content.differentiator) items.push(content.differentiator)
  if (content.customerImpression) items.push(content.customerImpression)
  if (content.credentials && items.length > 0) items.push(credentialWhyUsLine(content.credentials))
  return items
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

// ── The editorial hero's right-hand columns ──────────────────────────────────

/**
 * The facts the editorial hero carries in columns 9–12, or none.
 *
 * The editorial hero was a text block in columns 1–8 with 9–12 empty — four dead columns, one more
 * than the composition rule allows, and on Counsel and Ledger it left half the first viewport
 * blank. Filling it with a decorative graphic would be filler; the honest content is already on the
 * page, one section lower, in the proof bar.
 *
 * So the hero takes them and **the proof bar below does not render**, which is what stops it being
 * the same facts printed twice. Below two facts there is no column worth building and the hero
 * centres instead — see `editorialHeroCentred`.
 */
export function editorialHeroFacts(content: SiteContent, opts: { showAreas?: boolean } = {}): ProofFact[] {
  const facts = proofFacts(content, opts)
  return facts.length >= 2 ? facts : []
}

/** With nothing to put beside it, a left-aligned block is centred at a 68ch measure instead. */
export function editorialHeroCentred(content: SiteContent, opts: { showAreas?: boolean } = {}): boolean {
  return editorialHeroFacts(content, opts).length === 0
}

/** These two templates have no hero image, so their hero carries the proof and the bar is dropped. */
export function heroCarriesProof(template: Template | undefined): boolean {
  return template === 'service_clean' || template === 'supply'
}

// ── Practice ─────────────────────────────────────────────────────────────────

/**
 * The access bar: the four things a patient checks before ringing.
 *
 * `acceptingNewPatients` renders in both directions. `false` — "Not taking new patients right now"
 * — is a real answer and the most useful sentence on the page for the patient it applies to. Only
 * `undefined`, the unanswered question, renders nothing.
 */
export function accessFacts(content: SiteContent): ProofFact[] {
  const a = content.access
  if (!a) return []
  const facts: ProofFact[] = []
  if (typeof a.acceptingNewPatients === 'boolean') {
    facts.push(['New patients', a.acceptingNewPatients ? 'Accepting new patients' : 'Not taking new patients right now'])
  }
  if (a.insuranceAccepted?.length) facts.push(['Insurance', insuranceLine(a.insuranceAccepted)])
  if (a.hours?.length)             facts.push(['Hours', a.hours.join(' · ')])
  if (a.location)                  facts.push(['Where', a.location])
  return facts
}

/** How many plan names fit a bar cell before the list becomes the whole section. */
const INSURERS_SHOWN = 6

/**
 * The insurance line, and why it may never quietly truncate.
 *
 * A cell that showed the first four of six plans read as a complete list — so a patient on the
 * fifth plan concluded the practice did not take theirs and rang somewhere else. Every other
 * truncation on these pages costs a reader some detail; this one costs the practice a patient who
 * was actually covered. When the list is cut, the line has to say that it was.
 */
export function insuranceLine(plans: string[]): string {
  if (plans.length <= INSURERS_SHOWN) return plans.join(' · ')
  const rest = plans.length - INSURERS_SHOWN
  return `${plans.slice(0, INSURERS_SHOWN).join(' · ')} · and ${rest} more — ask when you ring`
}

/** Same rule as the proof bar: one cell between two rules is not a bar. */
export function accessBarRenders(content: SiteContent): boolean {
  return accessFacts(content).length >= 2
}

export function teamRenders(content: SiteContent): boolean {
  return (content.team?.length ?? 0) > 0
}

/**
 * New-patient information needs enough to be worth a section.
 *
 * A heading over a single "bring your insurance card" is the void the three-element rule exists to
 * remove, and the FAQ already answers that shape of question.
 */
export function newPatientElements(content: SiteContent): number {
  const info = content.newPatientInfo
  if (!info) return 0
  return (info.firstVisit ? 1 : 0) + (info.whatToBring?.length ?? 0) + (info.formsUrl ? 1 : 0)
}

export function newPatientRenders(content: SiteContent): boolean {
  return newPatientElements(content) >= 3
}

/** Six members in a four-column grid orphans two, exactly as the coverage grid did. */
export function teamColumns(count: number): number {
  if (count <= 3) return Math.max(1, count)
  if (count === 4) return 4
  return 3
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
  /** Optional so a caller counting a generic page still works; passing it is strictly better. */
  template?: Template
  showAreasInProof?: boolean
}): number {
  const { content, galleryPhotos, template } = input
  let n = 1 // the hero always renders
  // On Service Clean and Supply the hero absorbed the proof bar, so it is not a section of its own.
  if (!heroCarriesProof(template) && proofBarRenders(content, { showAreas: input.showAreasInProof })) n++
  if (template === 'practice' && accessBarRenders(content)) n++
  if (content.services?.length) n++
  if (whyUsRenders(content)) n++
  if (template === 'practice' && teamRenders(content)) n++
  if (template === 'practice' && newPatientRenders(content)) n++
  // Counting a gallery a template does not render is what gives a short page full rhythm.
  if (galleryPhotos.length > 0 && (template ? TEMPLATE_RENDERS_GALLERY[template] : true)) n++
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

// ── Background rhythm: --paper vs --structure ─────────────────────────────────

/**
 * One candidate section in a page's background-alternation sequence.
 *
 * `renders` and `bandable` are independent: a section can render and still be ineligible to take
 * the dark background (Services and FAQ never band, by design — see `bandPlan`'s own doc), and a
 * section that will not render on this page contributes nothing to the count either way.
 */
export interface BandCandidate {
  key: string
  renders: boolean
  bandable: boolean
}

/**
 * Which sections should sit on `--structure` rather than `--paper`, computed from what the page
 * will ACTUALLY render — never from a fixed position in the template's section list.
 *
 * The first version of this hand-picked a named section per template — "band Coverage" — and it
 * broke on the very first real page it met: `review-sparse` has one service area, so `Coverage`
 * does not render at all, and the two bands either side of it (`WhyUs`, `Trust`) landed directly
 * against each other, merging into one large dark block instead of alternating. That is the exact
 * failure this whole pass exists to fix, just relocated rather than removed. The lesson is not new
 * — `sectionCount` already had to learn it ("counting a gallery a template does not render is what
 * gives a short page full rhythm") — but band placement had not learned it yet.
 *
 * The rule: walk the candidates in order, and once **two renderable, non-band sections** have
 * accumulated since the last band, the next bandable one flips. A non-bandable section that
 * renders still counts toward that run (it is still a paper section a reader scrolls past) but can
 * never itself be the one that flips. This makes two outcomes structurally impossible rather than
 * merely unlikely: a run of more than two consecutive paper sections, and two bands sitting next
 * to each other (banding always resets the run to zero, so the very next candidate can never
 * satisfy `>= 2` again immediately).
 *
 * Sections outside this list — a hero, a component that is already unconditionally band whenever
 * it renders at all (`AccessBar`; the wrapped proof bar on Showcase Grid), the terminal CTA — are
 * fixed points each template accounts for on either side of the candidates it passes in, not
 * something this function knows about. When a FIXED prefix like that can itself land on paper —
 * Practice's fallback proof bar, shown only when `AccessBar` does not render, is not wrapped in
 * band — the caller passes `startingPaperRun` for how many consecutive paper sections that prefix
 * already spent, so a page whose fixed segment ended on paper does not get an undeserved fresh run
 * of two more before the dynamic segment is allowed to band anything.
 */
export function bandPlan(candidates: BandCandidate[], startingPaperRun = 0): boolean[] {
  const result = new Array(candidates.length).fill(false)
  let paperRun = startingPaperRun
  candidates.forEach((c, i) => {
    if (!c.renders) return
    if (paperRun >= 2 && c.bandable) {
      result[i] = true
      paperRun = 0
    } else {
      paperRun++
    }
  })
  return result
}

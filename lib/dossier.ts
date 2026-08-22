/**
 * Builds the operational dossier. Step 4 — the thing every other step was feeding.
 *
 * Pure: takes what we already hold about a prospect and returns a structured document. No network,
 * no clock, no database, no model. Rendering to HTML is a separate concern (`lib/dossier-html.ts`)
 * so the *content* decisions below can be tested without parsing markup.
 *
 * **The governing rule, inherited from `lib/audit-call.ts` and now enforced here:** the model may
 * write the prose, the model may never invent a number. Nothing in this file estimates, benchmarks,
 * scores, or fills a gap with a plausible figure. What replaces a missing number is an omitted
 * section, and `omitted[]` records why so an operator can see what a prospect did not receive.
 *
 * **The single most dangerous line in this file is the arithmetic**, so it is worth stating plainly
 * what it does and does not do:
 *
 *   value of one missed call = avg_job_value × RECOVERY_RATE
 *
 * That is it. `monthly_volume` is deliberately NOT multiplied by `RECOVERY_RATE`. It is TOTAL
 * inbound volume — the number a prospect can actually estimate — not the missed portion, and
 * multiplying it would assert that 30% of every call they receive is recoverable revenue. That is a
 * fabricated number wearing a real one's clothes, and it is precisely the Gumloop failure this
 * whole pipeline exists to delete.
 *
 * And `RECOVERY_RATE` itself is an assumption, not a measurement, so any figure derived from it
 * carries `RECOVERY_RATE_NOTE` on screen — the same rule the on-page calculators already follow.
 *
 * Two calls cannot produce a rate either; `lib/audit-call-pair.ts` enforces that, and this file
 * simply prints what it returns.
 */

import { RECOVERY_RATE, RECOVERY_RATE_NOTE } from '@/lib/roi'
import { painLabel } from '@/lib/dossier-labels'
import { reportable as reportableObservations, type WebsiteAudit } from '@/lib/website-audit'
import { pairIsReportable, type AuditPair } from '@/lib/audit-call-pair'

export const DEMO_LINE = '(817) 635-0220'
export const BOOKING_URL = 'https://369agenticsystems.com/book-demo'

export type SectionId = 'told_us' | 'we_called' | 'your_website' | 'the_numbers' | 'what_next'

export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'facts'; rows: Array<{ label: string; value: string }> }
  | { kind: 'figure'; label: string; value: string; note?: string }
  | { kind: 'actions'; items: Array<{ label: string; detail: string }> }

export interface Section {
  id: SectionId
  title: string
  blocks: Block[]
}

export interface Dossier {
  /** Greeting name, if we have one. */
  firstName: string | null
  company: string | null
  sections: Section[]
  /** Operator-facing: what was left out and why. Never shown to the prospect. */
  omitted: Array<{ id: SectionId; why: string }>
}

export interface DossierInput {
  company?: string | null
  name?: string | null
  website?: string | null
  serviceArea?: string | null
  vertical?: string | null
  painPoints?: string[] | null
  monthlyVolume?: number | null
  avgJobValue?: number | null
  /** From `describeAuditPair`. Null when no call was placed at all. */
  calls?: AuditPair | null
  /** From `analysePage` / `fetchHomepage`. Null when no fetch was attempted. */
  site?: WebsiteAudit | null
}

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

/** ── 1 · What you told us ─────────────────────────────────────────────────
 *
 * Reflected back so they can correct it. Only rows we actually hold: a blank line here reads as
 * carelessness, and an invented one reads as worse.
 */
function sectionToldUs(input: DossierInput): Section | null {
  const rows: Array<{ label: string; value: string }> = []
  if (input.company) rows.push({ label: 'Business', value: input.company })
  if (input.serviceArea) rows.push({ label: 'Service area', value: input.serviceArea })
  if (input.website) rows.push({ label: 'Website', value: input.website })
  if (input.monthlyVolume != null) {
    rows.push({ label: 'Calls a month', value: input.monthlyVolume.toLocaleString('en-US') })
  }
  if (input.avgJobValue != null) {
    rows.push({ label: 'Average job value', value: money(input.avgJobValue) })
  }

  // In the order the form listed them — that order is the prospect's own priority, and the design
  // asks the dossier to address them in it.
  const pains = (input.painPoints ?? [])
    .map(k => painLabel(input.vertical ?? 'unlisted', k))
    .filter((s): s is string => Boolean(s))

  if (!rows.length && !pains.length) return null

  const blocks: Block[] = []
  if (rows.length) blocks.push({ kind: 'facts', rows })
  if (pains.length) {
    blocks.push({
      kind: 'paragraph',
      text: pains.length === 1
        ? 'The bottleneck you picked out:'
        : 'The bottlenecks you picked out, in the order you were asked about them:',
    })
    blocks.push({ kind: 'list', items: pains })
  }
  return { id: 'told_us', title: 'What you told us', blocks }
}

/** ── 2 · We called your line ─────────────────────────────────────────────── */
function sectionWeCalled(input: DossierInput): Section | null {
  const pair = input.calls
  if (!pair || !pairIsReportable(pair)) return null

  const blocks: Block[] = pair.sentences.map(text => ({ kind: 'paragraph', text }))
  if (pair.closing) blocks.push({ kind: 'paragraph', text: pair.closing })
  return { id: 'we_called', title: 'We called your line', blocks }
}

/** ── 4 · What we found on your website ──────────────────────────────────── */
function sectionWebsite(input: DossierInput): Section | null {
  const site = input.site
  if (!site?.reportable) return null
  const observations = reportableObservations(site)
  if (!observations.length) return null

  return {
    id: 'your_website',
    title: 'What we found on your website',
    blocks: [
      { kind: 'paragraph', text: 'Everything below is something you can check yourself in a few seconds.' },
      { kind: 'list', items: observations.map(o => o.sentence) },
    ],
  }
}

/** ── 5 · The arithmetic on your numbers ──────────────────────────────────
 *
 * One multiplication, and it needs exactly one input: the average value they gave us. See the file
 * header for why `monthly_volume` is not in it.
 */
function sectionNumbers(input: DossierInput): Section | null {
  if (input.avgJobValue == null) return null

  const perCall = Math.round(input.avgJobValue * RECOVERY_RATE)
  const blocks: Block[] = [
    {
      kind: 'figure',
      label: 'What one missed call is worth to you',
      value: money(perCall),
      note: RECOVERY_RATE_NOTE,
    },
    {
      kind: 'paragraph',
      text:
        `That is your own average job value of ${money(input.avgJobValue)}, at the rate above. ` +
        `It is what answering one call you would otherwise have missed is worth on average — not ` +
        `money you are guaranteed to recover.`,
    },
  ]

  // The honest end of the arithmetic: we do not know the frequency, and we do not pretend to.
  // Anything further is theirs to supply, which is also what makes it persuasive.
  const missed = input.calls && !['both_answered', 'nothing'].includes(input.calls.verdict)
  blocks.push({
    kind: 'paragraph',
    text: missed
      ? 'We know it happened at least once, because it happened when we called. How often it ' +
        'happens in a week is the one number we cannot see from outside — but you can, and that ' +
        'is the multiplication worth doing.'
      : 'How often that happens is the one number we cannot see from outside. You can, and that ' +
        'is the multiplication worth doing.',
  })

  return { id: 'the_numbers', title: 'The arithmetic on your numbers', blocks }
}

/** ── 6 · What the system does, and their choice ──────────────────────────
 *
 * Truthful capability only. Everything listed here is shipped and proven on real calls: answering,
 * checking a real calendar, booking, confirming by email, and alerting the owner. Nothing about
 * SMS, quoting, deposits or payment appears, because none of those exist.
 */
function sectionWhatNext(): Section {
  return {
    id: 'what_next',
    title: 'What we would put on your line',
    blocks: [
      {
        kind: 'list',
        items: [
          'Answers every call, at any hour, in your business’s name.',
          'Checks your real calendar before it offers a time — so it cannot offer one you do not have.',
          'Books the appointment and emails the caller a confirmation.',
          'Tells you who called, what they wanted, and how urgent it sounded.',
        ],
      },
      {
        kind: 'actions',
        items: [
          { label: `Call our own line on ${DEMO_LINE}`,
            detail: 'It is the same system, answering for us. Being the caller is the quickest way to judge it.' },
          { label: 'Reply to this email',
            detail: 'It reaches Chris directly, and he answers every one himself.' },
          { label: 'Book a 30-minute call',
            detail: BOOKING_URL },
        ],
      },
    ],
  }
}

/**
 * Assembles the dossier, omitting every section it has no evidence for.
 *
 * A thin dossier is a correct dossier when the inputs are thin. The alternative — padding it to a
 * respectable length with estimates — is the exact failure this replaces, and a prospect who spots
 * one invented figure discounts every real one next to it.
 */
export function buildDossier(input: DossierInput): Dossier {
  const omitted: Dossier['omitted'] = []
  const sections: Section[] = []

  const push = (s: Section | null, id: SectionId, why: string) => {
    if (s) sections.push(s)
    else omitted.push({ id, why })
  }

  push(sectionToldUs(input), 'told_us', 'nothing was captured from the form to reflect back')
  push(sectionWeCalled(input), 'we_called',
    input.calls ? `no call established anything: ${input.calls.detail}` : 'no audit call was placed')
  push(sectionWebsite(input), 'your_website',
    input.site ? `nothing readable: ${input.site.detail}` : 'no website was checked')
  push(sectionNumbers(input), 'the_numbers',
    'no average job value was given, and it is the only input to the arithmetic')

  // Always present: it describes what we do, which needs no evidence about them.
  sections.push(sectionWhatNext())

  const first = input.name?.trim().split(/\s+/)[0] ?? null
  return { firstName: first || null, company: input.company ?? null, sections, omitted }
}

/** Whether there is enough here to be worth sending at all. */
export function worthSending(dossier: Dossier): boolean {
  // `what_next` is always present and says nothing about them, so it does not count.
  return dossier.sections.some(s => s.id !== 'what_next')
}

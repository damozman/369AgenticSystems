import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDossier, worthSending, type DossierInput } from '@/lib/dossier'
import { RECOVERY_RATE } from '@/lib/roi'
import type { AuditPair } from '@/lib/audit-call-pair'
import type { WebsiteAudit } from '@/lib/website-audit'

const pairAnsweredThenVoicemail: AuditPair = {
  verdict: 'business_only',
  sentences: [
    'We called your main line Saturday at 12:35am. Someone picked up.',
    'We called your main line Saturday at 1:26am. It went to voicemail.',
    'Same number, same day. The difference was the hour.',
  ],
  closing: 'We only called twice, so this is two moments rather than a pattern — how often it happens is something only you can say.',
  detail: 'Business hours reached a person; the evening call did not.',
}

const site: WebsiteAudit = {
  reportable: true,
  detail: 'Read https://example.com/.',
  clientRendered: false,
  observations: [
    { id: 'phone_published', finding: 'present', sentence: 'Your phone number is published on your homepage.' },
    { id: 'contact_form', finding: 'undetermined', sentence: '' },
    { id: 'hours_published', finding: 'absent', sentence: 'We could not find your opening hours on your homepage.' },
  ],
}

const full: DossierInput = {
  company: 'Verify Roofing Co',
  name: 'Chris Mosley',
  website: 'https://example.com',
  serviceArea: 'Fort Worth, TX',
  vertical: 'roofing',
  painPoints: ['afterhours', 'speed'],
  monthlyVolume: 120,
  avgJobValue: 8200,
  calls: pairAnsweredThenVoicemail,
  site,
}

/**
 * Every human-visible string in the dossier, and nothing else.
 *
 * Deliberately not `JSON.stringify` — that includes the structure's own keys, so a block of kind
 * `paragraph` with a `text` field matched a search for the word "text" and failed a truthfulness
 * assertion that had actually found nothing wrong. Scan the prose, not the shape of it.
 */
const prose = (d: ReturnType<typeof buildDossier>): string => {
  const out: string[] = []
  for (const s of d.sections) {
    out.push(s.title)
    for (const b of s.blocks) {
      if (b.kind === 'paragraph') out.push(b.text)
      else if (b.kind === 'list') out.push(...b.items)
      else if (b.kind === 'facts') out.push(...b.rows.map(r => `${r.label} ${r.value}`))
      else if (b.kind === 'figure') out.push(b.label, b.value, b.note ?? '')
      else if (b.kind === 'actions') out.push(...b.items.map(i => `${i.label} ${i.detail}`))
    }
  }
  return out.join('\n')
}

const text = prose

const ids = (d: ReturnType<typeof buildDossier>) => d.sections.map(s => s.id)

// ── The arithmetic, which is the most dangerous thing here ──────────────────

test('the only money figure is average value × RECOVERY_RATE', () => {
  const d = buildDossier(full)
  const numbers = d.sections.find(s => s.id === 'the_numbers')!
  const figure = numbers.blocks.find(b => b.kind === 'figure') as { value: string; note?: string }
  assert.equal(figure.value, `$${Math.round(8200 * RECOVERY_RATE).toLocaleString('en-US')}`)
  assert.equal(figure.value, '$2,460')
})

test('monthly volume is NEVER multiplied by RECOVERY_RATE', () => {
  // 120 × 8200 × 0.30 = 295,200 — the figure that would assert 30% of every call they receive is
  // recoverable revenue. It must appear nowhere, in any rounding or formatting.
  const d = buildDossier(full)
  const body = text(d)
  for (const forbidden of ['295,200', '295200', '$295', '3,542,400', '984,000']) {
    assert.ok(!body.includes(forbidden), `dossier must not contain ${forbidden}`)
  }
})

test('every derived figure carries the assumption on screen', () => {
  const d = buildDossier(full)
  const numbers = d.sections.find(s => s.id === 'the_numbers')!
  const figure = numbers.blocks.find(b => b.kind === 'figure') as { note?: string }
  assert.match(figure.note ?? '', /30% of missed calls convert/)
})

test('the figure is stated as an average, not a guarantee', () => {
  const d = buildDossier(full)
  assert.match(text(d), /not\\nmoney you are guaranteed to recover|not money you are guaranteed to recover/)
})

test('no arithmetic at all without an average job value', () => {
  const d = buildDossier({ ...full, avgJobValue: null })
  assert.ok(!ids(d).includes('the_numbers'))
  assert.match(d.omitted.find(o => o.id === 'the_numbers')!.why, /only input to the arithmetic/)
})

test('volume alone buys no arithmetic', () => {
  // Volume without value says nothing about money, and inventing the value is the whole failure.
  const d = buildDossier({ ...full, avgJobValue: null, monthlyVolume: 500 })
  assert.ok(!ids(d).includes('the_numbers'))
})

// ── Omission, not estimation ────────────────────────────────────────────────

test('a section with no evidence is omitted and the reason recorded', () => {
  const d = buildDossier({ company: 'Solo Co' })
  assert.deepEqual(ids(d), ['told_us', 'what_next'])
  const reasons = Object.fromEntries(d.omitted.map(o => [o.id, o.why]))
  assert.match(reasons.we_called, /no audit call was placed/)
  assert.match(reasons.your_website, /no website was checked/)
  assert.match(reasons.the_numbers, /no average job value/)
})

test('an unreportable call is omitted, never softened', () => {
  const nothing: AuditPair = { verdict: 'nothing', sentences: [], detail: 'both calls failed on our side' }
  const d = buildDossier({ ...full, calls: nothing })
  assert.ok(!ids(d).includes('we_called'))
  assert.ok(!/could not reach you|unable to reach/i.test(text(d)))
})

test('an unreachable website is omitted, never reported as a finding about them', () => {
  const failed: WebsiteAudit = {
    reportable: false, unreportable: 'fetch_failed',
    detail: 'Could not reach it.', observations: [], clientRendered: false,
  }
  const d = buildDossier({ ...full, site: failed })
  assert.ok(!ids(d).includes('your_website'))
  assert.ok(!/no contact form|no phone number/i.test(text(d)))
})

test('a site with only undetermined observations prints nothing', () => {
  const shell: WebsiteAudit = {
    reportable: true, detail: 'client rendered', clientRendered: true,
    observations: [{ id: 'contact_form', finding: 'undetermined', sentence: '' }],
  }
  const d = buildDossier({ ...full, site: shell })
  assert.ok(!ids(d).includes('your_website'))
})

test('an empty dossier is not worth sending', () => {
  const d = buildDossier({})
  assert.equal(worthSending(d), false)
  // what_next says nothing about them, so it cannot carry a dossier on its own.
  assert.deepEqual(ids(d), ['what_next'])
})

test('one real fact makes it worth sending', () => {
  assert.equal(worthSending(buildDossier({ company: 'Solo Co' })), true)
})

// ── Reflecting their own answers back ───────────────────────────────────────

test('pain points print the words the prospect actually read', () => {
  const d = buildDossier(full)
  const told = d.sections.find(s => s.id === 'told_us')!
  const list = told.blocks.find(b => b.kind === 'list') as { items: string[] }
  assert.deepEqual(list.items, ['Missed calls after hours & weekends', 'Slow storm lead response'])
  // Never the raw key.
  assert.ok(!list.items.some(i => i === 'afterhours'))
})

test('pain points keep the order the form asked them in', () => {
  const d = buildDossier({ ...full, painPoints: ['speed', 'afterhours'] })
  const told = d.sections.find(s => s.id === 'told_us')!
  const list = told.blocks.find(b => b.kind === 'list') as { items: string[] }
  assert.equal(list.items[0], 'Slow storm lead response')
})

test('a key we cannot name is dropped, not printed raw', () => {
  const d = buildDossier({ ...full, painPoints: ['afterhours', 'not_a_real_key'] })
  assert.ok(!text(d).includes('not_a_real_key'))
})

test('a vertical with no label map falls back rather than printing keys', () => {
  const d = buildDossier({ ...full, vertical: 'something-new', painPoints: ['afterhours'] })
  assert.ok(text(d).includes('Missed calls after hours'))
})

// ── Truthfulness of the closing section ─────────────────────────────────────

test('what we offer never mentions a capability that does not exist', () => {
  // Scoped to the section where WE make claims. A prospect who checked "no follow-up on estimates
  // & quotes" has said the word "quote" themselves — reflecting their own answer back is not a
  // promise to quote, and a whole-document ban would forbid quoting them accurately.
  const d = buildDossier(full)
  const next = d.sections.find(s => s.id === 'what_next')!
  const body = prose({ ...d, sections: [next] })
  for (const claim of [/\btexts?\b/i, /\bSMS\b/i, /quote/i, /deposit/i, /payment/i, /invoice/i]) {
    assert.ok(!claim.test(body), `we must not claim: ${claim} — found in: ${body}`)
  }
})

test('nothing anywhere in the dossier promises SMS', () => {
  // Twilio is unconfigured in every environment; a text is the one promise this repo has already
  // had to strip out of live agents twice.
  const everything = prose(buildDossier(full))
  assert.ok(!/\bwe(?:'ll| will) text\b|\bsend you a text\b|\btext you\b/i.test(everything))
})

test('no score, grade or benchmark anywhere', () => {
  // A security_score of 41 for every business is what this whole pipeline replaces.
  const d = buildDossier(full)
  assert.ok(!/\bscore\b|\bgrade\b|\brating\b|out of 100|industry average|benchmark/i.test(text(d)))
})

test('the section that does the work prints the pair verbatim', () => {
  const d = buildDossier(full)
  const called = d.sections.find(s => s.id === 'we_called')!
  const paragraphs = called.blocks.map(b => (b as { text: string }).text)
  assert.deepEqual(paragraphs.slice(0, 3), pairAnsweredThenVoicemail.sentences)
  assert.equal(paragraphs[3], pairAnsweredThenVoicemail.closing)
})

test('when both calls were answered the arithmetic does not imply they miss calls', () => {
  const bothAnswered: AuditPair = {
    verdict: 'both_answered',
    sentences: ['We called at 10am. Someone picked up.', 'We called at 8pm. Someone picked up.'],
    detail: 'Both reached a person.',
  }
  const d = buildDossier({ ...full, calls: bothAnswered })
  assert.ok(!/we know it happened at least once/i.test(text(d)))
})

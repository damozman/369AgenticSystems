import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { RECOVERY_RATE, RECOVERY_RATE_NOTE } from './roi.ts'

/**
 * Guards the Phase 0 truthfulness pass against drift.
 *
 * These are copy assertions, not logic tests, and that is deliberate. The bugs they catch
 * are the ones this codebase actually shipped: three pages answering the same revenue
 * question three different ways, and marketing statistics that could not survive being
 * traced to a source. Both were introduced by ordinary edits, not by broken code, so a
 * build passing proves nothing about either.
 *
 * The static pages cannot import `lib/roi.ts` — they are hand-written HTML served straight
 * off the CDN, per the Zero-Touch Policy. A mirrored constant is the only option, so this
 * asserts the mirrors still agree with the source of truth.
 */

const ROOT = join(import.meta.dirname, '..')

// The 9 hand-written cold-email pages that carry a slider calculator.
const STATIC_CALCULATORS = [
  'public/roofing-leads/index.html',
  'public/hvac-leads/index.html',
  'public/plumbing-leads/index.html',
  'public/dental-leads/index.html',
  'public/legal-automation/index.html',
  'public/insurance-leads/index.html',
  'public/real-estate-leads/index.html',
  'public/saas-optimization/index.html',
  'public/wholesale-leads/index.html',
]

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

/** Every source file a prospect's eyes can reach, minus build output and this test. */
function sourceFiles(): string[] {
  const out: string[] = []
  const skip = new Set(['node_modules', '.next', '.git', 'out', 'dist', 'coverage'])
  const exts = ['.ts', '.tsx', '.html']

  ;(function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (exts.some(e => entry.endsWith(e)) && !entry.endsWith('.test.ts')) out.push(full)
    }
  })(join(ROOT, 'app'))

  for (const sub of ['components', 'lib', 'public']) {
    ;(function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        if (skip.has(entry)) continue
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (exts.some(e => entry.endsWith(e)) && !entry.endsWith('.test.ts')) out.push(full)
      }
    })(join(ROOT, sub))
  }
  return out
}

// ── The rate itself ───────────────────────────────────────────────────────────

test('RECOVERY_RATE is the conservative 30%, and says so on screen', () => {
  assert.equal(RECOVERY_RATE, 0.30)
  // The figure and the stated assumption must not drift apart — a number without its
  // assumption visible is exactly the overclaim this replaced.
  assert.match(RECOVERY_RATE_NOTE, /30%/)
})

// ── The mirrored copies in hand-written HTML ──────────────────────────────────

test('every static calculator mirrors RECOVERY_RATE at the same value', () => {
  for (const page of STATIC_CALCULATORS) {
    const html = read(page)
    const m = html.match(/const\s+RECOVERY_RATE\s*=\s*([\d.]+)/)
    assert.ok(m, `${page} declares no RECOVERY_RATE — its calculator would claim a 100% close rate`)
    assert.equal(
      Number(m![1]), RECOVERY_RATE,
      `${page} uses ${m![1]} but lib/roi.ts says ${RECOVERY_RATE}`,
    )
  }
})

test('every static calculator actually applies the rate to its figures', () => {
  for (const page of STATIC_CALCULATORS) {
    const html = read(page)
    // Declaring the constant but not multiplying by it is the silent-drift failure mode.
    assert.match(
      html, /\*\s*RECOVERY_RATE/,
      `${page} declares RECOVERY_RATE but never multiplies by it`,
    )
  }
})

test('every static calculator states its assumption on screen', () => {
  for (const page of STATIC_CALCULATORS) {
    assert.match(
      read(page), /Assumes 30%/,
      `${page} shows a derived figure without stating the assumption`,
    )
  }
})

// ── One source of truth ───────────────────────────────────────────────────────

test('no TypeScript file re-declares RECOVERY_RATE — it must be imported', () => {
  const offenders = sourceFiles()
    .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
    .filter(f => relative(ROOT, f).replace(/\\/g, '/') !== 'lib/roi.ts')
    .filter(f => /(?:const|let|var)\s+RECOVERY_RATE\s*=/.test(readFileSync(f, 'utf8')))
    .map(f => relative(ROOT, f))

  assert.deepEqual(
    offenders, [],
    `these re-declare RECOVERY_RATE instead of importing it from lib/roi.ts: ${offenders.join(', ')}`,
  )
})

// ── Claims the business cannot support ────────────────────────────────────────

/**
 * Each entry is a claim removed in the Phase 0 pass, paired with why it cannot come back.
 *
 * The borrowed statistics all trace to a single competitor's marketing blog whose figures
 * do not survive checking: invented report titles, two contradictory 85% claims, and its
 * one traceable number misattributed. It also contradicted this site's own homepage on the
 * cost of a missed call. Phase 2b replaces them with a statistic the business owns outright.
 */
const BANNED: Array<[claim: string, why: string]> = [
  ['80% of storm leads',        'borrowed statistic, unsourceable'],
  ['80% of homeowners',         'borrowed statistic, unsourceable'],
  ['78% of buyers',             'borrowed statistic, unsourceable'],
  ['78% of the time',           'borrowed statistic, unsourceable'],
  ['go cold in 5 minutes',      'borrowed statistic, unsourceable'],
  ['Studies show it takes',     'cites studies that were never identified'],
  ['industry data shows',       'cites data that was never identified'],
  ['average missed call costs', 'borrowed statistic, contradicted the site itself'],
  ['most clients see ROI',      'zero paying clients — no past results exist'],
  ['Most clients break even',   'zero paying clients — no past results exist'],
  ['indistinguishable from human', 'claims the voice fools people; unproven'],
  ['See exactly how much',      'promises exactness for a figure resting on an assumption'],
]

test('claims removed in the truthfulness pass have not come back', () => {
  const failures: string[] = []

  for (const file of sourceFiles()) {
    const text = readFileSync(file, 'utf8')
    for (const [claim, why] of BANNED) {
      if (text.includes(claim)) {
        failures.push(`${relative(ROOT, file)}: "${claim}" — ${why}`)
      }
    }
  }

  assert.deepEqual(failures, [], `banned claims found:\n  ${failures.join('\n  ')}`)
})

test('the response-time stat stays verifiable', () => {
  // "<60s" and "<90s" were unverifiable and weaker than the truth: Ava answers immediately.
  const offenders = sourceFiles()
    .filter(f => /&lt;60s|&lt;90s/.test(readFileSync(f, 'utf8')))
    .map(f => relative(ROOT, f))

  assert.deepEqual(
    offenders, [],
    `these still advertise an unverifiable response time instead of "1st ring": ${offenders.join(', ')}`,
  )
})

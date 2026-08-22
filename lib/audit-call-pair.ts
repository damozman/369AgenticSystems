/**
 * What TWO audit calls may claim — dossier section 2, the section that does the work.
 *
 * `describeAuditCall()` handles one call. This handles the pair, and it exists as its own module
 * because combining two observations is where the temptation to generalise lives.
 *
 * **The rule this module enforces: two calls are two events, never a rate.**
 *
 * It is very tempting to write "you miss 50% of calls" when one of two went to voicemail. That
 * number would be arithmetically true of the sample and completely false about the business, and
 * it is the precise shape of the invented statistic this whole pipeline replaces — a
 * `security_score` of 41 handed to nine different businesses. n=2 supports "this happened twice",
 * "this happened once", and nothing else. There is no percentage anywhere in this file, and there
 * must never be one.
 *
 * The honest move is to state both events and hand the frequency back to the only person who
 * knows it: *"we don't know how often that happens — you do."*
 *
 * **The dossier must be able to say they did well.** If both calls are answered, it says so
 * plainly. A document that only ever finds fault is a sales script and reads like one — and the
 * prospect who answered both times is exactly the one whose trust is worth most.
 */

import type { AuditCallResult } from '@/lib/audit-call'

export type PairVerdict =
  /** Both calls reached a person. Say so. */
  | 'both_answered'
  /** Someone answered in hours; the evening call did not reach a person. The comparison. */
  | 'business_only'
  /** The evening call reached a person but the business-hours one did not. Unusual, still true. */
  | 'evening_only'
  /** Neither call reached a person. */
  | 'neither_answered'
  /** Only one call established anything. Reported as one call, never as a pattern. */
  | 'single_call'
  /** Nothing reportable. The section is omitted entirely. */
  | 'nothing'

export interface AuditPair {
  verdict: PairVerdict
  /** Sentences to print, in order. Empty when the section must be omitted. */
  sentences: string[]
  /**
   * The line that hands frequency back to the prospect. Present only when something was in fact
   * missed — it would be nonsense after two answered calls.
   */
  closing?: string
  /** Operator-facing. Always present. */
  detail: string
}

/** A call reached a human. `ivr` deliberately does not count — a menu is not a person. */
function reachedPerson(r: AuditCallResult): boolean {
  return r.reportable && r.outcome === 'answered_human'
}

const HANDBACK =
  'We only called twice, so this is two moments rather than a pattern — how often it happens is ' +
  'something only you can say.'

/**
 * Combines the two calls into section 2.
 *
 * Either argument may be an unreportable result (our infrastructure failed, the number was
 * undialable, a carrier blocked it). Those are excluded rather than softened into "we could not
 * reach you", which would read as a finding about them.
 */
export function describeAuditPair(
  business: AuditCallResult | null,
  evening: AuditCallResult | null,
): AuditPair {
  const b = business?.reportable ? business : null
  const e = evening?.reportable ? evening : null

  if (!b && !e) {
    return {
      verdict: 'nothing',
      sentences: [],
      detail:
        'Neither call established anything — omit section 2 entirely. ' +
        `Business: ${business?.detail ?? 'not placed'}. Evening: ${evening?.detail ?? 'not placed'}.`,
    }
  }

  // Only one usable call. State it as one call and stop; two-call language would imply a
  // comparison that was never made.
  if (!b || !e) {
    const only = (b ?? e)!
    const which = b ? 'business-hours' : 'evening'
    return {
      verdict: 'single_call',
      sentences: [only.sentence],
      closing: reachedPerson(only) ? undefined : HANDBACK,
      detail:
        `Only the ${which} call was reportable, so this is stated as a single call. ` +
        `Other call: ${(b ? evening : business)?.detail ?? 'not placed'}.`,
    }
  }

  const bOk = reachedPerson(b)
  const eOk = reachedPerson(e)

  if (bOk && eOk) {
    return {
      verdict: 'both_answered',
      sentences: [
        b.sentence,
        e.sentence,
        'Both times, a person answered. There is nothing here for us to fix.',
      ],
      // No handback: nothing was missed, so there is no frequency to ask about. The honest
      // remaining argument is about the hours we did not call, and section 6 makes it.
      detail: 'Both calls reached a person. Section 2 says so, and claims no problem.',
    }
  }

  if (bOk && !eOk) {
    return {
      verdict: 'business_only',
      sentences: [
        b.sentence,
        e.sentence,
        'Same number, same day. The difference was the hour.',
      ],
      closing: HANDBACK,
      detail: 'Business hours reached a person; the evening call did not. The comparison stands.',
    }
  }

  if (!bOk && eOk) {
    return {
      verdict: 'evening_only',
      sentences: [
        b.sentence,
        e.sentence,
        'The evening call reached someone and the daytime one did not.',
      ],
      closing: HANDBACK,
      detail: 'Evening reached a person, business hours did not. Stated as observed.',
    }
  }

  return {
    verdict: 'neither_answered',
    sentences: [
      b.sentence,
      e.sentence,
      'Neither call reached a person.',
    ],
    closing: HANDBACK,
    detail: 'Neither call reached a person. Both events stated; no rate claimed.',
  }
}

/** Whether section 2 can be printed at all. */
export function pairIsReportable(pair: AuditPair): boolean {
  return pair.verdict !== 'nothing' && pair.sentences.length > 0
}

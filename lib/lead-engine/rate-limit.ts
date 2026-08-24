/**
 * The smallest real defence for a public, unauthenticated write route — a honeypot field plus a
 * site-scoped throttle. Neither needs new infrastructure:
 *
 * - The honeypot needs no storage at all — a hidden field a real visitor never sees or fills.
 * - The throttle counts or reads rows the tables already have: `lead_engine_submissions` is
 *   already indexed on `(site_id, created_at DESC)` for exactly this kind of query, and
 *   `lead_engine_sites.updated_at` already exists and moves on every write via the table's own
 *   trigger — no migration needed for either check.
 *
 * **Deliberately NOT per-IP.** Vercel functions are stateless across instances, so an in-memory
 * counter is unreliable from one request to the next, and storing a submitter's IP would be a
 * schema change nobody has asked for. Per-site-id is enough to stop the common case — a bot or a
 * broken retry loop hammering one exposed form — without inventing infrastructure this product
 * does not otherwise need.
 *
 * Pure decisions only; the routes own the one query each needs to feed them, the same split
 * `lib/lead-engine/limits.ts` already uses for `decidePhotoUpload` and `decideRevision`.
 */

export const SUBMIT_THROTTLE_MAX = 5
export const SUBMIT_THROTTLE_WINDOW_SECONDS = 60
export const QUESTIONNAIRE_THROTTLE_COOLDOWN_SECONDS = 5

export interface ThrottleDecision {
  allowed: boolean
  /** Present only when refused — how long until this would be allowed again. */
  retryAfterSeconds?: number
}

/**
 * A hidden field real visitors never see or fill. Any non-empty value means something filled in
 * every field it could find, which a human looking at the rendered form cannot do — the field is
 * visually hidden, not merely styled small.
 */
export function honeypotTripped(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** No more than `SUBMIT_THROTTLE_MAX` submissions to one site within `SUBMIT_THROTTLE_WINDOW_SECONDS`. */
export function decideSubmitThrottle(recentSubmissionCount: number): ThrottleDecision {
  if (recentSubmissionCount >= SUBMIT_THROTTLE_MAX) {
    return { allowed: false, retryAfterSeconds: SUBMIT_THROTTLE_WINDOW_SECONDS }
  }
  return { allowed: true }
}

/**
 * A minimum interval between questionnaire writes to the same site.
 *
 * This route is already token- or session-gated, so the threat here is narrower than the public
 * submit route's — a leaked or brute-forced link being used to hammer a write endpoint rather than
 * open scraping. A short cooldown is enough: nobody legitimately re-submits the same form several
 * times a second.
 */
export function decideQuestionnaireThrottle(
  lastUpdatedAt: Date | string | null,
  now: Date = new Date(),
): ThrottleDecision {
  if (!lastUpdatedAt) return { allowed: true }
  const last = new Date(lastUpdatedAt)
  if (Number.isNaN(last.getTime())) return { allowed: true }

  const elapsedSeconds = (now.getTime() - last.getTime()) / 1000
  if (elapsedSeconds < QUESTIONNAIRE_THROTTLE_COOLDOWN_SECONDS) {
    return { allowed: false, retryAfterSeconds: Math.ceil(QUESTIONNAIRE_THROTTLE_COOLDOWN_SECONDS - elapsedSeconds) }
  }
  return { allowed: true }
}

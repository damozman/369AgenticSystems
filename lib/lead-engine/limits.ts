/**
 * The hard limits that make Lead Engine a fixed-scope product.
 *
 * Every decision here is commercial, so it lives in one file rather than being scattered through
 * routes — the shape of `lib/billing.ts`, for the same reason: these are the numbers that decide
 * what a customer is owed, and they must be readable in one place before anyone changes them.
 *
 * Chris's figures, 2026-08-23: 12 photos at 5MB, 2 included revisions inside 30 days of launch,
 * further revisions billable, and a quarterly refresh of 3–5 photos inside the monthly fee.
 *
 * Nothing here does I/O, so the routes can be thin and these rules can be tested directly.
 */

export const MAX_PHOTOS_PER_SITE = 12
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/**
 * What the Storage bucket will actually serve as an image.
 *
 * HEIC is deliberately absent: it is what an iPhone produces by default and what a customer will
 * try to send, but browsers do not render it, so accepting the upload would put a broken image on
 * a live page. Refusing with a reason they can act on is the honest outcome until conversion is
 * built.
 */
export const ALLOWED_PHOTO_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg', 'image/png', 'image/webp',
])

export const INCLUDED_REVISIONS = 2
export const REVISION_WINDOW_DAYS = 30

/** The quarterly photo refresh included in the monthly fee. */
export const QUARTERLY_PHOTO_REFRESH = { min: 3, max: 5 } as const
const QUARTER_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export type PhotoDecision =
  | { allowed: true }
  | { allowed: false; reason: string }

/**
 * Whether one more photo may be uploaded.
 *
 * Checked server-side, because a limit enforced only in the browser is not a limit — the upload
 * route is reachable directly and the numbers above are what the customer is actually sold.
 */
export function decidePhotoUpload(input: {
  currentCount: number
  bytes: number
  contentType: string
}): PhotoDecision {
  const { currentCount, bytes, contentType } = input

  if (currentCount >= MAX_PHOTOS_PER_SITE) {
    return {
      allowed: false,
      reason: `This site already has its ${MAX_PHOTOS_PER_SITE} photos. Remove one to add another.`,
    }
  }
  if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
    return {
      allowed: false,
      // Names the formats that work rather than the one that did not, because "image/heic is not
      // supported" tells a roofer nothing about what to do next.
      reason: 'Please upload a JPEG, PNG or WebP. Photos straight from an iPhone are often HEIC — '
            + 'emailing them to yourself, or sharing them, usually converts them to JPEG.',
    }
  }
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { allowed: false, reason: 'That file appears to be empty.' }
  }
  if (bytes > MAX_PHOTO_BYTES) {
    const mb = (bytes / (1024 * 1024)).toFixed(1)
    return {
      allowed: false,
      reason: `That photo is ${mb}MB — the limit is ${MAX_PHOTO_BYTES / (1024 * 1024)}MB per photo.`,
    }
  }
  return { allowed: true }
}

export interface RevisionDecision {
  /** Whether this one is covered by the included allowance. */
  included: boolean
  /** What the customer should be told. Never a refusal — see below. */
  message: string
  /** How many included revisions remain after this one, floored at zero. */
  remaining: number
}

/**
 * Whether a change request is covered by the included allowance.
 *
 * **This never refuses.** A request outside the allowance is still recorded and still answered —
 * it is simply flagged billable, and the customer is told so before they are surprised by an
 * invoice. Refusing would lose the request and the conversation with it, and the request is often
 * how we learn the site is wrong.
 *
 * Requests raised BEFORE launch are not revisions. Getting the first version right is the build,
 * not a change to it, and charging for it would penalise exactly the customer who reads their site
 * carefully.
 */
export function decideRevision(input: {
  revisionsUsed: number
  launchedAt: Date | string | null
  now?: Date
}): RevisionDecision {
  const { revisionsUsed } = input
  const now = input.now ?? new Date()
  const launchedAt = input.launchedAt ? new Date(input.launchedAt) : null

  if (!launchedAt || Number.isNaN(launchedAt.getTime())) {
    return {
      included: true,
      message: 'Your site is still in build, so this is part of getting the first version right.',
      remaining: INCLUDED_REVISIONS,
    }
  }

  const daysSinceLaunch = (now.getTime() - launchedAt.getTime()) / DAY_MS
  const remaining = Math.max(0, INCLUDED_REVISIONS - revisionsUsed)

  if (daysSinceLaunch > REVISION_WINDOW_DAYS) {
    return {
      included: false,
      message: `Your ${REVISION_WINDOW_DAYS}-day included-revisions window has closed. We'll still `
             + `make this change — we'll confirm the cost with you first.`,
      remaining: 0,
    }
  }
  if (remaining <= 0) {
    return {
      included: false,
      message: `You've used both included revisions. We'll still make this change — we'll confirm `
             + `the cost with you first.`,
      remaining: 0,
    }
  }

  return {
    included: true,
    message: remaining === 1
      ? 'This uses your last included revision.'
      : `This uses one of your ${remaining} included revisions.`,
    remaining: remaining - 1,
  }
}

/**
 * Whether a site is due its quarterly photo refresh.
 *
 * Foundation only — the brief lists the automated quarterly email as a non-goal, so this is the
 * decision without the cron. Nothing schedules it yet, and nothing in `vercel.json` changes.
 */
export function photoRefreshDue(input: {
  launchedAt: Date | string | null
  lastRefreshAt?: Date | string | null
  now?: Date
}): boolean {
  const now = input.now ?? new Date()
  const since = input.lastRefreshAt ?? input.launchedAt
  if (!since) return false
  const at = new Date(since)
  if (Number.isNaN(at.getTime())) return false
  return (now.getTime() - at.getTime()) / DAY_MS >= QUARTER_DAYS
}

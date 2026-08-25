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
 * Raised 2026-08-24 per `docs/PHOTO-REQUIREMENTS.md` Part B, §1–3: 12 → 18 photos (hero + band +
 * a 6-row ladder + a 6-photo gallery is 14 distinct slots — at 12 the allocator was already
 * rationing) and 5MB → 20MB (5MB rejects ordinary full-resolution phone photos; compression
 * happens server-side after ingest, so stored output stays small regardless of what came in).
 *
 * Nothing here does I/O, so the routes can be thin and these rules can be tested directly.
 */

export const MAX_PHOTOS_PER_SITE = 18
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024

/** Long edge, in pixels, after EXIF rotation. Below this a photo cannot print clearly. */
export const MIN_PHOTO_LONG_EDGE = 1200
/** Below this it stores and renders, but is not fit for the hero or the full-bleed band. */
export const WARN_PHOTO_LONG_EDGE = 2000

/**
 * What an upload may arrive as. Not what the Storage bucket serves — see
 * `lib/lead-engine/photo-pipeline.ts`, which converts every accepted type to WebP + a JPEG
 * fallback before anything is stored.
 *
 * **HEIC/HEIF are accepted, not rejected.** It is what an iPhone produces by default and what a
 * customer will try to send regardless of what we ask for, and no browser renders it — so before
 * the pipeline existed, accepting the upload meant a broken image on a live page and rejecting it
 * meant asking a non-technical customer to convert a file format by hand. Converting on ingest
 * (`heic-convert`, chosen over `sharp` alone 2026-08-24: sharp's prebuilt binaries exclude
 * libheif over HEVC patent licensing, so it cannot decode HEIC in Vercel's serverless build) makes
 * both problems disappear at once.
 */
export const ALLOWED_PHOTO_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
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
 * A human name for a rejected file, for the "unsupported type" message. Never guesses at content
 * — an unrecognised MIME type with no usable extension just says "file", which is still more
 * useful than repeating the MIME string back at someone who did not choose it.
 */
function humanFileType(contentType: string, filename?: string): string {
  const KNOWN: Record<string, string> = {
    'image/gif': 'GIF', 'image/bmp': 'BMP', 'image/tiff': 'TIFF', 'image/svg+xml': 'SVG',
    'application/pdf': 'PDF',
  }
  if (KNOWN[contentType]) return KNOWN[contentType]
  const ext = filename?.split('.').pop()?.toUpperCase()
  return ext && ext.length <= 5 ? ext : 'file'
}

/**
 * Whether one more photo may be uploaded. The single-file gate: type and size only — resolution
 * cannot be checked until the file is decoded, so that lives in `decideResolution` below, run
 * after `lib/lead-engine/photo-pipeline.ts` has read the image.
 *
 * Checked server-side, because a limit enforced only in the browser is not a limit — the upload
 * route is reachable directly and the numbers above are what the customer is actually sold.
 */
export function decidePhotoUpload(input: {
  currentCount: number
  bytes: number
  contentType: string
  filename?: string
}): PhotoDecision {
  const { currentCount, bytes, contentType, filename } = input

  if (currentCount >= MAX_PHOTOS_PER_SITE) {
    return {
      allowed: false,
      reason: `This site already has its ${MAX_PHOTOS_PER_SITE} photos. Remove one to add another.`,
    }
  }
  if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
    return {
      allowed: false,
      // Names the formats that work rather than the one that did not — "image/gif is not
      // supported" tells a roofer nothing about what to do next.
      reason: `We can accept JPG, PNG, WebP, and iPhone photos. This file is a ${humanFileType(contentType, filename)}.`,
    }
  }
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { allowed: false, reason: 'That file appears to be empty.' }
  }
  if (bytes > MAX_PHOTO_BYTES) {
    const mb = Math.round(bytes / (1024 * 1024))
    const cap = MAX_PHOTO_BYTES / (1024 * 1024)
    return {
      allowed: false,
      reason: `This photo is ${mb}MB and the limit is ${cap}MB. Send it from your phone's photo `
            + `app rather than a file manager and it'll compress automatically.`,
    }
  }
  return { allowed: true }
}

/**
 * Whether a batch of files, added to what a site already has, fits under the cap.
 *
 * A separate check from `decidePhotoUpload` because it answers a different question — not "is
 * this one file OK" but "does the customer's whole selection fit" — and a dashboard offering
 * multi-file selection needs to say so before uploading any of them, not fail on file #19 having
 * already stored 18.
 */
export function decideBatchPhotoUpload(input: { currentCount: number; incomingCount: number }): PhotoDecision {
  const attempted = input.currentCount + input.incomingCount
  if (attempted <= MAX_PHOTOS_PER_SITE) return { allowed: true }
  return {
    allowed: false,
    reason: `That's ${attempted} photos and we can use ${MAX_PHOTOS_PER_SITE}. Pick your best `
          + `${MAX_PHOTOS_PER_SITE} — we'd rather have your strongest work than all of it.`,
  }
}

export type ResolutionDecision =
  | { status: 'ok' }
  | { status: 'warn'; message: string }
  | { status: 'reject'; message: string }

/**
 * Whether a decoded photo's resolution is usable. Run after conversion/rotation, on the pixel
 * dimensions that will actually be stored — never on the source file's claimed dimensions, which
 * EXIF orientation can have rotated 90 degrees.
 */
export function decideResolution(longEdgePx: number): ResolutionDecision {
  if (longEdgePx < MIN_PHOTO_LONG_EDGE) {
    return {
      status: 'reject',
      message: "This one's too small to print clearly on your page. If you shrank it to email it, "
              + 'send the original instead.',
    }
  }
  if (longEdgePx < WARN_PHOTO_LONG_EDGE) {
    return {
      status: 'warn',
      message: 'This photo is a bit small for the hero or the full-width band — it will still work '
              + 'for the gallery.',
    }
  }
  return { status: 'ok' }
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

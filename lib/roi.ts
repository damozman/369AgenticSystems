/**
 * Single source of truth for the ROI model shown to prospects.
 *
 * Answering a call is not the same as winning the job. Any calculator that
 * multiplies missed calls by the full job value is quietly claiming a 100%
 * close rate, which is why three different pages used to show three different
 * answers to the same question. Every estimate on the site — Next.js pages,
 * the static cold-email pages, and the weekly digest — runs on this rate.
 */
export const RECOVERY_RATE = 0.30

/** Shown on-screen next to any figure derived from RECOVERY_RATE. */
export const RECOVERY_RATE_NOTE =
  'Assumes 30% of missed calls convert once answered — a conservative rate, not every answered call becomes a job.'

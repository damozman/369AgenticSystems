/**
 * Parsing for the static intake forms' payload.
 *
 * This lives outside `/api/intake` so it can be tested directly. Everything here feeds the
 * operational dossier, whose one governing rule is that **the model may write the prose, the model
 * may never invent a number** — so the job of this module is to turn what a human typed into
 * either a real figure or `null`, and never into a plausible-looking guess.
 */

/** INTEGER column, and nobody fields a million calls a month. */
export const MAX_MONTHLY_VOLUME = 1_000_000

/** `avg_job_value` is NUMERIC(12,2). Well under the column's ceiling, above any real average. */
export const MAX_AVG_JOB_VALUE = 10_000_000

/**
 * Reads a number a human typed into a free-text box.
 *
 * The volume and value fields are `type="text"` with `inputmode="numeric"`, not `type="number"`,
 * because a spinner is poor on a phone and because people genuinely write "~60/mo" and "$8,200".
 * So strip the money and the punctuation and take the first number.
 *
 * **Out of range returns null rather than a clamped value.** A clamp invents a figure the prospect
 * did not give. Null means "not usable", and a dossier section with no number must be omitted
 * rather than estimated — the Gumloop dossier this replaces returned a security score of 41 for
 * every business it ever saw, and that is the failure mode being designed out.
 *
 * The bounds are also what stop a long paste from overflowing the column and failing the insert,
 * which would cost the whole lead rather than one field.
 */
export function numberFrom(raw: unknown, max: number): number | null {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : ''
  const m = text.replace(/[$,\s]/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  if (!Number.isFinite(n) || n < 0 || n > max) return null
  return n
}

/** `monthly_volume` is an INTEGER column and someone will type "60.5 a month". */
export function monthlyVolumeFrom(raw: unknown): number | null {
  const n = numberFrom(raw, MAX_MONTHLY_VOLUME)
  return n === null ? null : Math.round(n)
}

/** `avg_job_value` is NUMERIC(12,2). Rounding what they gave is not inventing what they did not. */
export function avgJobValueFrom(raw: unknown): number | null {
  const n = numberFrom(raw, MAX_AVG_JOB_VALUE)
  return n === null ? null : Math.round(n * 100) / 100
}

/**
 * The bottlenecks the prospect checked, in the order the form lists them.
 *
 * Tolerates the old single-value `pain` string as well as the new `pain_points` array, because a
 * browser holding a cached copy of a page keeps posting the old shape long after a deploy, and a
 * lead is worth more than a tidy contract.
 *
 * Order is preserved and duplicates are dropped: the dossier addresses each checked point in form
 * order, so this is a sequence rather than a set.
 */
export function painPointsFrom(body: Record<string, unknown>): string[] {
  const raw = Array.isArray(body.pain_points) ? body.pain_points : [body.pain]
  const seen = new Set<string>()
  for (const v of raw) {
    if (typeof v !== 'string') continue
    const s = v.trim().slice(0, 60)
    if (s) seen.add(s)
  }
  return [...seen].slice(0, 12)
}

import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison. Avoids leaking, via response timing, how many
 * leading characters of a secret/signature matched. Use for any comparison of a
 * caller-supplied token against a server secret.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  // Length difference is not itself secret; bail before timingSafeEqual (which
  // throws on unequal lengths).
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Enforce-only-when-configured shared-secret gate for server-to-server and
 * webhook routes.
 *
 * Returns 'allow' when no secret is configured, so shipping this code changes
 * NOTHING until the operator sets the env var (non-breaking rollout). Once the
 * secret is set, the caller must present an exact, timing-safe match or the
 * request is denied.
 */
export function secretGate(
  expected: string | undefined | null,
  provided: string | undefined | null,
): 'allow' | 'deny' {
  if (!expected) return 'allow' // dormant until configured
  if (!provided) return 'deny'
  return timingSafeEqualStr(expected, provided) ? 'allow' : 'deny'
}

/**
 * The Lead Engine questionnaire link — split out from `questionnaire-auth.ts` on purpose.
 *
 * This file has exactly one dependency, `lib/security/onboarding-token.ts`, which is itself
 * Next.js-free — no `next/server`, no cookies, nothing that only resolves inside Next's own
 * bundler. That makes this file safe to `import()` from a bare Node script (e.g.
 * `scripts/verify-lead-engine.mjs`, which needs to mint a real link for its own throwaway site).
 *
 * `questionnaire-auth.ts` cannot make that promise — `questionnaireAuthFailure` builds a
 * `NextResponse`, so importing anything from that file at all pulls in `next/server`, which fails
 * with `ERR_MODULE_NOT_FOUND` outside a Next.js runtime. Keeping the pure link-builder here is the
 * same split the voice product already draws between `lib/security/onboarding-token.ts` (script-safe)
 * and `lib/security/questionnaire-auth.ts` (route-only) — this file just didn't follow it at first,
 * and a script hitting that import boundary head-on is what caught it.
 */

import { mintOnboardingToken } from '@/lib/security/onboarding-token'

/** The questionnaire link, with proof attached when we are able to attach it. */
export function questionnaireUrl(siteId: string, origin = 'https://369agenticsystems.com'): string {
  const base = `${origin}/lead-engine/questionnaire/${siteId}`
  const token = mintOnboardingToken(siteId)
  return token ? `${base}?t=${encodeURIComponent(token)}` : base
}

/**
 * Who is allowed to see or change a Lead Engine site's questionnaire answers.
 *
 * Mirrors `lib/security/questionnaire-auth.ts` — same two-ways-in shape (a signed link the
 * customer never had a session for, or an authenticated owner editing later) — and reuses that
 * module's token primitives directly rather than standing up a fourth signing scheme. The subject
 * bound into the token is the site's UUID rather than a `client_domain`; `verifyOnboardingToken`
 * takes any string as the thing being authorised, so this is a real reuse, not a coincidence of
 * matching signatures. `ONBOARDING_TOKEN_SECRET` now protects two products.
 *
 * **This ENFORCES immediately — no reporting-only phase.** The voice product's version shipped
 * reporting-only because arming a shared-secret gate had already broken two live producers who
 * never got the new secret (the funnel outage, the ten-day call outage). Neither risk exists here:
 * this route has never shipped before, so there is no existing producer to break by turning the
 * gate on from the first commit.
 *
 * **This file imports `next/server` (via `NextResponse`) and is NOT importable from a bare Node
 * script** — that fails with `ERR_MODULE_NOT_FOUND: next/server` outside Next's own bundler. The
 * link-minting half that a verify script actually needs, `questionnaireUrl()`, lives in
 * `lib/lead-engine/questionnaire-url.ts` for exactly that reason — found by a script hitting this
 * boundary directly, not derived in advance.
 */

import { NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'
import { verifyOnboardingToken } from '@/lib/security/onboarding-token'

export type SiteQuestionnaireAuth = 'signed-link' | 'owner-session' | null

export async function authorizeSiteQuestionnaire(
  siteId: string,
  ownerEmail: string | null | undefined,
  token: string | null | undefined,
): Promise<SiteQuestionnaireAuth> {
  if (verifyOnboardingToken(token, siteId).valid) return 'signed-link'

  try {
    const userClient = await createUserClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user?.email) return null
    const owner = String(ownerEmail ?? '').toLowerCase()
    if (owner && user.email.toLowerCase() === owner) return 'owner-session'
    if (isAdminEmail(user.email)) return 'owner-session'
  } catch (e) {
    // No session cookie at all is the normal case on the emailed-link path, not an error.
    console.warn('[LEAD-ENGINE] questionnaire session lookup failed:', e instanceof Error ? e.message : e)
  }

  return null
}

/** The shared refusal. Always enforced — see this file's own note on why there is no soft period. */
export function questionnaireAuthFailure(
  authorizedBy: SiteQuestionnaireAuth,
  siteId: string,
  opts: { readOnly?: boolean } = {},
): NextResponse | null {
  if (authorizedBy) return null

  console.error(`[LEAD-ENGINE] REFUSED unauthorised questionnaire ${opts.readOnly ? 'read' : 'write'} for ${siteId}`)
  return NextResponse.json(
    {
      error: opts.readOnly
        ? 'This link is no longer valid, so your saved answers could not be loaded. Ask us for a fresh one, or sign in first.'
        : 'This link is no longer valid. Ask us for a fresh one, or sign in first.',
    },
    { status: 403 },
  )
}

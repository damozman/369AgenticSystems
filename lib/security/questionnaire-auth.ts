import { NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase-server'
import { onboardingAuthEnforced, verifyOnboardingToken } from '@/lib/security/onboarding-token'

/**
 * Who is allowed to see or change a client's onboarding answers.
 *
 * Extracted from `/api/questionnaire/submit` on 2026-08-21 when a READ endpoint was added. The
 * read returns the same rows the write accepts — hours, rental stock, business answers — so it
 * needs exactly the same gate. Two copies of an auth check is how one of them ends up weaker than
 * the other without anyone noticing, and this particular gate has already been missing once: until
 * 2026-08-19 anyone who knew a `client_domain` could rewrite that client's live agent prompt.
 *
 * Two ways in, because neither covers the whole life of a client:
 *   - a **signed link**, which the welcome email carries. The questionnaire is opened seconds
 *     after payment, when there is no session to check.
 *   - an **authenticated owner**, which is how a client edits hours or stock months later, long
 *     after that email is buried.
 */
export type QuestionnaireAuth = 'signed-link' | 'owner-session' | null

export async function authorizeQuestionnaire(
  clientDomain: string,
  ownerEmail: string | null | undefined,
  token: string | null | undefined,
): Promise<QuestionnaireAuth> {
  if (verifyOnboardingToken(token, clientDomain).valid) return 'signed-link'

  try {
    const userClient = await createUserClient()
    const { data: { user } } = await userClient.auth.getUser()
    const owner = String(ownerEmail ?? '').toLowerCase()
    if (user?.email && owner && user.email.toLowerCase() === owner) return 'owner-session'
  } catch (e) {
    // No session cookie at all is the normal case on the emailed-link path, not an error.
    console.warn('[QUESTIONNAIRE] session lookup failed:', e instanceof Error ? e.message : e)
  }

  return null
}

/**
 * The shared refusal, so the reporting-only period behaves identically on both routes.
 *
 * Returns a response to send, or `null` to continue. Reporting-only until
 * `ONBOARDING_AUTH_ENFORCED` is `'true'` — arming a gate blind has twice broken producers that
 * never got the new secret, so this logs first and refuses later.
 *
 * `readOnly` softens nothing about who is allowed in; it only changes the wording, because
 * "this link is no longer valid" is the wrong sentence to show someone whose form failed to load.
 */
export function questionnaireAuthFailure(
  authorizedBy: QuestionnaireAuth,
  clientDomain: string,
  token: string | null | undefined,
  opts: { readOnly?: boolean } = {},
): NextResponse | null {
  if (authorizedBy) {
    console.log(`[QUESTIONNAIRE] authorised via ${authorizedBy} for ${clientDomain}`)
    return null
  }

  const tokenState = verifyOnboardingToken(token, clientDomain).valid ? 'ok' : (token ? 'invalid' : 'absent')
  const detail = `${clientDomain} (token: ${tokenState})`
  const verb = opts.readOnly ? 'read' : 'submit'

  if (onboardingAuthEnforced()) {
    console.error(`[QUESTIONNAIRE] REFUSED unauthorised ${verb} for ${detail}`)
    return NextResponse.json(
      {
        error: opts.readOnly
          ? 'This link is no longer valid, so your saved answers could not be loaded. Ask us for a fresh one, or sign in first.'
          : 'This link is no longer valid. Ask us for a fresh one, or sign in first.',
      },
      { status: 403 },
    )
  }

  console.warn(`[QUESTIONNAIRE] ⚠ WOULD REFUSE unauthorised ${verb} for ${detail} — set ONBOARDING_AUTH_ENFORCED=true to enforce`)
  return null
}

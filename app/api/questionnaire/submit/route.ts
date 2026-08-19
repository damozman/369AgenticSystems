import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncQuestionnaireToKB } from '@/lib/retell-kb-sync'
import { createClient as createUserClient } from '@/lib/supabase-server'
import { onboardingAuthEnforced, verifyOnboardingToken } from '@/lib/security/onboarding-token'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // `schedule` is pulled out deliberately: formData is spread straight into
    // client_questionnaires, and these columns live on client_schedules instead. Leaving it in
    // the spread would fail the whole upsert on an unknown column.
    const { client_domain, schedule, onboarding_token, ...formData } = body

    if (!client_domain) {
      return NextResponse.json({ error: 'client_domain is required' }, { status: 400 })
    }

    // Verify the client domain exists and the user owns it
    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('id, user_email')
      .eq('client_domain', client_domain)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Client domain not found' }, { status: 404 })
    }

    /**
     * Prove the caller is allowed to write to THIS client.
     *
     * Until 2026-08-19 there was nothing here but the existence check above, despite the
     * comment claiming otherwise. Anyone who knew a client_domain could rewrite that client's
     * questionnaire, their working hours, their rental stock, and — through
     * syncQuestionnaireToKB below — the general_prompt of their LIVE Retell agent.
     *
     * Two ways in, because neither covers the whole life of a client:
     *   - a signed link, which is what the welcome email carries. The questionnaire is clicked
     *     seconds after payment, when there is no session to check; demanding an OTP round-trip
     *     at that moment is the wrong trade.
     *   - an authenticated owner, which is how a client edits their hours or stock months later,
     *     long after that email is buried.
     */
    const token = onboarding_token ?? new URL(request.url).searchParams.get('t')
    let authorizedBy: 'signed-link' | 'owner-session' | null =
      verifyOnboardingToken(token, client_domain).valid ? 'signed-link' : null

    if (!authorizedBy) {
      try {
        const userClient = await createUserClient()
        const { data: { user } } = await userClient.auth.getUser()
        const owner = String(subscription.user_email ?? '').toLowerCase()
        if (user?.email && owner && user.email.toLowerCase() === owner) authorizedBy = 'owner-session'
      } catch (e) {
        // No session cookie at all is the normal case for the emailed-link path, not an error.
        console.warn('[QUESTIONNAIRE] session lookup failed:', e instanceof Error ? e.message : e)
      }
    }

    if (!authorizedBy) {
      // Reporting-only until ONBOARDING_AUTH_ENFORCED is 'true'. Arming a gate blind has twice
      // broken producers that never got the new secret — the funnel outage and the ten-day call
      // outage — so this logs first, both link producers get verified against real links, and
      // only then does it start refusing.
      const detail = `${client_domain} (token: ${verifyOnboardingToken(token, client_domain).valid ? 'ok' : (token ? 'invalid' : 'absent')})`
      if (onboardingAuthEnforced()) {
        console.error(`[QUESTIONNAIRE] REFUSED unauthorised submit for ${detail}`)
        return NextResponse.json(
          { error: 'This link is no longer valid. Ask us for a fresh one, or sign in first.' },
          { status: 403 },
        )
      }
      console.warn(`[QUESTIONNAIRE] ⚠ WOULD REFUSE unauthorised submit for ${detail} — set ONBOARDING_AUTH_ENFORCED=true to enforce`)
    } else {
      console.log(`[QUESTIONNAIRE] authorised via ${authorizedBy} for ${client_domain}`)
    }

    // Upsert questionnaire
    const { error: questError } = await supabase
      .from('client_questionnaires')
      .upsert({
        client_domain,
        ...formData,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'client_domain' })

    if (questError) {
      console.error('[QUESTIONNAIRE] Save failed:', questError.message)
      return NextResponse.json({ error: questError.message }, { status: 500 })
    }

    console.log(`[QUESTIONNAIRE] ✓ Saved for ${client_domain}`)

    // Working hours drive the times Ava offers a caller. Non-fatal on purpose: the questionnaire
    // itself is already saved, and a client with no schedule row falls back to default weekday
    // hours rather than losing the ability to book at all. Logged loudly because silently
    // serving defaults to someone who just typed their real hours is the kind of quiet
    // wrongness that hides for weeks.
    if (schedule) {
      const { error: schedError } = await supabase
        .from('client_schedules')
        .upsert({
          client_domain,
          timezone:                schedule.timezone,
          business_hours:          schedule.business_hours,
          slot_duration_minutes:   schedule.slot_duration_minutes,
          max_concurrent_per_slot: schedule.max_concurrent_per_slot,
          updated_at:              new Date().toISOString(),
        }, { onConflict: 'client_domain' })

      if (schedError) {
        console.error(`[QUESTIONNAIRE] ✗ Schedule save failed for ${client_domain}:`, schedError.message)
      } else {
        console.log(`[QUESTIONNAIRE] ✓ Schedule saved for ${client_domain}`)
      }
    }

    // Awaited, not fire-and-forget: on Vercel's serverless runtime a function
    // can freeze as soon as it returns a response, so an un-awaited call risks
    // never actually completing. Confirmed via a real signup — the questionnaire
    // saved correctly but the prompt merge silently never ran until awaited.
    // Non-fatal: the questionnaire itself is already saved above; if this fails,
    // the sync-questionnaire-kb cron will retry it (kb_uploaded_at stays null).
    try {
      await syncQuestionnaireToKB(client_domain)
    } catch (e) {
      console.error(`[QUESTIONNAIRE] KB sync failed:`, e)
    }

    return NextResponse.json({ success: true, message: 'Questionnaire saved' })
  } catch (e) {
    console.error('[QUESTIONNAIRE] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

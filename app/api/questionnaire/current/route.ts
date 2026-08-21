import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authorizeQuestionnaire, questionnaireAuthFailure } from '@/lib/security/questionnaire-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * What this client has already told us.
 *
 * **The questionnaire had no read path at all until 2026-08-21**, which made every re-submit
 * destructive rather than corrective. The form is built entirely from hardcoded `useState`
 * defaults — Mon–Fri, 08:00–17:00, a 60-day horizon, rental stock switched off, one blank item
 * row — so a client who opened it months later to change one answer silently overwrote everything
 * else with those defaults.
 *
 * That is not theoretical for the pilot. She is an event-rental business: weekend hours and a
 * ~180-day horizon. On any re-submit her Saturdays revert to closed and her horizon to 60 days,
 * and **Ava then refuses every weekend booking** — which reads as a bug in the booking engine
 * rather than as configuration. Her ~40 spreadsheet-loaded inventory rows are the same story: the
 * submit path deactivates every item not in the posted list, and the form could not post items it
 * had never been told about.
 *
 * So this endpoint exists to make the form round-trip. Same auth as the write, from the same
 * module, because it returns exactly the rows the write accepts.
 *
 * Returns `null` sections rather than defaults when a client genuinely has nothing saved yet —
 * a first-time visitor must still get the form's own defaults, and "not yet answered" and
 * "answered with the default" have to stay distinguishable here or the caller cannot tell them
 * apart either.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const clientDomain = url.searchParams.get('client_domain')
    const token = url.searchParams.get('t')

    if (!clientDomain) {
      return NextResponse.json({ error: 'client_domain is required' }, { status: 400 })
    }

    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('id, user_email, business_name')
      .eq('client_domain', clientDomain)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Client domain not found' }, { status: 404 })
    }

    const authorizedBy = await authorizeQuestionnaire(clientDomain, subscription.user_email, token)
    const refusal = questionnaireAuthFailure(authorizedBy, clientDomain, token, { readOnly: true })
    if (refusal) return refusal

    const [questionnaire, schedule, inventory] = await Promise.all([
      supabase.from('client_questionnaires').select('*').eq('client_domain', clientDomain).maybeSingle(),
      supabase.from('client_schedules').select('*').eq('client_domain', clientDomain).maybeSingle(),
      // Active rows only. An item taken out of service should not reappear in the form and get
      // silently reactivated by the next submit.
      supabase
        .from('client_inventory')
        .select('item_key, label, quantity')
        .eq('client_domain', clientDomain)
        .eq('active', true)
        .order('label'),
    ])

    // Strip bookkeeping columns the form neither shows nor sends back, so a round-trip cannot
    // resurrect a stale completed_at or overwrite an id.
    const { id: _id, client_domain: _cd, completed_at, created_at: _ca, updated_at: _ua, ...answers } =
      (questionnaire.data ?? {}) as Record<string, unknown>

    return NextResponse.json({
      exists: Boolean(questionnaire.data),
      businessName: subscription.business_name ?? null,
      completedAt: completed_at ?? null,
      answers: questionnaire.data ? answers : null,
      schedule: schedule.data ?? null,
      inventory: (inventory.data ?? []).map(r => ({
        label: r.label,
        quantity: r.quantity,
        item_key: r.item_key,
      })),
    })
  } catch (error) {
    console.error('[QUESTIONNAIRE] current failed:', error)
    return NextResponse.json({ error: 'Failed to load saved answers' }, { status: 500 })
  }
}

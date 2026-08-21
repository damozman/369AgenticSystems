// ⚠️ DELIBERATELY NOT SCHEDULED. Do not add this path to vercel.json without
// first replacing JOB_VALUE below.
//
// This route is absent from vercel.json's `crons` array, so it never fires. That
// is not an oversight — it is the fix. The JOB_VALUE table is a set of invented
// per-vertical industry averages, exactly the class of number stripped off every
// public page on 2026-08-20 because we cannot prove any of them. Nothing measures
// these; they were typed in. Schedule this as-is and it emails a named client a
// dollar figure derived from a made-up average, once a month, in writing — the
// same mistake as the Gumloop dossier's `security_score: 41`, which returned the
// identical score for all 19 rows because the prompt said "estimate".
//
// Three things must be true before this is turned on:
//   1. JOB_VALUE is replaced by the client's OWN average job value, read from
//      their record — the intake form does not collect it yet (see
//      docs/DOSSIER-DESIGN.md, build step 0).
//   2. Every figure in the email states its assumption on screen, as the on-page
//      calculators do with RECOVERY_RATE (lib/roi.ts).
//   3. The rental verticals exist here at all. There are nine keys; event-rentals,
//      dumpster-rental and equipment-rental are not among them.
//
// The governing rule, from the dossier design: the model may write the prose, the
// model may never invent a number.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMonthlyROIReport } from '@/lib/email-sequences'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Monthly pricing config
const MONTHLY_COST: Record<string, number> = {
  Starter: 400,
  Pro: 600,
  Elite: 750,
}

// ⚠️ INVENTED NUMBERS — see the banner at the top of this file. Nothing measured
// these. They must be replaced with each client's own figure before this route is
// ever scheduled.
const JOB_VALUE: Record<string, number> = {
  roofing: 2500,
  hvac: 350,
  plumbing: 400,
  legal: 5000,
  'real-estate': 9000,
  insurance: 1200,
  saas: 2400,
  wholesale: 2500,
  dental: 200,
}

export async function GET(request: NextRequest) {
  // Basic auth: Vercel cron sends Authorization header
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET || ''

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[CRON] Starting monthly ROI reports...')

    // Get all active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('id, client_domain, user_email, tier, vertical, activated_at')
      .not('user_email', 'is', null)

    if (subError) {
      console.error('[CRON] Failed to fetch subscriptions:', subError.message)
      return NextResponse.json({ error: subError.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No active subscriptions' })
    }

    console.log(`[CRON] Found ${subscriptions.length} subscriptions`)

    let sent = 0
    let failed = 0

    // For each subscription, calculate ROI and send email
    for (const sub of subscriptions) {
      try {
        // Get last 30 days of call data
        const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

        const [
          { count: totalCalls },
          { count: bookedCalls },
          { count: capturedLeads },
          { data: clientInfo },
        ] = await Promise.all([
          supabase
            .from('calls')
            .select('*', { count: 'exact', head: true })
            .eq('client_domain', sub.client_domain),
          supabase
            .from('calls')
            .select('*', { count: 'exact', head: true })
            .eq('client_domain', sub.client_domain)
            .eq('call_outcome', 'booked')
            .gte('created_at', since30d),
          supabase
            .from('calls')
            .select('*', { count: 'exact', head: true })
            .eq('client_domain', sub.client_domain)
            .eq('call_outcome', 'captured_lead')
            .gte('created_at', since30d),
          supabase
            .from('clients')
            .select('company_name')
            .eq('email', sub.user_email)
            .maybeSingle(),
        ])

        const businessName = clientInfo?.company_name || sub.client_domain
        const monthlyFee = MONTHLY_COST[sub.tier as string] ?? 400
        const jobValue = JOB_VALUE[sub.vertical as string] ?? 2000

        await sendMonthlyROIReport({
          toEmail: sub.user_email,
          businessName,
          tier: sub.tier,
          vertical: sub.vertical,
          callsThisMonth: totalCalls ?? 0,
          appointmentsBooked: bookedCalls ?? 0,
          leadsCaptured: capturedLeads ?? 0,
          jobValue,
          monthlyFee,
        })

        console.log(`[CRON] ✓ ROI report sent to ${sub.user_email} (${businessName})`)
        sent++
      } catch (e) {
        console.error(`[CRON] Failed to send report for ${sub.client_domain}:`, e)
        failed++
      }
    }

    console.log(`[CRON] ✓ Sent ${sent}, failed ${failed}`)
    return NextResponse.json({ sent, failed, total: subscriptions.length })
  } catch (e) {
    console.error('[CRON] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

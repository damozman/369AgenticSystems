import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendClientLeadAlert } from '@/lib/email-sequences'
import { denyIfBadSecret, RETELL_SECRET_HEADER } from '@/lib/security/route-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_VERTICALS = [
  'roofing', 'hvac', 'plumbing', 'legal', 'real-estate',
  'insurance', 'saas', 'wholesale', 'dental',
]

const DEMO_DOMAIN = 'demo.369agenticsystems.com'

// The shared demo line (used on marketing pages) isn't a provisioned customer,
// so it has no row in agent_subscriptions — route it to the demo domain
// explicitly rather than letting it fall through as an "unknown agent."
async function resolveClientDomain(agentId: string | undefined): Promise<string | null> {
  if (!agentId) return null
  if (agentId === process.env.RETELL_AGENT_ID) return DEMO_DOMAIN

  const { data, error } = await supabase
    .from('agent_subscriptions')
    .select('client_domain')
    .eq('retell_agent_id', agentId)
    .maybeSingle()

  if (error) {
    console.error('[RETELL] ✗  client_domain lookup failed:', error.message)
    return null
  }

  return data?.client_domain ?? null
}

export async function POST(request: NextRequest) {
  // Retell webhook. Guarded by a shared secret sent by Retell as a custom header —
  // dormant until RETELL_WEBHOOK_SECRET is set (and configured on the Retell side),
  // then required. Without it, anyone could POST fake calls/leads for any tenant.
  const denied = denyIfBadSecret(request, process.env.RETELL_WEBHOOK_SECRET, RETELL_SECRET_HEADER)
  if (denied) return denied

  const receivedAt = new Date().toISOString()

  let webhook: Record<string, unknown>
  try {
    webhook = await request.json()
  } catch {
    console.error('[RETELL] ✗  Failed to parse JSON')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = webhook.event as string | undefined

  // Retell sends webhook.call (current API) or webhook.data (legacy)
  const call = (webhook.call ?? webhook.data) as Record<string, unknown> | undefined

  console.log(`[RETELL] ▶  event=${event ?? 'unknown'} keys=${Object.keys(webhook).join(',')}`)

  if (!event) {
    return NextResponse.json({ error: 'Missing event' }, { status: 400 })
  }

  if (!call) {
    console.error('[RETELL] ✗  No call/data field. Payload:', JSON.stringify(webhook))
    return NextResponse.json({ error: 'Missing call payload' }, { status: 400 })
  }

  const callId     = call.call_id     as string | undefined
  const fromNumber = call.from_number as string | undefined
  const agentId    = call.agent_id    as string | undefined

  if (!callId) {
    console.error('[RETELL] ✗  Missing call_id. call:', JSON.stringify(call))
    return NextResponse.json({ error: 'Missing call_id' }, { status: 400 })
  }

  // ── call_started ──────────────────────────────────────────────────────────
  if (event === 'call_started') {
    const clientDomain = await resolveClientDomain(agentId)
    if (!clientDomain) {
      console.error(`[RETELL] ✗  Unknown agent_id, cannot attribute call: ${agentId}`)
      return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
    }

    const { error } = await supabase.from('calls').insert({
      call_id:      callId,
      client_domain: clientDomain,
      caller_phone: fromNumber ?? 'unknown',
      call_outcome: 'in_progress',
      created_at:   receivedAt,
    })

    if (error) {
      console.error('[RETELL] ✗  Insert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[RETELL] ✓  call_started — ${callId} from ${fromNumber} → ${clientDomain}`)
    return NextResponse.json({ success: true, event })
  }

  // ── call_ended ────────────────────────────────────────────────────────────
  if (event === 'call_ended') {
    const clientDomain = await resolveClientDomain(agentId)
    if (!clientDomain) {
      console.error(`[RETELL] ✗  Unknown agent_id, cannot attribute call: ${agentId}`)
      return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
    }

    const startTs = call.start_timestamp as number | undefined
    const endTs   = call.end_timestamp   as number | undefined
    const durationSeconds = startTs && endTs
      ? Math.floor((endTs - startTs) / 1000)
      : null

    // book-appointment stamps call_outcome = 'booked' in real time, mid-call,
    // the moment a real booking row is created — that's ground truth, more
    // reliable than guessing from Retell's summary text. Don't let this
    // event's keyword-matching downgrade a real booking back to a guess.
    // Confirmed on a real call: a real appointment was booked and correctly
    // stamped, then this upsert clobbered it back to 'captured_lead' because
    // the summary didn't happen to contain the word "booked".
    const { data: existingCall } = await supabase
      .from('calls')
      .select('call_outcome')
      .eq('call_id', callId)
      .maybeSingle()

    let outcome: string
    if (existingCall?.call_outcome === 'booked') {
      outcome = 'booked'
    } else {
      const summary = ((call.call_summary as string) ?? '').toLowerCase()
      outcome = 'captured_lead'
      if      (summary.includes('booked') || summary.includes('appointment')) outcome = 'booked'
      else if (summary.includes('spam')   || summary.includes('hang'))        outcome = 'spam'
      else if (summary.includes('no answer') || summary.includes('voicemail')) outcome = 'no_answer'
    }

    // Upsert — handles the case where call_started webhook was missed
    const { data: endedCall, error } = await supabase
      .from('calls')
      .upsert({
        call_id:          callId,
        client_domain:    clientDomain,
        caller_phone:     fromNumber ?? 'unknown',
        duration_seconds: durationSeconds,
        transcript:       (call.transcript as string) ?? null,
        recording_url:    (call.recording_url as string) ?? null,
        call_outcome:     outcome,
        captured_at:      new Date().toISOString(),
      }, { onConflict: 'call_id' })
      .select('id')
      .single()

    if (error) {
      console.error('[RETELL] ✗  Upsert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[RETELL] ✓  call_ended — ${callId} → ${outcome} (${durationSeconds}s) → ${clientDomain}`)

    // Alert the client about a captured lead that DIDN'T end in a booking — a booking
    // already gets its own, more specific alert from book-appointment.ts. Same reasoning
    // as the booking alert: the dashboard's running totals don't signal "this one is new."
    if (outcome === 'captured_lead' && clientDomain !== DEMO_DOMAIN) {
      const { data: leadRow } = await supabase
        .from('leads')
        .select('caller_name, caller_phone, caller_email, caller_address, issue_description, urgency')
        .eq('call_id', endedCall.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (leadRow) {
        const { data: ownerSub } = await supabase
          .from('agent_subscriptions')
          .select('user_email')
          .eq('client_domain', clientDomain)
          .maybeSingle()

        if (ownerSub?.user_email) {
          try {
            await sendClientLeadAlert({
              toEmail:           ownerSub.user_email,
              callerName:        leadRow.caller_name ?? undefined,
              callerPhone:       leadRow.caller_phone ?? fromNumber ?? 'unknown',
              callerEmail:       leadRow.caller_email ?? undefined,
              callerAddress:     leadRow.caller_address ?? undefined,
              issueDescription:  leadRow.issue_description ?? undefined,
              urgency:           leadRow.urgency ?? undefined,
            })
            console.log(`[RETELL] ✓  Lead alert sent → ${ownerSub.user_email}`)
          } catch (e) {
            console.error('[RETELL] Lead alert failed:', e)
          }
        }
      }
    }

    return NextResponse.json({ success: true, event, outcome })
  }

  // ── call_analyzed ─────────────────────────────────────────────────────────
  if (event === 'call_analyzed') {
    const analysis = call.call_analysis as Record<string, unknown> | undefined
    const custom   = analysis?.custom_analysis_data as Record<string, unknown> | undefined

    const callerEmail     = (custom?.caller_email      as string | undefined) ?? null
    const issueDescription = (custom?.issue_description as string | undefined) ?? null
    const urgency          = (custom?.urgency           as string | undefined) ?? null
    const rawVertical       = (custom?.vertical          as string | undefined) ?? null
    const vertical          = rawVertical && VALID_VERTICALS.includes(rawVertical) ? rawVertical : null

    const updatePayload: Record<string, unknown> = {
      caller_name:       (custom?.caller_name       as string  | undefined) ?? null,
      caller_address:    (custom?.caller_address     as string  | undefined) ?? null,
      issue_description: issueDescription,
      urgency:           urgency,
      call_successful:   (analysis?.call_successful as boolean | undefined) ?? null,
      sentiment:         (analysis?.user_sentiment  as string  | undefined) ?? null,
    }

    const { data: updatedCall, error } = await supabase
      .from('calls')
      .update(updatePayload)
      .eq('call_id', callId)
      .select('id')
      .maybeSingle()

    if (error) console.error('[RETELL] ✗  call_analyzed update failed:', error.message)

    console.log(`[RETELL] ✓  call_analyzed — ${callId}`, JSON.stringify(updatePayload))

    // Post-call analysis is a more reliable extraction pass than the live mid-call tool
    // call (which sometimes drops fields under conversational pressure) — backfill any
    // lead fields that came back empty from capture_lead, without overwriting real data.
    if (updatedCall?.id && (callerEmail || issueDescription || urgency || vertical)) {
      const { data: leadRow } = await supabase
        .from('leads')
        .select('id, caller_email, issue_description, urgency, vertical')
        .eq('call_id', updatedCall.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (leadRow) {
        const backfill: Record<string, unknown> = {}
        if (!leadRow.caller_email && callerEmail)         backfill.caller_email      = callerEmail
        if (!leadRow.issue_description && issueDescription) backfill.issue_description = issueDescription
        if ((!leadRow.urgency || leadRow.urgency === 'normal') && urgency) backfill.urgency = urgency
        if (!leadRow.vertical && vertical)                 backfill.vertical          = vertical

        if (Object.keys(backfill).length > 0) {
          const { error: backfillError } = await supabase
            .from('leads')
            .update(backfill)
            .eq('id', leadRow.id)

          if (backfillError) console.error('[RETELL] ✗  Lead backfill failed:', backfillError.message)
          else console.log(`[RETELL] ✓  Backfilled lead ${leadRow.id} from post-call analysis:`, JSON.stringify(backfill))
        }
      }
    }

    return NextResponse.json({ success: true, event })
  }

  // ── Unhandled — acknowledge so Retell doesn't retry ───────────────────────
  console.log(`[RETELL] ℹ  Unhandled event: ${event}`)
  return NextResponse.json({ success: true, event })
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

  if (!callId) {
    console.error('[RETELL] ✗  Missing call_id. call:', JSON.stringify(call))
    return NextResponse.json({ error: 'Missing call_id' }, { status: 400 })
  }

  // ── call_started ──────────────────────────────────────────────────────────
  if (event === 'call_started') {
    const { error } = await supabase.from('calls').insert({
      call_id:      callId,
      client_domain: 'demo.369agenticsystems.com',
      caller_phone: fromNumber ?? 'unknown',
      call_outcome: 'in_progress',
      created_at:   receivedAt,
    })

    if (error) {
      console.error('[RETELL] ✗  Insert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[RETELL] ✓  call_started — ${callId} from ${fromNumber}`)
    return NextResponse.json({ success: true, event })
  }

  // ── call_ended ────────────────────────────────────────────────────────────
  if (event === 'call_ended') {
    const startTs = call.start_timestamp as number | undefined
    const endTs   = call.end_timestamp   as number | undefined
    const durationSeconds = startTs && endTs
      ? Math.floor((endTs - startTs) / 1000)
      : null

    const summary = ((call.call_summary as string) ?? '').toLowerCase()
    let outcome = 'captured_lead'
    if      (summary.includes('booked') || summary.includes('appointment')) outcome = 'booked'
    else if (summary.includes('spam')   || summary.includes('hang'))        outcome = 'spam'
    else if (summary.includes('no answer') || summary.includes('voicemail')) outcome = 'no_answer'

    // Upsert — handles the case where call_started webhook was missed
    const { error } = await supabase
      .from('calls')
      .upsert({
        call_id:          callId,
        client_domain:    'demo.369agenticsystems.com',
        caller_phone:     fromNumber ?? 'unknown',
        duration_seconds: durationSeconds,
        transcript:       (call.transcript as string) ?? null,
        call_outcome:     outcome,
        captured_at:      new Date().toISOString(),
      }, { onConflict: 'call_id' })

    if (error) {
      console.error('[RETELL] ✗  Upsert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[RETELL] ✓  call_ended — ${callId} → ${outcome} (${durationSeconds}s)`)
    return NextResponse.json({ success: true, event, outcome })
  }

  // ── call_analyzed ─────────────────────────────────────────────────────────
  if (event === 'call_analyzed') {
    const analysis = call.call_analysis as Record<string, unknown> | undefined
    const custom   = analysis?.custom_analysis_data as Record<string, unknown> | undefined

    const callerEmail     = (custom?.caller_email      as string | undefined) ?? null
    const issueDescription = (custom?.issue_description as string | undefined) ?? null
    const urgency          = (custom?.urgency           as string | undefined) ?? null

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
    if (updatedCall?.id && (callerEmail || issueDescription || urgency)) {
      const { data: leadRow } = await supabase
        .from('leads')
        .select('id, caller_email, issue_description, urgency')
        .eq('call_id', updatedCall.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (leadRow) {
        const backfill: Record<string, unknown> = {}
        if (!leadRow.caller_email && callerEmail)         backfill.caller_email      = callerEmail
        if (!leadRow.issue_description && issueDescription) backfill.issue_description = issueDescription
        if ((!leadRow.urgency || leadRow.urgency === 'normal') && urgency) backfill.urgency = urgency

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

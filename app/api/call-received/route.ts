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

    const callerName = (custom?.caller_name as string) ?? null

    // Update caller_name in calls (only column that exists for this data)
    if (callerName) {
      const { error } = await supabase
        .from('calls')
        .update({ caller_name: callerName })
        .eq('call_id', callId)

      if (error) console.error('[RETELL] ✗  caller_name update failed:', error.message)
    }

    console.log(`[RETELL] ✓  call_analyzed — ${callId} name=${callerName} analysis:`, JSON.stringify(analysis))
    return NextResponse.json({ success: true, event })
  }

  // ── Unhandled — acknowledge so Retell doesn't retry ───────────────────────
  console.log(`[RETELL] ℹ  Unhandled event: ${event}`)
  return NextResponse.json({ success: true, event })
}

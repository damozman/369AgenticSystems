import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const receivedAt = new Date().toISOString()
  console.log(`[RETELL] ▶  Incoming webhook — ${receivedAt}`)

  let webhook: Record<string, unknown>
  try {
    webhook = await request.json()
  } catch {
    console.error('[RETELL] ✗  Failed to parse JSON')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event      = webhook.event as string | undefined
  const data       = webhook.data  as Record<string, unknown> | undefined

  if (!event || !data) {
    return NextResponse.json({ error: 'Missing event or data' }, { status: 400 })
  }

  const callId     = data.call_id    as string | undefined
  const customData = data.custom_data as Record<string, string> | undefined

  if (!callId) {
    return NextResponse.json({ error: 'Missing call_id' }, { status: 400 })
  }

  // ── call_started ──────────────────────────────────────────────────────────
  if (event === 'call_started') {
    const { error } = await supabase.from('calls').insert({
      call_id:      callId,
      client_domain: customData?.client_domain ?? 'unknown',
      caller_phone: (data.from_number as string) ?? 'unknown',
      call_outcome: 'in_progress',
      created_at:   receivedAt,
    })

    if (error) {
      console.error('[RETELL] ✗  Insert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[RETELL] ✓  call_started logged — ${callId}`)
    return NextResponse.json({ success: true, event })
  }

  // ── call_ended ────────────────────────────────────────────────────────────
  if (event === 'call_ended') {
    const startTs = data.start_timestamp as number | undefined
    const endTs   = data.end_timestamp   as number | undefined
    const durationSeconds = startTs && endTs
      ? Math.floor((endTs - startTs) / 1000)
      : null

    const summary = ((data.call_summary as string) ?? '').toLowerCase()
    let outcome = 'captured_lead'
    if      (summary.includes('booked') || summary.includes('appointment')) outcome = 'booked'
    else if (summary.includes('spam')   || summary.includes('hang'))        outcome = 'spam'
    else if (summary.includes('no answer') || summary.includes('voicemail')) outcome = 'no_answer'

    const { error } = await supabase
      .from('calls')
      .update({
        duration_seconds: durationSeconds,
        transcript:       (data.transcript as string) ?? null,
        call_outcome:     outcome,
        captured_at:      new Date().toISOString(),
      })
      .eq('call_id', callId)

    if (error) {
      console.error('[RETELL] ✗  Update failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[RETELL] ✓  call_ended updated — ${callId} → ${outcome}`)
    return NextResponse.json({ success: true, event, outcome })
  }

  // ── Unhandled event — acknowledge so Retell doesn't retry ─────────────────
  console.log(`[RETELL] ℹ  Unhandled event: ${event}`)
  return NextResponse.json({ success: true, event })
}

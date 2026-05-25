import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'

export async function POST(request: Request) {
  let body: { responseId: string; action: 'approve' | 'reject' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { responseId, action } = body
  if (!responseId || !action) {
    return NextResponse.json({ error: 'Missing responseId or action' }, { status: 400 })
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('pending_responses')
      .update({ status: 'rejected' })
      .eq('id', responseId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    console.log(`[SEND RESPONSE] ✓  Rejected — ${responseId}`)
    return NextResponse.json({ success: true })
  }

  // ── Approve + Send ────────────────────────────────────────────────────────
  const { data: draft, error: fetchError } = await supabaseAdmin
    .from('pending_responses')
    .select('*')
    .eq('id', responseId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !draft) {
    return NextResponse.json({ error: 'Draft not found or already processed' }, { status: 404 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseFrom = process.env.RESEND_FROM_EMAIL ?? 'command@alerts.369agenticsystems.com'

  const { data: sent, error: sendError } = await resend.emails.send({
    from:    `369 Agentic Systems <${baseFrom}>`,
    to:      draft.prospect_email,
    replyTo: OWNER_EMAIL,
    subject: draft.draft_subject,
    text:    draft.draft_body,
  })

  if (sendError) {
    console.error(`[SEND RESPONSE] ✗  Resend error — ${sendError.message}`)
    return NextResponse.json({ error: sendError.message }, { status: 500 })
  }

  await supabaseAdmin
    .from('pending_responses')
    .update({
      status:    'sent',
      sent_at:   new Date().toISOString(),
      resend_id: sent?.id ?? null,
    })
    .eq('id', responseId)

  console.log(`[SEND RESPONSE] ✓  Sent to ${draft.prospect_email} | id: ${sent?.id}`)
  return NextResponse.json({ success: true })
}

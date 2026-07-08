import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendRexStep0Email, sendSMS, REX_SMS_TEMPLATES, type RexVertical } from '@/lib/rex-sequences'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REX_VERTICALS: RexVertical[] = ['roofing', 'hvac', 'plumbing']

// Resolves which vertical's follow-up templates to use, or signals that this lead's
// vertical doesn't have real templates yet (so the caller should skip firing rather
// than send mismatched-industry copy — e.g. a legal prospect getting a roofing email).
async function resolveVertical(lead: { client_domain: string; vertical: string | null }): Promise<RexVertical | 'unsupported' | 'unknown'> {
  // 1. Trust Ava's live classification first, if it's one we have templates for.
  if (lead.vertical && REX_VERTICALS.includes(lead.vertical as RexVertical)) {
    return lead.vertical as RexVertical
  }

  // 2. Real paying client — use their subscribed vertical.
  const { data } = await supabase
    .from('agent_subscriptions')
    .select('vertical')
    .eq('client_domain', lead.client_domain)
    .maybeSingle()
  const subVertical = data?.vertical as string | undefined
  if (subVertical && REX_VERTICALS.includes(subVertical as RexVertical)) {
    return subVertical as RexVertical
  }

  // 3. A real vertical was identified (by Ava or the subscription), just not one we
  //    have templates for yet.
  if (lead.vertical || subVertical) return 'unsupported'

  // 4. No vertical info at all (legacy data predating this field) — fall back to
  //    roofing, the original single-vertical default.
  return 'unknown'
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lead_id } = body as { lead_id?: string }
  if (!lead_id) {
    return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 })
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, client_domain, caller_name, caller_phone, caller_email, vertical')
    .eq('id', lead_id)
    .maybeSingle()

  if (leadError || !lead) {
    console.error('[REX] ✗  Lead lookup failed:', leadError?.message ?? 'not found')
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (!lead.caller_email && !lead.caller_phone) {
    return NextResponse.json({ skipped: 'no contact method' })
  }

  const { data: existing } = await supabase
    .from('follow_up_sequences')
    .select('id')
    .eq('lead_id', lead_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ skipped: 'sequence already exists' })
  }

  const resolved = await resolveVertical({ client_domain: lead.client_domain, vertical: lead.vertical })

  if (resolved === 'unsupported') {
    console.log(`[REX] ⚠  Skipped lead ${lead_id} — no follow-up templates yet for this vertical`)
    return NextResponse.json({ skipped: 'no templates for this vertical yet' })
  }

  const vertical: RexVertical = resolved === 'unknown' ? 'roofing' : resolved

  if (lead.caller_email) {
    try {
      await sendRexStep0Email({
        toEmail:      lead.caller_email,
        callerName:   lead.caller_name ?? undefined,
        vertical,
        clientDomain: lead.client_domain,
      })
    } catch (e) {
      console.error('[REX] Step 0 email failed:', e)
    }
  }

  if (lead.caller_phone) {
    await sendSMS(lead.caller_phone, REX_SMS_TEMPLATES[vertical].step0)
  }

  const { error: seqError } = await supabase.from('follow_up_sequences').insert({
    lead_id,
    client_domain:  lead.client_domain,
    vertical,
    sequence_step:  0,
    step_0_sent_at: new Date().toISOString(),
  })

  if (seqError) {
    console.error('[REX] Sequence insert failed:', seqError.message)
    return NextResponse.json({ error: seqError.message }, { status: 500 })
  }

  await supabase
    .from('leads')
    .update({ follow_up_sent: true, follow_up_sent_at: new Date().toISOString() })
    .eq('id', lead_id)

  console.log(`[REX] ✓  Step 0 fired for lead ${lead_id} (${vertical})`)
  return NextResponse.json({ success: true })
}

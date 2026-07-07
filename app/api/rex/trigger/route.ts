import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendRexStep0Email, sendSMS, REX_SMS_TEMPLATES, type RexVertical } from '@/lib/rex-sequences'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REX_VERTICALS: RexVertical[] = ['roofing', 'hvac', 'plumbing']

async function resolveVertical(clientDomain: string): Promise<RexVertical> {
  const { data } = await supabase
    .from('agent_subscriptions')
    .select('vertical')
    .eq('client_domain', clientDomain)
    .maybeSingle()

  const vertical = data?.vertical as string | undefined
  return REX_VERTICALS.includes(vertical as RexVertical) ? (vertical as RexVertical) : 'roofing'
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
    .select('id, client_domain, caller_name, caller_phone, caller_email')
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

  const vertical = await resolveVertical(lead.client_domain)

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

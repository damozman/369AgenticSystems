import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendRexStep1Email, sendRexStep2Email, sendSMS, renderRexSms, type RexVertical } from '@/lib/rex-sequences'
import { consentForLead } from '@/lib/sms-consent'
import { businessNameFor } from '@/lib/client-identity'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REX_VERTICALS: RexVertical[] = ['roofing', 'hvac', 'plumbing']
function asRexVertical(v: string): RexVertical {
  return REX_VERTICALS.includes(v as RexVertical) ? (v as RexVertical) : 'roofing'
}

// Vercel cron fires this daily at 14:00 UTC = 9:00 AM CT
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let advancedToStep1 = 0
  let advancedToStep2 = 0

  // ── Step 0 → Step 1 (3 days) ────────────────────────────────────────────────
  const { data: dueStep1 } = await supabase
    .from('follow_up_sequences')
    .select('id, lead_id, client_domain, vertical')
    .eq('sequence_step', 0)
    .eq('completed', false)
    .eq('converted', false)
    .lt('step_0_sent_at', threeDaysAgo)

  for (const seq of dueStep1 ?? []) {
    const { data: lead } = await supabase
      .from('leads')
      .select('caller_name, caller_phone, caller_email')
      .eq('id', seq.lead_id)
      .maybeSingle()

    if (!lead) continue
    const vertical = asRexVertical(seq.vertical)

    let emailSent = false
    if (lead.caller_email) {
      try {
        await sendRexStep1Email({
          toEmail: lead.caller_email, callerName: lead.caller_name ?? undefined,
          vertical, clientDomain: seq.client_domain,
        })
        emailSent = true
      } catch (e) { console.error('[REX] Step 1 email failed:', e) }
    }
    const smsSent = lead.caller_phone
      ? await sendSMS(
          lead.caller_phone,
          renderRexSms(vertical, 'step1', await businessNameFor(supabase, seq.client_domain)),
          await consentForLead(supabase, seq.lead_id),
          seq.lead_id,
        )
      : false

    // Only advance (and stamp step_1_sent_at, which step 2's timing depends on)
    // if something actually went out, or there was no contact info to try in
    // the first place — a caught failure used to advance anyway, meaning a
    // real delivery failure silently skipped the customer straight to step 2's
    // 7-day clock instead of retrying step 1 the next day.
    const hadContactInfo = !!lead.caller_email || !!lead.caller_phone
    if (!hadContactInfo || emailSent || smsSent) {
      await supabase
        .from('follow_up_sequences')
        .update({ sequence_step: 1, step_1_sent_at: new Date().toISOString() })
        .eq('id', seq.id)
      advancedToStep1++
    } else {
      console.error(`[REX CRON] ✗  Step 1 failed entirely for sequence ${seq.id} — will retry next run`)
    }
  }

  // ── Step 1 → Step 2 (7 days, final) ─────────────────────────────────────────
  const { data: dueStep2 } = await supabase
    .from('follow_up_sequences')
    .select('id, lead_id, client_domain, vertical')
    .eq('sequence_step', 1)
    .eq('completed', false)
    .eq('converted', false)
    .lt('step_1_sent_at', sevenDaysAgo)

  for (const seq of dueStep2 ?? []) {
    const { data: lead } = await supabase
      .from('leads')
      .select('caller_name, caller_phone, caller_email')
      .eq('id', seq.lead_id)
      .maybeSingle()

    if (!lead) continue
    const vertical = asRexVertical(seq.vertical)

    let emailSent = false
    if (lead.caller_email) {
      try {
        await sendRexStep2Email({
          toEmail: lead.caller_email, callerName: lead.caller_name ?? undefined,
          vertical, clientDomain: seq.client_domain,
        })
        emailSent = true
      } catch (e) { console.error('[REX] Step 2 email failed:', e) }
    }
    const smsSent = lead.caller_phone
      ? await sendSMS(
          lead.caller_phone,
          renderRexSms(vertical, 'step2', await businessNameFor(supabase, seq.client_domain)),
          await consentForLead(supabase, seq.lead_id),
          seq.lead_id,
        )
      : false

    const hadContactInfo = !!lead.caller_email || !!lead.caller_phone
    if (!hadContactInfo || emailSent || smsSent) {
      await supabase
        .from('follow_up_sequences')
        .update({ sequence_step: 2, completed: true, step_2_sent_at: new Date().toISOString() })
        .eq('id', seq.id)
      advancedToStep2++
    } else {
      console.error(`[REX CRON] ✗  Step 2 failed entirely for sequence ${seq.id} — will retry next run`)
    }
  }

  console.log(`[REX CRON] ✓  Advanced ${advancedToStep1} → step 1, ${advancedToStep2} → step 2 (completed)`)
  return NextResponse.json({ success: true, advancedToStep1, advancedToStep2 })
}

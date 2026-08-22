/**
 * Places the audit calls whose time has come. Dossier step 5.
 *
 * Thin on purpose: every decision about *whether* a call may be placed lives in
 * `lib/audit-dispatch.ts`, which is pure and tested. This route fetches, asks, dials and writes.
 *
 * **It does nothing at all unless `AUDIT_CALLS_ENABLED` is exactly `'true'`.** The intake form does
 * not yet tell submitters that we place a test call to their published line — that line was held
 * back at step 2 because there was no agent to place it. Calling someone who was never told is the
 * failure that costs a customer, so the switch and the disclosure flip together.
 *
 * **Claim before spending.** A row is moved `scheduled → placed` *before* Retell is called, and the
 * update is conditional on it still being `scheduled`. Two overlapping runs cannot both dial the
 * same prospect: the loser's update matches zero rows and it skips. This is the same shape as
 * `provisioning_claims`, which exists because one Stripe checkout once bought three phone numbers.
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  decideBatch, toPlace, summarise, auditCallsEnabled, MAX_LATENESS_MS,
} from '@/lib/audit-dispatch'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Report the disabled state explicitly rather than returning an empty success. A cron that says
  // "ok, 0 placed" while switched off is indistinguishable from one that had nothing to do —
  // `silence-check` failed silently for months because nobody could tell those apart.
  if (!auditCallsEnabled()) {
    console.log('[369 AUDIT-CALLS] switch off (AUDIT_CALLS_ENABLED != "true") — nothing placed')
    return NextResponse.json({ ok: true, enabled: false, placed: 0 })
  }

  // Only rows that could plausibly be due. The lateness bound is applied again in decideOne;
  // this just keeps the query small.
  const floor = new Date(now.getTime() - MAX_LATENESS_MS).toISOString()
  const { data, error } = await supabaseAdmin
    .from('audit_calls')
    .select('id, audit_id, slot, scheduled_for, status, target_phone, call_id, business_name, domain, vertical')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now.toISOString())
    .gte('scheduled_for', floor)
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (error) {
    console.error(`[369 AUDIT-CALLS] ✗ could not read schedule: ${error.message}`)
    return NextResponse.json({ error: 'Could not read schedule' }, { status: 500 })
  }

  const rows = data ?? []
  const decisions = decideBatch(rows, now)
  const due = toPlace(decisions)
  console.log(`[369 AUDIT-CALLS] ${rows.length} candidate(s) · ${summarise(decisions)}`)

  // Imported lazily: the Retell SDK throws at module load when RETELL_API_KEY is unset, and this
  // route must still answer honestly on a deployment where audit calling is off.
  const { placeAuditCall } = due.length
    ? await import('@/lib/audit-call-dial')
    : { placeAuditCall: null }

  let placed = 0
  const failures: string[] = []

  for (const row of due) {
    // Claim it. Conditional on still being 'scheduled', so a concurrent run loses the race here
    // rather than on someone's phone.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('audit_calls')
      .update({ status: 'placed', called_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .select('id')

    if (claimErr || !claimed?.length) {
      console.log(`[369 AUDIT-CALLS] · ${row.id} claimed by another run — skipping`)
      continue
    }

    try {
      const { callId } = await placeAuditCall!({
        phone:        row.target_phone,
        businessName: row.business_name ?? undefined,
        domain:       row.domain ?? undefined,
        vertical:     row.vertical ?? undefined,
      })
      await supabaseAdmin.from('audit_calls').update({ call_id: callId }).eq('id', row.id)
      placed++
      console.log(`[369 AUDIT-CALLS] ✓ ${row.slot} call placed for ${row.audit_id} — ${callId}`)
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      failures.push(`${row.id}: ${why}`)
      // Our failure, and it must never become a finding about the business. `failed` rows are
      // excluded from the pair, which is what makes the dossier omit the section rather than
      // report "we could not reach you".
      await supabaseAdmin
        .from('audit_calls')
        .update({ status: 'failed', reportable: false, unreportable: 'our_infrastructure', detail: why })
        .eq('id', row.id)
      console.error(`[369 AUDIT-CALLS] ✗ ${row.id} — ${why}`)
    }
  }

  return NextResponse.json({
    ok: true,
    enabled: true,
    candidates: rows.length,
    placed,
    failures: failures.length,
    summary: summarise(decisions),
  })
}

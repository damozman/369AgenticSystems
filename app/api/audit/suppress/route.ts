/**
 * "Don't call me again." The thing that makes Ava's opt-out an honest offer.
 *
 * Called as a custom tool by the callback agent when someone rings the audit number back and asks
 * not to be called, and usable by hand for a complaint that arrives any other way.
 *
 * Two effects, and both matter:
 *   1. **The number is suppressed**, permanently, for any future audit call. Keyed on the phone
 *      rather than the submission, because a person refusing is talking about their phone — and
 *      the same number can appear on several submissions.
 *   2. **Any call already scheduled is cancelled.** We place two calls, so the most likely moment
 *      for someone to ring back is between them. A refusal that left the evening call standing
 *      would be worse than no refusal at all: they asked, we said yes, and the phone rang anyway.
 *
 * Idempotent. Asking twice is not an error — it is a person who did not trust the first answer.
 *
 * Never fails closed on the caller's behalf: if the cancel half fails the suppression still stands,
 * and the dispatcher checks suppression at dial time as its own gate, so the number is safe even if
 * the rows were never touched.
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { toE164 } from '@/lib/audit-call'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const REASONS = new Set(['requested', 'complaint', 'wrong_number', 'manual'])

export async function POST(request: NextRequest) {
  // Same shared-secret gate the other internal routes use. Retell sends it as a header on custom
  // tool calls; arming it without telling a producer is how this repo lost ten days once, so any
  // new caller of this route has to be given the secret at the same time.
  const secret = request.headers.get('x-internal-secret')
  if (process.env.INTERNAL_API_SECRET && secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = typeof body.phone === 'string' ? body.phone : ''
  const phone = toE164(raw)
  if (!phone) {
    // Nothing to suppress, and saying "done" would be a lie. The agent should ask again.
    return NextResponse.json(
      { error: 'A dialable US phone number is required', received: raw.slice(0, 40) },
      { status: 400 },
    )
  }

  const reasonRaw = typeof body.reason === 'string' ? body.reason : 'requested'
  const reason = REASONS.has(reasonRaw) ? reasonRaw : 'requested'
  const source = typeof body.source === 'string' ? body.source.slice(0, 80) : 'callback_line'
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null

  const { error: supErr } = await supabaseAdmin
    .from('audit_suppressions')
    .upsert({ phone, reason, source, note }, { onConflict: 'phone' })

  if (supErr) {
    // The one failure the caller must hear about: we cannot promise to stop if we did not record
    // the refusal. Better a confused apology than a broken promise.
    console.error(`[369 SUPPRESS] ✗ could not record ${phone}: ${supErr.message}`)
    return NextResponse.json({ error: 'Could not record the request' }, { status: 500 })
  }

  // Call off anything still pending for that number.
  const { data: cancelled, error: cancelErr } = await supabaseAdmin
    .from('audit_calls')
    .update({ status: 'cancelled', detail: `Suppressed: ${reason}` })
    .eq('target_phone', phone)
    .eq('status', 'scheduled')
    .select('id, slot')

  if (cancelErr) {
    // Suppression stands, and the dispatcher re-checks it at dial time, so the number is still
    // safe. Log loudly because the rows are now inconsistent with the promise we just made.
    console.error(`[369 SUPPRESS] ⚠ ${phone} suppressed but pending calls NOT cancelled: ${cancelErr.message}`)
  }

  console.log(`[369 SUPPRESS] ✓ ${phone} (${reason}) — ${cancelled?.length ?? 0} pending call(s) cancelled`)

  return NextResponse.json({
    ok: true,
    phone,
    reason,
    cancelled: cancelled?.length ?? 0,
    // What the agent may say out loud. Nothing here promises anything not just done.
    spoken_confirmation: 'Done — I have taken your number off our list, and you will not get another call from us.',
  })
}

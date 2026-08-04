import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { denyIfBadSecret, INTERNAL_SECRET_HEADER } from '@/lib/security/route-guard'
import { placeAuditCall, toE164 } from '@/lib/audit-call-dial'

/**
 * Places one "we called your line" audit call (plan Phase 2b).
 *
 * **Guarded.** This spends money and makes a real phone call to a real business on every
 * request, which is about as far from a safe default-open route as it gets. It uses the
 * shared-secret gate for the same reason `/api/rex/trigger` does.
 *
 * ⚠️ `denyIfBadSecret` enforces only once its secret env var is set — a deliberate
 * dormant-rollout design (`lib/security/route-guard.ts`). That is fine for a route that
 * merely writes a row; it is NOT fine here, so this route additionally refuses to run at
 * all unless the secret is configured. An unauthenticated dialer is how you buy someone
 * else's robocall campaign. This is the same failure that made `/api/update-dossier` an
 * open relay, which is why it fails closed instead of dormant.
 *
 * One number per request. The bulk run is deliberately not built here — it needs a
 * decision about calling businesses that never contacted us, which is a different legal
 * posture from calling a prospect who just submitted a form.
 *
 * The call resolves asynchronously: this writes a `placed` row and Retell's `call_ended`
 * webhook completes it via `/api/call-received`.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Fail closed, not dormant — see the note above.
  if (!process.env.INTERNAL_API_SECRET) {
    console.error('[369 AUDIT] ✗  Refusing to dial: INTERNAL_API_SECRET is not configured')
    return NextResponse.json(
      { error: 'Audit calling is not configured' },
      { status: 503 },
    )
  }

  const denied = denyIfBadSecret(request, process.env.INTERNAL_API_SECRET, INTERNAL_SECRET_HEADER)
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')

  const phone        = str('phone')
  const businessName = str('business_name')
  const domain       = str('domain')
  const vertical     = str('vertical')

  // Validate before dialling: a malformed number comes back from Retell as
  // `invalid_destination`, which costs money and establishes nothing.
  const e164 = toE164(phone)
  if (!e164) {
    return NextResponse.json(
      { error: `Not a dialable US number: ${phone || '(missing)'}` },
      { status: 400 },
    )
  }

  let callId: string
  try {
    ;({ callId } = await placeAuditCall({ phone: e164, businessName, domain, vertical }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[369 AUDIT] ✗  Could not place call to ${e164}: ${message}`)
    return NextResponse.json({ error: 'Could not place call' }, { status: 502 })
  }

  // The call is already dialling, so a failure here loses the record but not the money.
  // Log loudly rather than pretending it did not happen.
  const { error } = await supabase.from('audit_calls').insert({
    call_id:       callId,
    target_phone:  e164,
    business_name: businessName || null,
    domain:        domain || null,
    vertical:      vertical || null,
    status:        'placed',
  })

  if (error) {
    console.error(
      `[369 AUDIT] ✗  Call ${callId} is dialling but was NOT recorded: ${error.message}`,
    )
    return NextResponse.json(
      { error: 'Call placed but not recorded', call_id: callId },
      { status: 500 },
    )
  }

  console.log(`[369 AUDIT] ▶  Placed ${callId} → ${e164} (${businessName || 'unnamed'})`)
  return NextResponse.json({ success: true, call_id: callId, status: 'placed' })
}

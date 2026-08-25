import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { notifyOwnerOfSubmission } from '@/lib/lead-engine/notify'
import {
  decideSubmitThrottle, honeypotTripped, SUBMIT_THROTTLE_WINDOW_SECONDS,
} from '@/lib/lead-engine/rate-limit'

/**
 * The public lead form's POST target.
 *
 * Same contract as `/api/intake`, deliberately the inverse of `/api/early-access`: **this route
 * only reports success once the submission row is committed.** The form's success screen depends
 * on that — a soft "ok" over a failed insert is a lead that looks captured and never was.
 *
 * **Not gated on the site being `status = 'live'`, and this is a SEPARATE fact from the page-level
 * preview gate in `lib/lead-engine/preview.ts` — reading one does not tell you the other.**
 * `loadSiteBySlug` refuses to SERVE a non-live page to a stranger; this route, reached only once
 * someone already has a `siteId` (from a rendered page or from us directly), still ACCEPTS a
 * submission against a draft/in_build site. That is deliberate: a preview site under build-out
 * still needs to receive a real test submission, and gating this on status would only reject the
 * exact traffic we generate ourselves to prove the form works. If this route is ever tightened to
 * require `live`, the preview gate does not need to change and vice versa — check this comment,
 * not the other file, before assuming either covers the other.
 *
 * **Abuse: a honeypot plus a per-site throttle, not per-IP** — see `lib/lead-engine/rate-limit.ts`
 * for why. Both are cheap on purpose: this is a public route with no session, so nothing here can
 * assume anything about the caller beyond a `siteId` it already looked up once.
 *
 * `force-dynamic` matters MORE here than on a typical read route: the throttle's own count query
 * has to see every prior submission, not a cached one — a cached count is a throttle a script can
 * simply outrun. See `app/api/lead-engine/questionnaire/[id]/route.ts`'s own note on why Next's
 * Data Cache can silently cache a Route Handler's internal Supabase `fetch()` calls otherwise.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const str = (k: string, max = 2000) =>
    typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : ''

  const siteId = str('siteId', 100)
  const name = str('name', 100)
  const phone = str('phone', 40)
  const email = str('email', 200)
  const message = str('message', 2000)

  // The honeypot field is invisible in the real form (`LeadForm.tsx`'s `hp_field`, hidden off
  // canvas rather than `display:none` — some bots skip fields a naive CSS check would catch). A
  // human cannot fill it; anything that did is not a submission this product wants to capture.
  // Answered with a fake success rather than a 4xx, so a bot's script sees nothing to react to.
  if (honeypotTripped(body.hp_field)) {
    return NextResponse.json({ ok: true })
  }

  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: site, error: siteError } = await admin
    .from('lead_engine_sites')
    .select('id, business_name, owner_email, notify_email, slug')
    .eq('id', siteId)
    .maybeSingle()

  if (siteError || !site) {
    return NextResponse.json({ error: 'That site could not be found.' }, { status: 404 })
  }

  const since = new Date(Date.now() - SUBMIT_THROTTLE_WINDOW_SECONDS * 1000).toISOString()
  const { count: recentCount } = await admin
    .from('lead_engine_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .gte('created_at', since)

  const throttle = decideSubmitThrottle(recentCount ?? 0)
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "That's a lot of messages in a short time — please try again in a minute." },
      { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } },
    )
  }

  // ── Capture first. Notification is best-effort. ────────────────────────────
  const { data: row, error: insertError } = await admin
    .from('lead_engine_submissions')
    .insert({
      site_id: siteId,
      name, phone: phone || null, email, message: message || null,
    })
    .select('id')
    .single()

  if (insertError || !row) {
    console.error(`[LEAD-ENGINE] submission insert failed for site ${siteId}: ${insertError?.message}`)
    return NextResponse.json({ error: 'Could not save that — try again in a moment.' }, { status: 500 })
  }

  const result = await notifyOwnerOfSubmission(
    { business_name: site.business_name, notify_email: site.notify_email, slug: site.slug, owner_email: site.owner_email },
    { name, email, phone: phone || null, message: message || null, serviceInterest: null },
  )

  if (result.ok) {
    await admin.from('lead_engine_submissions').update({ notified_at: new Date().toISOString() }).eq('id', row.id)
  } else {
    console.error(`[LEAD-ENGINE] owner notify failed for submission ${row.id}: ${result.error}`)
    await admin.from('lead_engine_submissions').update({ notify_error: result.error }).eq('id', row.id)
  }

  return NextResponse.json({ ok: true })
}

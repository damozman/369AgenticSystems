/**
 * The daily nudge. Step 6, and the part Chris asked for by name.
 *
 * His warning when the approval gate was agreed: **an approval queue nobody clears is where this
 * dies.** A gate that quietly accumulates unread dossiers is worse than no gate — the prospect
 * still gets nothing, and now nobody is even aware of it.
 *
 * So this states the count AND the age of the oldest, because "3 waiting" is ignorable and "3
 * waiting, the oldest has been waiting 4 days" is not. Each one carries a signed link straight to
 * its review page.
 *
 * **It sends nothing when the queue is empty.** A daily email that usually says "nothing to do"
 * trains its reader to ignore it, and this is the one message that must survive being ignored.
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { Resend } from 'resend'
import { nudgeSummary } from '@/lib/dossier-queue'
import { dossierReviewUrl } from '@/lib/security/dossier-token'
import { resendFrom } from '@/lib/email-from'
import { escapeHtml } from '@/lib/security/sanitize'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'
const ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://369agenticsystems.com'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('dossiers')
    .select('id, to_email, subject, built_at')
    .eq('status', 'pending')
    .order('built_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error(`[369 DOSSIER-NUDGE] ✗ could not read the queue: ${error.message}`)
    return NextResponse.json({ error: 'Could not read the queue' }, { status: 500 })
  }

  const pending = data ?? []
  const summary = nudgeSummary(pending, new Date())
  if (!summary) {
    console.log('[369 DOSSIER-NUDGE] queue empty — no mail sent')
    return NextResponse.json({ ok: true, pending: 0, sent: false })
  }

  // A dossier whose link cannot be signed is unreachable, and saying "3 waiting" while linking to
  // nothing is worse than saying nothing. Report it loudly instead.
  const rows = pending.map(d => ({ ...d, url: dossierReviewUrl(d.id, ORIGIN) }))
  const unlinkable = rows.filter(r => !r.url).length
  if (unlinkable) {
    console.error(`[369 DOSSIER-NUDGE] ⚠ ${unlinkable} dossier(s) have no signable link — ` +
                  `ONBOARDING_TOKEN_SECRET is unset`)
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[369 DOSSIER-NUDGE] ✗ RESEND_API_KEY unset — nobody was nudged')
    return NextResponse.json({ error: 'Mail is not configured' }, { status: 500 })
  }

  const items = rows.map(r => {
    const waited = Math.floor((Date.now() - new Date(r.built_at).getTime()) / 86_400_000)
    const age = waited <= 0 ? 'today' : waited === 1 ? '1 day ago' : `${waited} days ago`
    const link = r.url
      ? `<a href="${escapeHtml(r.url)}" style="color:#D4AF37;">Read it</a>`
      : '<span style="color:#F87171;">no signed link — check ONBOARDING_TOKEN_SECRET</span>'
    return `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="font-size:14px;color:#E2E8F0;">${escapeHtml(r.subject)}</div>
      <div style="font-size:12px;color:#64748B;margin-top:3px;">
        ${escapeHtml(r.to_email ?? '')} · built ${age} · ${link}
      </div></td></tr>`
  }).join('')

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: mailErr } = await resend.emails.send({
      from: resendFrom('369 Command Center'),
      to: OWNER_EMAIL,
      subject: pending.length === 1
        ? 'A dossier is waiting for you'
        : `${pending.length} dossiers are waiting for you`,
      html: `<div style="background:#0A0A0A;padding:36px 20px;font-family:Inter,Arial,sans-serif;">
        <div style="max-width:560px;margin:0 auto;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D4AF37;font-family:monospace;">Approval queue</p>
          <h1 style="margin:0 0 16px;font-size:21px;color:#fff;">${escapeHtml(summary)}</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#CBD5E1;line-height:1.7;">
            Nothing has been sent. Each one goes out only when you read it and approve it.
          </p>
          <table style="width:100%;border-collapse:collapse;">${items}</table>
        </div></div>`,
    })
    if (mailErr) throw new Error(mailErr.message)
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    console.error(`[369 DOSSIER-NUDGE] ✗ nudge failed: ${why}`)
    return NextResponse.json({ error: 'Could not send the nudge', detail: why }, { status: 500 })
  }

  console.log(`[369 DOSSIER-NUDGE] ✓ ${summary}`)
  return NextResponse.json({ ok: true, pending: pending.length, sent: true, unlinkable })
}

/**
 * Approves a dossier and sends it. Step 6.
 *
 * **POST only, and that is a security decision rather than a REST preference.**
 *
 * Mail scanners, link-preview bots and corporate security gateways issue GET requests to every URL
 * in a message, often before a human has opened it. A one-click `?approve=1` link would therefore
 * approve and send every dossier the moment the nudge email arrived, with nobody having read a
 * word — and the approval gate exists precisely so that somebody reads a word. The signed token
 * authorises *viewing* the review page; sending requires a form submission from it.
 *
 * The token is bound to the dossier id, so a link for one cannot approve another.
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { Resend } from 'resend'
import { verifyDossierToken } from '@/lib/security/dossier-token'
import { canSend } from '@/lib/dossier-queue'
import { resendFrom } from '@/lib/email-from'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    // The review page posts a form; tolerate both shapes rather than failing a human's click.
    body = Object.fromEntries((await request.formData().catch(() => new FormData())).entries())
  }

  const id = typeof body.id === 'string' ? body.id : ''
  const token = typeof body.t === 'string' ? body.t : ''
  const action = body.action === 'decline' ? 'decline' : 'approve'
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null

  if (!id) return NextResponse.json({ error: 'Missing dossier id' }, { status: 400 })

  const check = verifyDossierToken(token, id)
  if (!check.valid) {
    console.warn(`[369 DOSSIER] ✗ approval refused for ${id}: ${check.reason}`)
    return NextResponse.json({ error: `Link is not valid (${check.reason})` }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('dossiers')
    .select('id, status, to_email, subject, html, sent_at')
    .eq('id', id)
    .limit(1)

  if (error) return NextResponse.json({ error: 'Could not read the dossier' }, { status: 500 })
  const row = data?.[0]
  if (!row) return NextResponse.json({ error: 'No such dossier' }, { status: 404 })

  // ── Declining ─────────────────────────────────────────────────────────────
  if (action === 'decline') {
    await supabaseAdmin.from('dossiers')
      .update({ status: 'declined', decline_reason: reason })
      .eq('id', id).eq('status', 'pending')
    console.log(`[369 DOSSIER] · ${id} declined${reason ? `: ${reason}` : ''}`)
    return NextResponse.json({ ok: true, action: 'declined' })
  }

  // ── Approving ─────────────────────────────────────────────────────────────
  const gate = canSend(row)
  if (!gate.ok) {
    console.warn(`[369 DOSSIER] · ${id} not sendable: ${gate.reason}`)
    return NextResponse.json({ error: `Cannot send: ${gate.reason}` }, { status: 409 })
  }

  // Claim it before mailing, conditional on it still being pending, so a double-click or two open
  // tabs cannot mail a prospect the same dossier twice. Same shape as the audit-call dialler and
  // provisioning_claims: claim, then spend.
  const { data: claimed } = await supabaseAdmin
    .from('dossiers')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending')
    .select('id')

  if (!claimed?.length) {
    return NextResponse.json({ error: 'Already handled' }, { status: 409 })
  }

  if (!process.env.RESEND_API_KEY) {
    await supabaseAdmin.from('dossiers')
      .update({ status: 'failed', send_error: 'RESEND_API_KEY unset' }).eq('id', id)
    return NextResponse.json({ error: 'Mail is not configured' }, { status: 500 })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: mailErr } = await resend.emails.send({
      from:    resendFrom('369 Agentic Systems'),
      to:      row.to_email!,
      replyTo: OWNER_EMAIL,
      subject: row.subject,
      html:    row.html,
    })
    if (mailErr) throw new Error(mailErr.message)

    await supabaseAdmin.from('dossiers')
      .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
    console.log(`[369 DOSSIER] ✓ sent to ${row.to_email}`)
    return NextResponse.json({ ok: true, action: 'sent', to: row.to_email })
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    // Back to failed rather than left as approved: 'approved' would read as "done" in the queue
    // while the prospect received nothing.
    await supabaseAdmin.from('dossiers')
      .update({ status: 'failed', send_error: why }).eq('id', id)
    console.error(`[369 DOSSIER] ✗ send failed for ${id}: ${why}`)
    return NextResponse.json({ error: 'Send failed', detail: why }, { status: 500 })
  }
}

/**
 * Deliberately answers GET with 405.
 *
 * If a scanner or a curious click ever reaches this URL, it must do nothing at all — and say so,
 * rather than 404ing in a way that looks like the feature is missing.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Approval requires a POST from the review page. Nothing was sent.' },
    { status: 405 },
  )
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/security/sanitize'
import { resendFrom } from '@/lib/email-from'

/**
 * First-party intake for the static cold-email landing pages.
 *
 * Replaces the browser-to-Gumloop POST those pages used to make directly. That
 * arrangement lost leads silently: Gumloop answers 200 with a run id and then may
 * never call back, while the page showed a success screen regardless. Nine days of
 * submissions went unrecorded and unnoticed that way.
 *
 * The contract here is deliberately the inverse of `/api/early-access`, which returns
 * success even when its insert fails: **this route only reports success once the lead
 * row is committed.** The page relies on that to decide whether to show the success
 * screen or a fallback with a phone number, so a soft failure here means a lost lead.
 *
 * A failed insert also emails the owner the full payload (see `alertOwner`). A 500 that
 * only reaches Vercel's logs is what made the original outage last nine days — the
 * pipeline breaking was survivable, nobody being told was not.
 *
 * Enrichment (the AI "dossier") is explicitly best-effort and downstream. If Gumloop —
 * or whatever replaces it — is down, the lead is still captured and the owner is still
 * notified. Enrichment degrades; capture does not.
 *
 * Note this route emails the OWNER ONLY. Its predecessor `/api/update-dossier` mailed the
 * address in its payload with no authentication, which made it usable as an open spam
 * relay from the 369 domain; that route has been deleted. Keeping submitter mail out of
 * here means an attacker posting junk can only reach the owner's own inbox.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'

/**
 * Optional second recipient for lead alerts, on a different mail provider.
 *
 * On 2026-08-03 the mailbox behind `OWNER_EMAIL` went offline — its MX host stopped
 * answering on every port — and lead notifications, plus Supabase sign-in links, failed
 * silently for days. A single mailbox is a single point of failure for the one signal
 * that says "a prospect is waiting". Set this to an address on another provider and a
 * repeat of that outage still reaches someone.
 *
 * Dormant when unset, so this ships without changing behaviour.
 */
const OWNER_EMAIL_CC = process.env.OWNER_EMAIL_CC?.trim()

const ownerRecipients = OWNER_EMAIL_CC ? [OWNER_EMAIL, OWNER_EMAIL_CC] : [OWNER_EMAIL]

// Maps the page's source_tag onto a clean vertical. Historic rows stored the raw tag
// (e.g. "369AS_ROOFING_INTAKE") in client_industry, which made the column useless for
// grouping — store the vertical instead.
const VERTICAL_BY_TAG: Record<string, string> = {
  '369AS_ROOFING_INTAKE':     'roofing',
  '369AS_HVAC_INTAKE':        'hvac',
  '369AS_PLUMBING_INTAKE':    'plumbing',
  '369AS_LEGAL_INTAKE':       'legal',
  '369AS_REAL_ESTATE_INTAKE': 'real-estate',
  '369AS_INSURANCE_INTAKE':   'insurance',
  '369AS_SAAS_INTAKE':        'saas',
  '369AS_DENTAL_INTAKE':      'dental',
  '369AS_WHOLESALE_INTAKE':   'wholesale',
}

function verticalFrom(sourceTag: string): string {
  if (VERTICAL_BY_TAG[sourceTag]) return VERTICAL_BY_TAG[sourceTag]
  // Tolerate an unknown or hand-edited tag rather than dropping the lead.
  const m = sourceTag.match(/^369AS_(.+)_INTAKE$/)
  return m ? m[1].toLowerCase().replace(/_/g, '-') : 'general'
}

// Existing rows use the literal 'no-domain-provided' when the prospect skipped the URL
// field; keep that so historic and new rows stay comparable.
function domainFrom(websiteContent: string): string {
  const raw = websiteContent.trim()
  if (!raw || raw.toLowerCase() === 'none') return 'no-domain-provided'
  try {
    return new URL(raw.match(/^https?:\/\//) ? raw : `https://${raw}`).hostname.replace(/^www\./, '')
  } catch {
    return raw.slice(0, 253)
  }
}

interface Lead {
  name: string; company: string; email: string
  website: string; area: string; pain: string
  vertical: string; receivedAt: string
}

/**
 * Emails the owner about an inbound lead, in one of two modes.
 *
 * Pass `dbFailure` and it becomes a failure alert instead of a notification. That
 * distinction is the whole point of this function: when the insert fails there is no row,
 * no retry and no second chance, so this email is the only surviving copy of the lead and
 * has to carry the full payload in a form the owner can act on by hand.
 *
 * Nine days of submissions were lost in 2026-07 because a failure on this path was visible
 * only in Vercel logs that nobody was reading. A 500 that reaches no human is the same as
 * a silent success — the defect was never the pipeline, it was the silence.
 *
 * `system_audits` has no column for company / pain / service area either, so the full
 * payload rides in this email in both modes until a proper intake table exists.
 *
 * Never throws: the caller's response must not depend on the mail provider.
 */
async function alertOwner(lead: Lead, dbFailure?: string): Promise<void> {
  const failed = dbFailure !== undefined
  const tag    = failed ? '✗ INTAKE FAILURE' : '⚠ Owner notify'

  if (!process.env.RESEND_API_KEY) {
    console.error(`[369 INTAKE] ${tag} — RESEND_API_KEY unset, owner NOT alerted`)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const accent = failed ? '#F87171' : '#D4AF37'

  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;font-size:11px;color:#475569;width:120px;">${label}</td>` +
    `<td style="padding:8px 0;font-size:13px;color:#FFFFFF;">${escapeHtml(value) || '—'}</td></tr>`

  const banner = failed
    ? `<div style="margin:0 0 20px;padding:14px 16px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);border-radius:6px;">
         <p style="margin:0 0 6px;font-size:13px;color:#FCA5A5;font-family:sans-serif;font-weight:600;">This lead was NOT saved to the database.</p>
         <p style="margin:0 0 6px;font-size:12px;color:#94A3B8;font-family:sans-serif;line-height:1.6;">This email is the only copy. Contact them directly and re-enter the record by hand — nothing will retry this.</p>
         <p style="margin:0;font-size:11px;color:#64748B;">Supabase said: ${escapeHtml(dbFailure!)}</p>
       </div>`
    : ''

  try {
    const { error } = await resend.emails.send({
      from:    resendFrom('369 Command Center'),
      replyTo: lead.email,
      to:      ownerRecipients,
      subject: failed
        ? `🚨 INTAKE FAILED — lead not saved — ${lead.company || lead.name || lead.email}`
        : `🔔 New ${lead.vertical} lead — ${lead.company || lead.name || lead.email}`,
      html: `
        <div style="background:#0A0A0A;padding:40px 24px;font-family:monospace;">
          <div style="max-width:560px;margin:0 auto;background:#0F0F0F;border:1px solid #1E1E1E;border-radius:8px;overflow:hidden;">
            <div style="height:3px;background:${accent};"></div>
            <div style="padding:28px;">
              <p style="margin:0 0 4px;font-size:10px;color:${accent};text-transform:uppercase;letter-spacing:0.2em;">// ${failed ? 'INTAKE FAILURE' : 'NEW INBOUND LEAD'}</p>
              <h2 style="margin:0 0 20px;font-size:20px;color:#FFFFFF;font-family:sans-serif;">${escapeHtml(lead.vertical)} intake</h2>
              ${banner}
              <table style="width:100%;border-collapse:collapse;">
                ${row('Name', lead.name)}
                ${row('Company', lead.company)}
                ${row('Email', lead.email)}
                ${row('Website', lead.website)}
                ${row('Service area', lead.area)}
                ${row('Pain point', lead.pain)}
              </table>
              <p style="margin:20px 0 0;font-size:11px;color:#334155;">${failed ? 'Submitted' : 'Captured'} ${escapeHtml(lead.receivedAt)}. Reply to this email to reach them directly.</p>
            </div>
          </div>
        </div>`,
    })
    // A failed alert about a failed capture means the lead is gone with nobody told —
    // log it at error level so it is at least findable, and distinguishable from the
    // routine notify warning.
    if (error) {
      if (failed) console.error(`[369 INTAKE] ✗✗ LEAD LOST — alert email also failed — ${lead.email} — ${error.message}`)
      else        console.warn(`[369 INTAKE] ⚠ Owner notify failed — ${error.message}`)
    }
  } catch (err) {
    if (failed) console.error(`[369 INTAKE] ✗✗ LEAD LOST — alert email threw — ${lead.email} —`, err)
    else        console.warn('[369 INTAKE] ⚠ Owner notify threw:', err)
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')

  const sourceTag = str('source_tag')
  const name      = str('client_name')
  const company   = str('client_company')
  const email     = str('client_email')
  const website   = str('website_content')
  const pain      = str('pain')
  const area      = str('industry_specific_field')

  // The email is what makes a lead actionable — without it there is nothing to follow up.
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const vertical   = verticalFrom(sourceTag)
  const domain     = domainFrom(website)
  const receivedAt = new Date().toISOString()

  // ── Capture first. Everything else is best-effort. ─────────────────────────
  const { error: dbError } = await supabaseAdmin
    .from('system_audits')
    .insert({
      client_domain:   domain,
      client_email:    email,
      client_name:     name || null,
      client_industry: vertical,
      payload_status:  'intake_received',
      created_at:      receivedAt,
    })

  const lead = { name, company, email, website, area, pain, vertical, receivedAt }

  if (dbError) {
    // The lead is not in the database and will not be retried — the page shows a fallback
    // and the prospect walks. The email below is the only remaining copy of it, so unlike
    // the success-path notification this one is not decorative: it IS the capture.
    console.error(`[369 INTAKE] ✗ Lead NOT captured — ${email} — ${dbError.message}`)
    await alertOwner(lead, dbError.message)
    // Report the failure so the page can show a real fallback instead of a fake success.
    return NextResponse.json({ error: 'Could not record submission' }, { status: 500 })
  }

  console.log(`[369 INTAKE] ✓ Lead captured — ${vertical} — ${email} — ${domain}`)

  // Best-effort: a mail failure must not lose a captured lead.
  await alertOwner(lead)

  // ── Optional enrichment hand-off. Dormant until GUMLOOP_WEBHOOK_URL is set, so this
  // ships without changing behaviour and without the API key living in public HTML.
  //
  // There is no callback receiver any more — `/api/update-dossier` was deleted as an
  // unauthenticated open relay — so enrichment is currently fire-and-forget. Whatever
  // replaces it needs its own authenticated callback route. ──
  const enrichUrl = process.env.GUMLOOP_WEBHOOK_URL
  if (enrichUrl) {
    try {
      const res = await fetch(enrichUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_tag: sourceTag,
          client_name: name,
          client_company: company,
          client_email: email,
          website_content: website,
          pain,
          industry_specific_field: area,
          timestamp: receivedAt,
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) console.warn(`[369 INTAKE] ⚠ Enrichment returned ${res.status}`)
    } catch (err) {
      // Never fails the request — the lead is already safe.
      console.warn('[369 INTAKE] ⚠ Enrichment hand-off failed:', err)
    }
  }

  return NextResponse.json({ success: true }, { status: 200 })
}

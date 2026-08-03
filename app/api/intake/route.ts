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
 * Enrichment (the AI "dossier") is explicitly best-effort and downstream. If Gumloop —
 * or whatever replaces it — is down, the lead is still captured and the owner is still
 * notified. Enrichment degrades; capture does not.
 *
 * Note this route emails the OWNER ONLY. `/api/update-dossier` mails the address in its
 * payload, which makes it usable as an open spam relay; keeping submitter mail out of
 * here means an attacker posting junk can only reach the owner's own inbox.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'

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

  if (dbError) {
    // Report the failure so the page can show a real fallback instead of a fake success.
    console.error(`[369 INTAKE] ✗ Lead NOT captured — ${email} — ${dbError.message}`)
    return NextResponse.json({ error: 'Could not record submission' }, { status: 500 })
  }

  console.log(`[369 INTAKE] ✓ Lead captured — ${vertical} — ${email} — ${domain}`)

  // ── Notify the owner. Best-effort: a mail failure must not lose a captured lead. ──
  // `system_audits` has no column for company / pain / service area, so the full
  // payload rides in this email until a proper intake table exists.
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const row = (label: string, value: string) =>
      `<tr><td style="padding:8px 0;font-size:11px;color:#475569;width:120px;">${label}</td>` +
      `<td style="padding:8px 0;font-size:13px;color:#FFFFFF;">${escapeHtml(value) || '—'}</td></tr>`

    try {
      const { error } = await resend.emails.send({
        from:    resendFrom('369 Command Center'),
        replyTo: email,
        to:      OWNER_EMAIL,
        subject: `🔔 New ${vertical} lead — ${company || name || email}`,
        html: `
          <div style="background:#0A0A0A;padding:40px 24px;font-family:monospace;">
            <div style="max-width:560px;margin:0 auto;background:#0F0F0F;border:1px solid #1E1E1E;border-radius:8px;overflow:hidden;">
              <div style="height:3px;background:#D4AF37;"></div>
              <div style="padding:28px;">
                <p style="margin:0 0 4px;font-size:10px;color:#D4AF37;text-transform:uppercase;letter-spacing:0.2em;">// NEW INBOUND LEAD</p>
                <h2 style="margin:0 0 20px;font-size:20px;color:#FFFFFF;font-family:sans-serif;">${escapeHtml(vertical)} intake</h2>
                <table style="width:100%;border-collapse:collapse;">
                  ${row('Name', name)}
                  ${row('Company', company)}
                  ${row('Email', email)}
                  ${row('Website', website)}
                  ${row('Service area', area)}
                  ${row('Pain point', pain)}
                </table>
                <p style="margin:20px 0 0;font-size:11px;color:#334155;">Captured ${escapeHtml(receivedAt)}. Reply to this email to reach them directly.</p>
              </div>
            </div>
          </div>`,
      })
      if (error) console.warn(`[369 INTAKE] ⚠ Owner notify failed — ${error.message}`)
    } catch (err) {
      console.warn('[369 INTAKE] ⚠ Owner notify threw:', err)
    }
  } else {
    console.warn('[369 INTAKE] ⚠ RESEND_API_KEY unset — owner not notified')
  }

  // ── Optional enrichment hand-off. Dormant until GUMLOOP_WEBHOOK_URL is set, so this
  // ships without changing behaviour and without the API key living in public HTML. ──
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

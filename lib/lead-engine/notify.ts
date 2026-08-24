/**
 * Telling a business a lead just came in.
 *
 * The single most important line in `lead_engine_submissions`' own migration comment: a
 * notification failure that reaches no human is indistinguishable from a lost lead — nine days of
 * `/api/intake` submissions vanished in 2026-07 exactly that way, and the defect was never the
 * pipeline, it was the silence. This never throws; the caller always records `notify_error` on
 * failure so the submission itself is never the thing that goes quiet.
 */

import { Resend } from 'resend'
import { escapeHtml } from '@/lib/security/sanitize'
import { resendFrom } from '@/lib/email-from'
import type { LeadEngineSite } from '@/lib/lead-engine/types'

export interface SubmissionForNotify {
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  serviceInterest: string | null
}

export type NotifyResult = { ok: true } | { ok: false; error: string }

/**
 * `notify_email` first, falling back to the account owner. Set at questionnaire time — "where
 * should new lead notifications go?" — precisely because the person who pays is often not the
 * person who chases leads, and sending to the billing address loses the lead quietly just as
 * surely as sending nowhere at all.
 */
function recipientFor(site: Pick<LeadEngineSite, 'notify_email'> & { owner_email?: string | null }): string | null {
  return site.notify_email?.trim() || site.owner_email?.trim() || null
}

export async function notifyOwnerOfSubmission(
  site: Pick<LeadEngineSite, 'business_name' | 'notify_email' | 'slug'> & { owner_email?: string | null },
  submission: SubmissionForNotify,
): Promise<NotifyResult> {
  const to = recipientFor(site)
  if (!to) return { ok: false, error: 'No notify_email or owner_email on this site' }

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY unset' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const row = (label: string, value: string | null) =>
    value
      ? `<tr><td style="padding:6px 0;font-size:12px;color:#64748B;width:110px;vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;font-size:14px;color:#E2E8F0;">${escapeHtml(value)}</td></tr>`
      : ''

  try {
    const { error } = await resend.emails.send({
      from:    resendFrom(site.business_name),
      to,
      replyTo: submission.email || undefined,
      subject: `New lead from your site — ${submission.name || 'someone just submitted your form'}`,
      html: `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Inter,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D4AF37;font-family:monospace;">${escapeHtml(site.business_name)}</p>
  <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">New lead from your website</h1>

  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px 20px;margin:0 0 24px;">
    <table style="width:100%;border-collapse:collapse;">
      ${row('Name', submission.name)}${row('Phone', submission.phone)}${row('Email', submission.email)}
      ${row('Interested in', submission.serviceInterest)}
    </table>
    ${submission.message ? `<p style="margin:12px 0 0;font-size:13px;color:#94A3B8;line-height:1.6;border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;">${escapeHtml(submission.message)}</p>` : ''}
  </div>

  <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
    They submitted the lead form on your site.
    ${submission.email ? 'Reply to this email to write straight back to them.' : ''}
  </p>
</div></body></html>`,
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

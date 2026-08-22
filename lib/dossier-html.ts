/**
 * Renders a built dossier as an email. Step 4's other half.
 *
 * Deliberately separate from `lib/dossier.ts`: that module decides *what may be said*, this one
 * only decides how it looks. Keeping them apart is what lets every truthfulness rule be tested
 * without parsing markup — and it means a styling change can never quietly alter a claim.
 *
 * Email HTML, not web HTML: tables for layout, inline styles only, no external assets, no
 * JavaScript. Gmail strips `<style>` blocks and most clients ignore flexbox.
 *
 * Everything interpolated goes through `escapeHtml`. The prospect's own company name and service
 * area are reflected back in this document, and they are strings a stranger typed into a public
 * form.
 */

import { escapeHtml } from '@/lib/security/sanitize'
import type { Block, Dossier, Section } from '@/lib/dossier'

const GOLD = '#D4AF37'
const INK = '#0A0A0A'
const BODY = '#CBD5E1'
const HEAD = '#FFFFFF'
const MUTED = '#64748B'
const RULE = 'rgba(255,255,255,0.08)'

const p = (text: string, size = 15) =>
  `<p style="margin:0 0 14px;font-size:${size}px;color:${BODY};line-height:1.7;">${escapeHtml(text)}</p>`

function renderBlock(block: Block): string {
  switch (block.kind) {
    case 'paragraph':
      return p(block.text)

    case 'list':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 14px;">` +
        block.items.map(item =>
          `<tr>` +
          `<td style="padding:0 10px 8px 0;vertical-align:top;font-size:15px;color:${GOLD};line-height:1.7;">&bull;</td>` +
          `<td style="padding:0 0 8px;font-size:15px;color:${BODY};line-height:1.7;">${escapeHtml(item)}</td>` +
          `</tr>`).join('') +
        `</table>`
      )

    case 'facts':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;">` +
        block.rows.map(r =>
          `<tr>` +
          `<td style="padding:6px 14px 6px 0;font-size:12px;color:${MUTED};white-space:nowrap;vertical-align:top;">${escapeHtml(r.label)}</td>` +
          `<td style="padding:6px 0;font-size:14px;color:#E2E8F0;">${escapeHtml(r.value)}</td>` +
          `</tr>`).join('') +
        `</table>`
      )

    case 'figure':
      // The one number in the document. It carries its assumption immediately beneath it, because
      // a figure that travels without its caveat is how a conservative estimate becomes a claim.
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 18px;">` +
        `<tr><td style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.25);border-radius:10px;padding:20px 22px;">` +
        `<p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};font-family:monospace;">${escapeHtml(block.label)}</p>` +
        `<p style="margin:0;font-size:34px;font-weight:700;color:${GOLD};line-height:1.1;letter-spacing:-0.02em;">${escapeHtml(block.value)}</p>` +
        (block.note
          ? `<p style="margin:12px 0 0;font-size:12px;color:${MUTED};line-height:1.6;">${escapeHtml(block.note)}</p>`
          : '') +
        `</td></tr></table>`
      )

    case 'actions':
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 0;">` +
        block.items.map(i => {
          const isUrl = /^https?:\/\//.test(i.detail)
          const detail = isUrl
            ? `<a href="${escapeHtml(i.detail)}" style="color:${GOLD};">${escapeHtml(i.detail)}</a>`
            : escapeHtml(i.detail)
          return (
            `<tr><td style="padding:0 0 16px;">` +
            `<p style="margin:0 0 3px;font-size:15px;font-weight:600;color:${HEAD};line-height:1.5;">${escapeHtml(i.label)}</p>` +
            `<p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">${detail}</p>` +
            `</td></tr>`
          )
        }).join('') +
        `</table>`
      )
  }
}

function renderSection(section: Section, index: number): string {
  return (
    `<tr><td style="padding:26px 0 0;border-top:1px solid ${RULE};">` +
    `<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.2em;color:${MUTED};font-family:monospace;">` +
    `${String(index).padStart(2, '0')}</p>` +
    `<h2 style="margin:0 0 14px;font-size:19px;font-weight:700;color:${HEAD};letter-spacing:-0.01em;">${escapeHtml(section.title)}</h2>` +
    section.blocks.map(renderBlock).join('') +
    `</td></tr>`
  )
}

/** The subject line. Names the artifact rather than teasing it. */
export function dossierSubject(dossier: Dossier): string {
  return dossier.company
    ? `What we found when we called ${dossier.company}`
    : 'What we found when we called your line'
}

/**
 * Renders the whole email.
 *
 * The opening deliberately says what this is and how it was produced. A document that leads with
 * its method is harder to mistake for a mail-merge, and this one has an unusual claim to make —
 * that every line in it came from something we did, not something we assumed.
 */
export function renderDossierEmail(dossier: Dossier): string {
  const greeting = dossier.firstName ? `Hi ${escapeHtml(dossier.firstName)},` : 'Hi,'

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${INK};font-family:Inter,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${INK};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;text-align:left;">

  <tr><td style="padding:0 0 22px;">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD};font-family:monospace;">369 Agentic Systems</p>
    <h1 style="margin:0 0 18px;font-size:25px;font-weight:700;color:${HEAD};letter-spacing:-0.02em;line-height:1.25;">Your audit</h1>
    ${p(greeting.replace(/^Hi /, 'Hi ').replace(/,$/, ','))}
    ${p('You asked us to look at how your phone line handles a caller. We did three things: we read back what you told us, we rang your published number, and we read your homepage. Everything below is one of those three — there are no estimates in this document, and nothing has been scored.')}
  </td></tr>

  ${dossier.sections.map((s, i) => renderSection(s, i + 1)).join('')}

  <tr><td style="padding:26px 0 0;border-top:1px solid ${RULE};">
    <p style="margin:0;font-size:12px;color:#475569;line-height:1.7;">
      You are getting this because you asked for an audit on 369agenticsystems.com.
      Reply to this email and it reaches Chris directly.
    </p>
  </td></tr>

</table></td></tr></table></body></html>`
}

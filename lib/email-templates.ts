export interface DiagnosticAlertVars {
  client_name: string
  client_domain: string
  security_score: number | null
  seo_visibility: number | null
  revenue_leakage?: string
  booking_link?: string
  scan_date: string
}

export interface DossierVars {
  client_name: string
  client_domain: string
  onboarding_dossier_text: string
  booking_link?: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function diagnosticAlertHtml(v: DiagnosticAlertVars): string {
  const sec  = v.security_score ?? '—'
  const seo  = v.seo_visibility ?? '—'
  const rev  = v.revenue_leakage ?? 'Calculating…'
  const book = v.booking_link ?? '#'
  const name = v.client_name || 'Business Owner'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagnostic Alert — ${v.client_domain}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;">
<tr><td align="center" style="padding:40px 16px;">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#0F0F0F;border:1px solid #1E1E1E;border-radius:8px;overflow:hidden;">

<tr><td height="3" style="background:#D4AF37;font-size:0;line-height:0;">&nbsp;</td></tr>

<tr><td style="padding:32px 36px 20px;">
  <p style="margin:0 0 4px;font-size:10px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.2em;">// AUTONOMOUS DIAGNOSTIC ALERT</p>
  <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">System Scan Complete</h1>
  <p style="margin:0;font-size:12px;font-family:monospace;color:#475569;">${v.client_domain} &nbsp;·&nbsp; ${v.scan_date}</p>
</td></tr>

<tr><td style="padding:0 36px 24px;">
  <p style="margin:0;font-size:14px;color:#94A3B8;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Hi ${name},<br><br>Our autonomous intelligence system has completed a full-spectrum audit of your digital infrastructure. The readings below represent live operational data captured from your environment.</p>
</td></tr>

<tr><td style="padding:0 36px 28px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>

  <td style="width:31%;background:#141414;border:1px solid #222;border-top:2px solid #EF4444;border-radius:6px;padding:16px 10px;text-align:center;vertical-align:top;">
    <p style="margin:0 0 8px;font-size:9px;font-family:monospace;color:#94A3B8;text-transform:uppercase;letter-spacing:0.12em;">Security</p>
    <p style="margin:0;font-size:30px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;line-height:1;">${sec}</p>
    <p style="margin:6px 0 0;font-size:9px;font-family:monospace;color:#EF4444;">/100</p>
  </td>

  <td width="3%">&nbsp;</td>

  <td style="width:31%;background:#141414;border:1px solid #222;border-top:2px solid #D4AF37;border-radius:6px;padding:16px 10px;text-align:center;vertical-align:top;">
    <p style="margin:0 0 8px;font-size:9px;font-family:monospace;color:#94A3B8;text-transform:uppercase;letter-spacing:0.12em;">SEO Visibility</p>
    <p style="margin:0;font-size:30px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;line-height:1;">${seo}</p>
    <p style="margin:6px 0 0;font-size:9px;font-family:monospace;color:#D4AF37;">/100</p>
  </td>

  <td width="3%">&nbsp;</td>

  <td style="width:31%;background:#141414;border:1px solid #222;border-top:2px solid #D4AF37;border-radius:6px;padding:16px 10px;text-align:center;vertical-align:top;">
    <p style="margin:0 0 8px;font-size:9px;font-family:monospace;color:#94A3B8;text-transform:uppercase;letter-spacing:0.12em;">Revenue Leak</p>
    <p style="margin:0;font-size:24px;font-weight:700;color:#D4AF37;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;line-height:1;">${rev}</p>
    <p style="margin:6px 0 0;font-size:9px;font-family:monospace;color:#D4AF37;">/mo est.</p>
  </td>

</tr></table>
</td></tr>

<tr><td style="padding:0 36px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" style="background:#1E1E1E;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>

<tr><td style="padding:0 36px 28px;">
  <p style="margin:0 0 14px;font-size:14px;color:#CBD5E1;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">These vulnerabilities are currently active in your environment. Our autonomous patch system can seal the security gap, recover estimated revenue leakage, and boost your search presence — all without disrupting your operations.</p>
  <p style="margin:0;font-size:14px;color:#CBD5E1;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">A full operational dossier for <strong style="color:#FFFFFF;">${v.client_domain}</strong> is landing in your inbox shortly. In the meantime, book a direct call with a specialist:</p>
</td></tr>

<tr><td style="padding:0 36px 36px;text-align:center;">
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${book}" style="height:50px;v-text-anchor:middle;width:300px;" arcsize="4%" stroke="f" fillcolor="#D4AF37"><w:anchorlock/><center style="color:#080808;font-family:sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">SCHEDULE DIAGNOSTIC CALL →</center></v:roundrect><![endif]-->
  <!--[if !mso]><!-->
  <a href="${book}" style="display:inline-block;background:#D4AF37;color:#080808;font-family:monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;padding:15px 32px;border-radius:4px;">SCHEDULE DIAGNOSTIC CALL →</a>
  <!--<![endif]-->
</td></tr>

<tr><td style="padding:20px 36px;border-top:1px solid #1A1A1A;text-align:center;">
  <p style="margin:0;font-size:11px;font-family:monospace;color:#334155;line-height:1.6;">369 Agentic Systems · Autonomous Operations Division<br>
  <a href="mailto:intelligence@369agenticsystems.com" style="color:#475569;text-decoration:none;">intelligence@369agenticsystems.com</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

export function dossierHtml(v: DossierVars): string {
  const name = v.client_name || 'Business Owner'
  const book = v.booking_link ?? '#'

  // Normalize input to string regardless of what Gumloop sends
  const rawText = typeof v.onboarding_dossier_text === 'string'
    ? v.onboarding_dossier_text
    : typeof v.onboarding_dossier_text === 'object' && v.onboarding_dossier_text !== null
      ? JSON.stringify(v.onboarding_dossier_text, null, 2)
      : String(v.onboarding_dossier_text || '')

  // Convert plain text → styled HTML paragraphs and headers
  // escapeHtml prevents Gumloop text with <, >, & from malforming the email
  const bodyHtml = rawText
    .split(/\n{2,}/)
    .map(para => para.trim())
    .filter(Boolean)
    .map(para => {
      if (para.startsWith('# ')) {
        return `<h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#D4AF37;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(para.slice(2))}</h2>`
      }
      if (para.startsWith('## ')) {
        return `<h3 style="margin:0 0 8px;font-size:12px;font-weight:700;color:#94A3B8;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(para.slice(3))}</h3>`
      }
      return `<p style="margin:0 0 16px;font-size:14px;color:#CBD5E1;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Operations Dossier — ${v.client_domain}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#0F0F0F;border:1px solid #1E1E1E;border-radius:8px;overflow:hidden;">

<tr><td height="3" style="background:#D4AF37;font-size:0;line-height:0;">&nbsp;</td></tr>

<tr><td style="padding:32px 36px 20px;">
  <p style="margin:0 0 4px;font-size:10px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.2em;">// OPERATIONAL INTELLIGENCE DOSSIER</p>
  <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Full Operational Briefing</h1>
  <p style="margin:0;font-size:12px;font-family:monospace;color:#475569;">${v.client_domain}</p>
</td></tr>

<tr><td style="padding:0 36px 24px;">
  <p style="margin:0;font-size:14px;color:#94A3B8;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Hi ${name}, as promised — here is your complete intelligence dossier. Our autonomous agents have compiled a full operational profile for <strong style="color:#FFFFFF;">${v.client_domain}</strong> outlining vulnerabilities, recovery pathways, and projected ROI timelines.</p>
</td></tr>

<tr><td style="padding:0 36px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" style="background:#1E1E1E;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>

<tr><td style="padding:0 36px 28px;">
${bodyHtml}
</td></tr>

<tr><td style="padding:0 36px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" style="background:#1E1E1E;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>

<tr><td style="padding:0 36px 28px;">
  <p style="margin:0;font-size:14px;color:#94A3B8;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Ready to activate your digital workforce? Book a 30-minute deep-dive to walk through your dossier and authorize the first agent deployment.</p>
</td></tr>

<tr><td style="padding:0 36px 36px;text-align:center;">
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${book}" style="height:50px;v-text-anchor:middle;width:300px;" arcsize="4%" stroke="f" fillcolor="#D4AF37"><w:anchorlock/><center style="color:#080808;font-family:sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">BOOK YOUR DOSSIER REVIEW →</center></v:roundrect><![endif]-->
  <!--[if !mso]><!-->
  <a href="${book}" style="display:inline-block;background:#D4AF37;color:#080808;font-family:monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;padding:15px 32px;border-radius:4px;">BOOK YOUR DOSSIER REVIEW →</a>
  <!--<![endif]-->
</td></tr>

<tr><td style="padding:20px 36px;border-top:1px solid #1A1A1A;text-align:center;">
  <p style="margin:0;font-size:11px;font-family:monospace;color:#334155;line-height:1.6;">369 Agentic Systems · Autonomous Operations Division<br>
  <a href="mailto:intelligence@369agenticsystems.com" style="color:#475569;text-decoration:none;">intelligence@369agenticsystems.com</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

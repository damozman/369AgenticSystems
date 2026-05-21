export function dossierHtml(v: DossierVars): string {
  const name  = v.client_name || 'Business Owner'
  const book  = v.booking_link ?? '#'

  // Safeguard: Ensure the data type is strictly a string before trying to split it
  const rawText = typeof v.onboarding_dossier_text === 'string'
    ? v.onboarding_dossier_text
    : typeof v.onboarding_dossier_text === 'object' && v.onboarding_dossier_text !== null
      ? JSON.stringify(v.onboarding_dossier_text, null, 2)
      : String(v.onboarding_dossier_text || '');

  // Convert plain text → styled HTML paragraphs and headers
  const bodyHtml = rawText
    .split(/\n{2,}/)
    .map(para => para.trim())
    .filter(Boolean)
    .map(para => {
      if (para.startsWith('# ')) {
        return `<h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#D4AF37;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">${para.slice(2)}</h2>`
      }
      if (para.startsWith('## ')) {
        return `<h3 style="margin:0 0 8px;font-size:12px;font-weight:700;color:#94A3B8;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;">${para.slice(3)}</h3>`
      }
      return `<p style="margin:0 0 16px;font-size:14px;color:#CBD5E1;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${para.replace(/\n/g, '<br>')}</p>`
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
  <a href="${book}" style="display:inline-block;background:#D4AF37;color:#080808;font-family:monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;padding:15px 32px;border-radius:4px;">BOOK YOUR DOSSIER REVIEW →</a>
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
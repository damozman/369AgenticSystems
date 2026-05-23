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

export function diagnosticAlertHtml(v: DiagnosticAlertVars): string {
  const sec     = v.security_score ?? '—'
  const seo     = v.seo_visibility ?? '—'
  const rev     = v.revenue_leakage ?? 'Calculating…'
  const book    = v.booking_link ?? '#'
  const name    = v.client_name || 'Business Owner'

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
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1; " style="background:#1E1E1E;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>

<tr><td style="padding:0 36px 28px;">
  <p style="margin:0 0 14px;font-size:14px;color:#CBD5E1;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">These vulnerabilities are currently active in your environment. Our autonomous patch system can seal the security gap, recover estimated revenue leakage, and boost your search presence — all without disrupting your operations.</p>
  <p style="margin:0;font-size:14px;color:#CBD5E1;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">A full operational dossier for <strong style="color:#FFFFFF;">${v.client_domain}</strong> is landing in your inbox shortly. In the meantime, book a direct call with a specialist:</p>
</td></tr>

<tr><td style="padding:0 36px 36px;text-align:center;">
  <a href="${book}" style="display:inline-block;background:#D4AF37;color:#080808;font-family:monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;padding:15px 32px;border-radius:4px;">SCHEDULE DIAGNOSTIC CALL →</a>
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

  const rawText = typeof v.onboarding_dossier_text === 'string'
    ? v.onboarding_dossier_text
    : String(v.onboarding_dossier_text || '');

  // Define the exact triggers that should trigger a visual section box
  const sectionHeaders = [
    'INTELLIGENCE FINDINGS', 
    'YOUR DIGITAL EMPLOYEE DEPLOYMENT PLAN', 
    'PROJECTED 90-DAY IMPACT', 
    'ANNUAL RUN-RATE ESTIMATE'
  ];

  let currentListItems: string[] = [];
  const processedBlocks: string[] = [];

  const flushList = () => {
    if (currentListItems.length > 0) {
      const formattedItems = currentListItems
        .map(item => `<li style="color:#FFFFFF; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:14px; line-height:1.65; margin:10px 0;">${item}</li>`)
        .join('\n');
      processedBlocks.push(`<ul style="color:#FFFFFF; margin:12px 0 20px; padding-left:20px; list-style-type:disc;">${formattedItems}</ul>`);
      currentListItems = [];
    }
  };

  rawText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect if this line is one of our "Section" headers
    if (sectionHeaders.some(h => trimmed.toUpperCase().includes(h))) {
      flushList();
      processedBlocks.push(`<h3 style="color:#D4AF37; font-family:monospace; font-size:12px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; margin-top:28px; margin-bottom:12px;">// ${trimmed}</h3>`);
    } else if (trimmed.startsWith('*') || trimmed.startsWith('•') || trimmed.startsWith('-')) {
      let cleanItem = trimmed.replace(/^[*•-]\s?/, '').trim();
      // Handle bold prefixes
      if (cleanItem.includes(':')) {
        const [title, body] = cleanItem.split(/:(.*)/s);
        cleanItem = `<strong style="color:#FFFFFF;">${title.trim()}:</strong>${body}`;
      }
      currentListItems.push(cleanItem);
    } else {
      flushList();
      processedBlocks.push(`<p style="color:#D1D5DB; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:14px; line-height:1.75; margin:0 0 16px;">${trimmed}</p>`);
    }
  });

  flushList();
  const content = processedBlocks.join('\n');

  // Return the full original layout frame
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#0D0D0D;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0D0D0D;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="max-width:600px;width:100%;background-color:#111111;border-radius:16px;border:1px solid rgba(212,175,55,0.25);overflow:hidden;">
        <tr><td style="background:linear-gradient(160deg,#110E00,#0A0A14);padding:40px;">
          <h1 style="color:#FFFFFF; margin:0 0 10px;">Hello, ${name}.</h1>
          <p style="color:#9CA3AF;">Your operational briefing is ready.</p>
        </td></tr>
        <tr><td style="padding:0 40px 40px;">
          ${content}
        </td></tr>
        <tr><td style="padding:40px; text-align:center; background:#111;">
          <a href="${book}" style="background:#D4AF37; color:#000; padding:15px 30px; text-decoration:none; font-weight:bold; border-radius:8px;">BOOK YOUR STRATEGY CALL →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
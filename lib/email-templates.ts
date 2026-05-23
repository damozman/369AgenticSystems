import { marked } from 'marked';

// Configure marked to ensure structure is preserved
marked.setOptions({
  breaks: true,
  gfm: true
});

export interface DiagnosticAlertVars {
  client_name: string;
  client_domain: string;
  security_score: number | null;
  seo_visibility: number | null;
  revenue_leakage?: string;
  booking_link?: string;
  scan_date: string;
}

export interface DossierVars {
  client_name: string;
  client_domain: string;
  onboarding_dossier_text: string;
  booking_link?: string;
}

export function diagnosticAlertHtml(v: DiagnosticAlertVars): string {
  const sec = v.security_score ?? '—';
  const seo = v.seo_visibility ?? '—';
  const rev = v.revenue_leakage ?? 'Calculating…';
  const book = v.booking_link ?? '#';
  const name = v.client_name || 'Business Owner';

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#0A0A0A;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;">
<tr><td align="center" style="padding:40px 16px;">
<table width="580" style="max-width:580px;width:100%;background:#0F0F0F;border:1px solid #1E1E1E;border-radius:8px;">
<tr><td height="3" style="background:#D4AF37;"></td></tr>
<tr><td style="padding:32px 36px;">
  <h1 style="color:#FFFFFF; font-family:sans-serif;">System Scan Complete</h1>
  <p style="color:#94A3B8;">Hi ${name}, your audit is ready.</p>
</td></tr>
<tr><td style="padding:0 36px 36px; text-align:center;">
  <a href="${book}" style="background:#D4AF37; color:#000; padding:15px 32px; text-decoration:none; font-weight:bold; border-radius:4px; font-family:sans-serif;">SCHEDULE CALL →</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function dossierHtml(v: DossierVars): string {
  const name = v.client_name || 'Business Owner';
  const book = v.booking_link ?? '#';
  
  // Use marked to convert all text to HTML
  const htmlBody = marked.parse(v.onboarding_dossier_text || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { margin:0; padding:0; background-color:#0D0D0D; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; }
    .email-container { max-width:600px; width:100%; background-color:#111111; border-radius:16px; border:1px solid rgba(212,175,55,0.25); overflow:hidden; }
    .header-bg { background:linear-gradient(160deg,#110E00,#0D0D0D,#0A0A14); padding:40px; border-bottom:1px solid rgba(212,175,55,0.18); }
    h1 { margin:0 0 10px; font-size:26px; color:#FFFFFF; }
    h2, h3 { color:#D4AF37 !important; font-family:monospace !important; text-transform:uppercase !important; margin:24px 0 12px !important; font-size:16px !important; }
    p { color:#FFFFFF !important; font-size:14px !important; line-height:1.75 !important; margin:0 0 16px !important; }
    ul { padding-left:20px !important; margin:12px 0 20px !important; }
    li { color:#CBD5E1 !important; font-size:14px !important; line-height:1.65 !important; margin:8px 0 !important; }
    strong { color:#FFFFFF !important; font-weight:bold; }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0D0D0D;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0">
        <tr><td class="header-bg">
          <h1>Hello, ${name}.</h1>
          <p style="color:#94A3B8;">Your operational briefing is ready.</p>
        </td></tr>
        <tr><td style="padding:40px;">
          ${htmlBody}
        </td></tr>
        <tr><td style="padding:0 40px 40px; text-align:center;">
          <a href="${book}" style="display:inline-block; background:linear-gradient(135deg,#D4AF37,#E8C84A); padding:15px 30px; color:#000; text-decoration:none; font-weight:bold; border-radius:8px; font-family:sans-serif;">BOOK YOUR STRATEGY CALL →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
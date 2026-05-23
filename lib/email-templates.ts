import { marked } from 'marked';

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

// Keep your existing diagnosticAlertHtml here
export function diagnosticAlertHtml(v: DiagnosticAlertVars): string {
  // ... (use the verified diagnosticAlertHtml from previous step)
  return ``;
}

export function dossierHtml(v: DossierVars): string {
  const name = v.client_name || 'Business Owner';
  const book = v.booking_link ?? '#';
  
  // Use marked to convert all text to HTML
  const htmlBody = marked.parse(v.onboarding_dossier_text || '');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background-color:#0D0D0D; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; }
    .email-container { max-width:600px; width:100%; background-color:#111111; border-radius:16px; overflow:hidden; border:1px solid rgba(212,175,55,0.25); }
    h2 { color:#D4AF37; font-family:monospace; font-size:18px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin:24px 0 12px; }
    h3 { color:#D4AF37; font-family:monospace; font-size:14px; font-weight:700; text-transform:uppercase; margin-top:28px; margin-bottom:12px; }
    p { color:#CBD5E1; font-size:14px; line-height:1.75; margin:0 0 16px; }
    ul { padding-left:20px; margin:12px 0 20px; }
    li { color:#FFFFFF; font-size:14px; line-height:1.65; margin:10px 0; }
    strong { color:#FFFFFF; }
    @media only screen and (max-width:600px) { .email-container { border-radius:0 !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0D0D0D;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0">
        <tr><td style="background:linear-gradient(160deg,#110E00,#0D0D0D,#0A0A14);padding:40px;border-bottom:1px solid rgba(212,175,55,0.18);">
          <h1 style="margin:0 0 8px;font-size:26px;color:#FFFFFF;">Hello, ${name}.</h1>
          <p style="margin:0;font-size:14px;color:#94A3B8;">Your Digital Employee operational briefing.</p>
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
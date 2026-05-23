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
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#0A0A0A;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;">
<tr><td align="center" style="padding:40px 16px;">
<table width="580" style="max-width:580px;width:100%;background:#0F0F0F;border:1px solid #1E1E1E;border-radius:8px;">
<tr><td height="3" style="background:#D4AF37;"></td></tr>
<tr><td style="padding:32px 36px;">
  <h1 style="color:#FFFFFF; font-family:sans-serif;">System Scan Complete</h1>
  <p style="color:#94A3B8;">Hi ${v.client_name}, your audit is ready.</p>
</td></tr>
<tr><td style="padding:0 36px 36px; text-align:center;">
  <a href="${v.booking_link || '#'}" style="background:#D4AF37; color:#000; padding:15px 32px; text-decoration:none; font-weight:bold; border-radius:4px; font-family:sans-serif;">SCHEDULE CALL →</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function dossierHtml(v: DossierVars): string {
  // Pure passthrough: The HTML is already assembled by Gumloop
  return v.onboarding_dossier_text;
}
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

// Minimal diagnostic alert
export function diagnosticAlertHtml(v: DiagnosticAlertVars): string {
  return `<!DOCTYPE html><html lang="en"><body style="background:#0A0A0A; padding:40px; font-family:sans-serif; text-align:center;"><table style="max-width:580px; margin:auto; background:#0F0F0F; color:#FFF; border:1px solid #1E1E1E; border-radius:8px; padding:40px;"><tr><td><h1>Scan Complete</h1><p>Client: ${v.client_domain}</p><a href="${v.booking_link || '#'}" style="background:#D4AF37; padding:15px 30px; text-decoration:none; color:#000; font-weight:bold; border-radius:4px;">SCHEDULE CALL</a></td></tr></table></body></html>`;
}

// Passthrough dossier: Gumloop provides the full HTML design
export function dossierHtml(v: DossierVars): string {
  return v.onboarding_dossier_text;
}
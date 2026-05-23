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
  onboarding_dossier_text: string; // This will hold the FULL raw HTML from Gumloop
  booking_link?: string;
}

export function diagnosticAlertHtml(v: DiagnosticAlertVars): string {
  // Use a simple, clean diagnostic template
  return ``;
}

export function dossierHtml(v: DossierVars): string {
  // We are NOT parsing or splitting here.
  // We are simply injecting the PRE-FORMATTED HTML string coming from Gumloop.
  return v.onboarding_dossier_text;
}
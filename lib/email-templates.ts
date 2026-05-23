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
  // We simply return the raw HTML string provided by the Gumloop AI.
  // The styling, gold gradients, and structure are already baked into this string.
  return v.onboarding_dossier_text;
}
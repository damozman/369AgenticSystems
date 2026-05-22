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
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" style="background:#1E1E1E;font-size:0;line-height:0;">&nbsp;</td></tr></table>
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
  const name  = v.client_name || 'Business Owner'
  const book  = v.booking_link ?? '#'

  // Ensure content context string coercion holds safely
  const rawText = typeof v.onboarding_dossier_text === 'string'
    ? v.onboarding_dossier_text
    : typeof v.onboarding_dossier_text === 'object' && v.onboarding_dossier_text !== null
      ? JSON.stringify(v.onboarding_dossier_text, null, 2)
      : String(v.onboarding_dossier_text || '');

  // ── High-Fidelity Paragraph, Header, and Native List Parser ────────────────
  // Parses markdown and splits everything down cleanly into structured elements
  const bodyHtml = rawText
    .split(/\n{2,}/)
    .map(para => para.trim())
    .filter(Boolean)
    .map(para => {
      // Handle Primary Document Headings
      if (para.startsWith('# ')) {
        return `<h2 style="color:#D4AF37; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-top:24px; margin-bottom:12px;">${para.slice(2)}</h2>`
      }
      // Handle Component Layout Subheadings (e.g., INTELLIGENCE FINDINGS)
      if (para.startsWith('## ') || para.startsWith('### ')) {
        const cleanSub = para.replace(/^#{2,3}\s?/, '').trim()
        return `<h3 style="color:#D4AF37; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; letter-spacing:1px; text-transform:uppercase; margin-top:28px; margin-bottom:12px;">${cleanSub}</h3>`
      }
      // Handle Bulleted Text Stacks programmatically
      if (para.startsWith('* ') || para.startsWith('• ') || para.startsWith('- ')) {
        const listItems = para
          .split(/\n[*•-]\s?/)
          .map(item => item.replace(/^[*•-]\s?/, '').trim())
          .filter(Boolean)
          .map(item => `<li style="color:#FFFFFF; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:14px; line-height:1.6; margin:8px 0;">${item}</li>`)
          .join('\n')
        return `<ul style="color:#FFFFFF; margin:6px 0; padding-left:20px; list-style-type:disc;">${listItems}</ul>`
      }
      
      // Standalone sentences get wrapped as pristine paragraph layout sections
      return `<p style="color:#FFFFFF; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:14px; line-height:1.65; margin:0 0 16px;">${para}</p>`
    })
    .join('\n')

  // Exact replication from the shared production .eml source asset mapping file blueprint
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your 3six9 Agentic Systems Onboarding Dossier</title>
  <style>
    @media only screen and (max-width:600px) {
      .email-container { width:100% !important; border-radius:0 !important; }
      .pad-mobile { padding-left:24px !important; padding-right:24px !important; }
      .hero-title { font-size:22px !important; }
      .section-h2 { font-size:17px !important; }
      .cta-btn { padding:13px 24px !important; font-size:13px !important; }
      .footer-split td { display:block !important; width:100% !important; text-align:left !important; }
      .footer-split td:last-child { padding-top:8px !important; text-align:left !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0D0D0D;line-height:1px;">
    Your Digital Employee has completed its analysis. Here is your full Onboarding Dossier from 3six9 Agentic Systems.
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0D0D0D;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        
        <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#111111;border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,0.25);">
          
          <tr>
            <td style="background:linear-gradient(160deg,#110E00 0%,#0D0D0D 55%,#0A0A14 100%);padding:36px 48px 28px;border-bottom:1px solid rgba(212,175,55,0.18);">
              <table role="presentation" class="pad-mobile" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background:linear-gradient(135deg,#D4AF37,#E8C84A);border-radius:9px;padding:2px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="background:#0D0D0D;border-radius:8px;padding:7px 16px;">
                                <span style="font-size:20px;font-weight:800;letter-spacing:0.08em;color:#D4AF37;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">3six9</span> 
                                <span style="font-size:10px;font-weight:500;letter-spacing:0.22em;color:#888;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">AGENTIC SYSTEMS</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:14px 0 0;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#D4AF37;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">▪ ONBOARDING DOSSIER ▪ CONFIDENTIAL</p>
                  </td>
                  <td align="right" style="vertical-align:bottom;">
                    <p style="margin:0;font-size:10px;color:#3A3A3A;font-family:'Courier New',Courier,monospace;letter-spacing:0.05em;">SECURE TRANSMISSION</p>
                    <p style="margin:5px 0 0;font-size:10px;color:#3A3A3A;font-family:'Courier New',Courier,monospace;letter-spacing:0.05em;">3six9 CORE v2.0</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="pad-mobile" style="padding:44px 48px 0;">
              <h1 class="hero-title" style="margin:0 0 14px;font-size:30px;font-weight:800;line-height:1.25;color:#FFFFFF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-0.02em;">Hello, ${name}.</h1>
              <p style="margin:0;font-size:15px;line-height:1.75;color:#9CA3AF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Your Digital Employee has completed its initial intelligence pass. Below is your personalized Onboarding Dossier — a full operational brief prepared exclusively for your business by the 3six9 Agentic Core.</p>
            </td>
          </tr>

          <tr>
            <td class="pad-mobile" style="padding:32px 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="height:1px;background:linear-gradient(90deg,#D4AF37 0%,rgba(212,175,55,0.08) 100%);"></td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="pad-mobile" style="padding:0 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:rgba(212,175,55,0.12);border-left:3px solid #D4AF37;border-radius:0 5px 5px 0;padding:7px 16px;">
                    <span style="font-size:9px;font-weight:800;letter-spacing:0.28em;text-transform:uppercase;color:#D4AF37;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">SECTION 01 — AUTOMATED INTEL SUMMARY</span>
                  </td>
                </tr>
              </table>
              <h2 class="section-h2" style="margin:16px 0 14px;font-size:20px;font-weight:700;color:#FFFFFF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-0.01em;">Operational Dossier Analysis</h2>
              
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background:#181818;border:1px solid rgba(212,175,55,0.14);border-radius:12px;padding:28px;">
                    <div style="margin:0;font-size:14px;line-height:1.85;color:#D1D5DB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                      ${bodyHtml}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:40px;line-height:40px;">&nbsp;</td></tr>

          <tr>
            <td class="pad-mobile" style="padding:0 48px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background:linear-gradient(160deg,#110E00 0%,#0D0D14 100%);border:1px solid rgba(212,175,55,0.25);border-radius:14px;padding:36px 32px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:10px;font-weight:800;letter-spacing:0.28em;text-transform:uppercase;color:#D4AF37;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">NEXT STEP SYSTEM ACTIVATION</p>
                    <h3 style="margin:0 0 14px;font-size:22px;font-weight:800;color:#FFFFFF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-0.01em;">Ready to Deploy Your Digital Employee?</h3>
                    <p style="margin:0 0 26px;font-size:14px;line-height:1.7;color:#9CA3AF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Schedule your 30-minute strategy call. We will review this dossier together and configure your workforce for launch.</p>
                    
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="border-radius:8px;background:linear-gradient(135deg,#D4AF37 0%,#E8C84A 100%);">
                          <a class="cta-btn" href="${book}" target="_blank" style="display:inline-block;padding:15px 38px;color:#FFFFFF;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;border-radius:8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">BOOK YOUR STRATEGY CALL &nbsp;→</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:44px;line-height:44px;">&nbsp;</td></tr>

          <tr>
            <td style="background:#0A0A0A;border-top:1px solid rgba(255,255,255,0.05);padding:30px 48px;">
              <table role="presentation" class="footer-split" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:top;">
                    <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#FFFFFF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">3six9 Agentic Systems</p>
                    <p style="margin:0;font-size:11px;color:#555;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">AI Workforce Infrastructure</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <p style="margin:0;font-size:10px;color:#3A3A3A;font-family:'Courier New',Courier,monospace;letter-spacing:0.05em;">DOSSIER-${name.replace(/\s+/g, '')}</p>
                    <p style="margin:5px 0 0;font-size:10px;color:#3A3A3A;font-family:'Courier New',Courier,monospace;letter-spacing:0.05em;">3six9 CORE ENCRYPTED</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:20px;">
                    <p style="margin:0;font-size:11px;line-height:1.65;color:#444;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">This dossier was compiled by your dedicated Digital Employee and contains proprietary analysis prepared exclusively for ${name}. If you received this in error, please disregard.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}
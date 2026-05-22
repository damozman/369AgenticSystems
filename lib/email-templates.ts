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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function dossierHtml(v: DossierVars): string {
  const name  = v.client_name || 'Business Owner'
  const book  = v.booking_link ?? '#'

  // Ensure text context is treated safely as a raw string
  const rawText = typeof v.onboarding_dossier_text === 'string'
    ? v.onboarding_dossier_text
    : typeof v.onboarding_dossier_text === 'object' && v.onboarding_dossier_text !== null
      ? JSON.stringify(v.onboarding_dossier_text, null, 2)
      : String(v.onboarding_dossier_text || '');

  // ── Smart Section Profiler ────────────────────────────────────────────────
  // Breaks the incoming stream into programmatic parts so we can inject layout hooks
  let introParagraphs = ''
  let intelligenceItems: string[] = []
  let deploymentItems: string[] = []

  const textBlocks = rawText.split(/\n+/).map(t => t.trim()).filter(Boolean)

  textBlocks.forEach(line => {
    // Is it a breakdown item or a standard sentence?
    if (line.startsWith('*') || line.startsWith('•') || line.startsWith('-')) {
      const cleanItem = line.replace(/^[*•-]\s?/, '').trim()
      
      // Route items to their proper visual bucket based on text markers
      if (cleanItem.toLowerCase().includes('specialist') || cleanItem.toLowerCase().includes('assistant') || cleanItem.toLowerCase().includes('coordinator')) {
        deploymentItems.push(cleanItem)
      } else {
        intelligenceItems.push(cleanItem)
      }
    } else if (!line.startsWith('#')) {
      // Collect baseline operational framing text (ignore raw markdown hash markers)
      if (!line.toLowerCase().includes('ready to activate') && !line.toLowerCase().includes('book a 30-minute')) {
        introParagraphs += `<p style="margin:0 0 16px;font-size:14px;color:#CBD5E1;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${line}</p>\n`
      }
    }
  })

  // Format Intelligence Findings Bullet Stack
  const intelligenceHtml = intelligenceItems.length > 0
    ? intelligenceItems.map(item => {
        // Bold the prefix if it contains a colon separator
        if (item.includes(':')) {
          const [title, body] = item.split(/:(.*)/s)
          return `<li style="margin-bottom:14px;color:#CBD5E1;line-height:1.75;font-size:14px;"><strong style="color:#FFFFFF;">${title.trim()}:</strong>${body}</li>`
        }
        return `<li style="margin-bottom:14px;color:#CBD5E1;line-height:1.75;font-size:14px;">${item}</li>`
      }).join('\n')
    : `<li style="color:#CBD5E1;font-size:14px;">Operational data compiled under active review.</li>`

  // Format Digital Employee Deployment Plan Stack
  const deploymentHtml = deploymentItems.length > 0
    ? deploymentItems.map(item => {
        if (item.includes('—') || item.includes('-')) {
          const splitter = item.includes('—') ? '—' : '-'
          const [role, duties] = item.split(new RegExp(`${splitter}(.*)`))
          return `<li style="margin-bottom:14px;color:#CBD5E1;line-height:1.75;font-size:14px;"><strong style="color:#FFFFFF;">${role.trim()}</strong> — ${duties.trim()}</li>`
        }
        return `<li style="margin-bottom:14px;color:#CBD5E1;line-height:1.75;font-size:14px;">${item}</li>`
      }).join('\n')
    : `<li style="margin-bottom:12px;color:#CBD5E1;line-height:1.7;font-size:14px;"><strong style="color:#FFFFFF;">Lead Response Specialist</strong> — Intercepts new website inquiries instantly to secure active opportunities.</li>
       <li style="margin-bottom:12px;color:#CBD5E1;line-height:1.7;font-size:14px;"><strong style="color:#FFFFFF;">Patient Intake Specialist</strong> — Gathers documentation pipelines autonomously ahead of appointments.</li>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Operations Dossier — ${v.client_domain}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;">
<tr><td align="center" style="padding:40px 16px;">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#0F0F0F;border:1px solid #1E1E1E;border-radius:8px;overflow:hidden;">

  <tr><td height="3" style="background:#D4AF37;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr><td style="padding:40px 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0" border="0" style="border:1px solid #D4AF37;border-radius:4px;margin-bottom:20px;">
            <tr><td style="padding:6px 12px;font-family:monospace;font-size:11px;font-weight:700;color:#D4AF37;letter-spacing:0.15em;text-transform:uppercase;">3six9 AGENTIC SYSTEMS</td></tr>
          </table>
          <p style="margin:0 0 4px;font-size:10px;font-family:monospace;color:#475569;text-transform:uppercase;letter-spacing:0.15em;">▪ ONBOARDING DOSSIER — CONFIDENTIAL</p>
          <h1 style="margin:0 0 4px;font-size:26px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:-0.02em;">Hello, ${name}.</h1>
          <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.6;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Your Digital Employee has completed its initial intelligence pass. Below is your personalized Onboarding Dossier — a full operational brief prepared exclusively for your business by the 3six9 Agentic Core.</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" style="background:#1E1E1E;font-size:0;line-height:0;">&nbsp;</td></tr></table>
  </td></tr>

  <tr><td style="padding:0 40px 24px;">
    <table cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #222;border-radius:4px;margin-bottom:16px;">
      <tr><td style="padding:4px 10px;font-family:monospace;font-size:9px;font-weight:700;color:#D4AF37;letter-spacing:0.1em;text-transform:uppercase;">SECTION 01 — OPERATIONAL AUDIT</td></tr>
    </table>
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Your Business Intelligence Report</h2>
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #1E1E1E;border-radius:6px;margin-bottom:20px;">
      <tr><td style="padding:24px 24px 8px;">
        ${introParagraphs}
        <h4 style="margin:24px 0 12px;font-size:12px;font-family:monospace;font-weight:700;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.05em;">INTELLIGENCE FINDINGS</h4>
        <ul style="margin:0 0 16px;padding-left:16px;color:#CBD5E1;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;list-style-type:square;">
          ${intelligenceHtml}
        </ul>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 40px 24px;">
    <h3 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#FFFFFF;font-family:monospace;text-transform:uppercase;letter-spacing:0.05em;">YOUR DIGITAL EMPLOYEE DEPLOYMENT PLAN</h3>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #1E1E1E;border-radius:6px;margin-bottom:12px;">
      <tr><td style="padding:24px 24px 8px;">
        <ul style="margin:0 0 16px;padding-left:16px;color:#CBD5E1;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;list-style-type:square;">
          ${deploymentHtml}
        </ul>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;font-style:italic;color:#94A3B8;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;line-height:1.6;text-align:center;">Every lead that waits for a response is actively searching for a competitor who will answer them faster.</p>
  </td></tr>

  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed #222;border-radius:6px;padding:20px;">
      <tr><td>
        <p style="margin:0 0 12px;font-size:11px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.08em;">YOUR DIGITAL EMPLOYEES ARE STANDING BY</p>
        <a href="${book}" style="display:inline-block;background:#0F0F0F;border:1px solid #222;color:#D4AF37;font-family:monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;padding:12px 24px;border-radius:4px;">DEPLOY YOUR SPECIALIST NOW →</a>
        </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 40px 36px;">
    <table cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #222;border-radius:4px;margin-bottom:16px;">
      <tr><td style="padding:4px 10px;font-family:monospace;font-size:9px;font-weight:700;color:#D4AF37;letter-spacing:0.1em;text-transform:uppercase;">SECTION 02 — ROI PROJECTION</td></tr>
    </table>
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Your Return on Investment</h2>
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #1E1E1E;border-radius:6px;">
      <tr><td style="padding:24px 24px 20px;">
        <h4 style="margin:0 0 12px;font-size:12px;font-family:monospace;font-weight:700;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.05em;">PROJECTED 90-DAY IMPACT</h4>
        <ul style="margin:0 0 24px;padding-left:16px;color:#CBD5E1;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;list-style-type:square;">
          <li style="margin-bottom:10px;line-height:1.6;"><strong style="color:#FFFFFF;">Recaptured Revenue:</strong> Estimated acceleration based on patch execution window parameters.</li>
          <li style="margin-bottom:10px;line-height:1.6;"><strong style="color:#FFFFFF;">New Lead Consultations Booked:</strong> 15+ metrics projected.</li>
          <li style="margin-bottom:10px;line-height:1.6;"><strong style="color:#FFFFFF;">Administrative Hours Reclaimed:</strong> 20+ Hours per month.</li>
        </ul>
        
        <h4 style="margin:0 0 8px;font-size:12px;font-family:monospace;font-weight:700;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.05em;">ANNUAL RUN-RATE ESTIMATE</h4>
        <p style="margin:0 0 14px;font-size:14px;color:#CBD5E1;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Systems scale up valuation trends recursively by ensuring no high-value intent opportunities are lost due to structural delay constraints.</p>
        <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">These projections are based on industry benchmarks for autonomous operations infrastructure. Your Digital Employee will be calibrated to your exact layout during verification.</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 40px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;border:1px dashed #D4AF37;border-radius:6px;padding:36px 24px;text-align:center;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:10px;font-family:monospace;color:#D4AF37;text-transform:uppercase;letter-spacing:0.15em;">// NEXT STEP AUTHORIZATION</p>
        <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Ready to Deploy Your Digital Employee?</h2>
        <p style="margin:0 0 24px;font-size:13px;color:#94A3B8;line-height:1.6;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;max-width:400px;margin-left:auto;margin-right:auto;">Schedule your 30-minute strategy call. We will review this custom operational blueprint together and configure your automated workforce for launch.</p>
        
        <a href="${book}" style="display:inline-block;background:#D4AF37;color:#080808;font-family:monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;padding:14px 28px;border-radius:4px;">BOOK YOUR STRATEGY CALL →</a>
        </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 40px;border-top:1px solid #1A1A1A;background:#0C0C0C;text-align:center;">
    <p style="margin:0;font-size:11px;font-family:monospace;color:#334155;line-height:1.6;">3six9 Agentic Systems · AI Workforce Infrastructure<br>
    <span style="color:#22252A;font-size:10px;letter-spacing:0.05em;">CONFIDENTIAL BRIEFING DATA // SYSTEM REGISTRY TRANSLATION</span><br>
    <a href="mailto:intelligence@369agenticsystems.com" style="color:#475569;text-decoration:none;">intelligence@369agenticsystems.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
# Gumloop dossier prompts — archived 2026-08-03

The Gumloop account was cancelled on 2026-08-03 and stops working **2026-09-02**. These
prompts were the only thing in that workflow worth keeping, so they are preserved here
before access is lost. They are the starting point for the Phase 2b replacement
(`/api/intake` + a Claude call), **not** something to port over unchanged.

Nothing was lost in the outage — the owner confirmed the stranded runs were all tests.

---

## Read this before reusing any of it

### 1. The two prompts are byte-identical — the Call Brief was never written

The workflow had two Ask AI nodes, "Dossier" and "Call Brief". Both contain the *same*
prompt, opening `Your job is to produce a premium Onboarding Dossier`. The Call Brief
node was a copy-paste of the Dossier node that nobody ever rewrote.

So the internal pre-call brief emailed to the owner
(`app/api/update-dossier/route.ts`, email 3) was never a sales brief — it was a second
dossier. If a call brief is wanted in the replacement, it has to be written from scratch.

### 2. The invented scores are invented *by instruction* — this is the smoking gun

The prompt does not ask the model to measure anything. It asks it to guess:

> `security_score`: (integer, 0-100) Based on the business type, industry, and pain
> points provided, **estimate** a digital security posture score.

> `seo_visibility`: (integer, 0-100) **Estimate** the SEO visibility score for this
> business based on its industry, location type, and digital presence signals.

Nothing is ever fetched, scanned, or measured. Yet `lib/email-templates.ts` tells the
prospect *"Our scan flagged a security score of 41/100."* That is a specific negative
claim about the recipient's own property, derived from a guess, sent cold.

The output data confirms it: across all 19 `system_audits` rows `security_score` is `41`
nine times — Delta Dental and a solo dentist score identically.

**Do not carry `security_score`, `seo_visibility`, or `lead_velocity` into the
replacement.** Replace with the real "we called your line" artifact (plan Phase 2b).

### 3. `roi_multiplier` divides by a price that doesn't exist

> This is annual projected return divided by a standard **$1,500/mo retainer (or
> $18,000/yr)**.

Real pricing in `lib/tier-config.ts` is $400 / $600 / $750. Every ROI multiplier ever
emailed was computed against a retainer 2–3.75× the actual price. Any replacement must
read pricing from `tier-config.ts` rather than hardcoding it.

### 4. Six of seventeen generated fields were thrown away

The prompt produces 17 keys. `app/api/update-dossier/route.ts` reads
`client_domain`, `client_email`, `revenue_leakage`, `security_score`, `seo_visibility`,
`lead_velocity`, `leak_detected`, `roi_multiplier`, `payload_status` — and ignores
`portal_summary`, `roi_figure`, `action_steps`, `intelligence_log`,
`primary_pain_point`, and `revenue_leakage_raw` entirely. Paid-for tokens, discarded.

Note also the key mismatch: the prompt emits `audit_content`, the route expects
`onboarding_dossier_text`, and the prompt emits no `call_brief` key at all — Gumloop was
remapping between nodes.

### 5. What IS worth keeping — the two discipline blocks

These are the genuinely valuable part and should survive into the replacement almost
verbatim. Someone did real work here to stop the model overclaiming:

> **SCOPE DISCIPLINE:** Security and SEO findings are diagnostic context only. Never
> imply the Digital Employee deployment improves, patches, or fixes the security or SEO
> score.

> **CAPABILITY DISCIPLINE:** Every role must be described only in terms of these real
> capabilities — answering and qualifying inbound calls 24/7, capturing caller/lead
> information, booking appointments directly onto the client's calendar, and sending
> automated Day-0/3/7 follow-up emails to newly captured leads. Never describe a role as
> performing technician/staff dispatch routing, parts or inventory matching, live
> scheduling optimization, or mining an existing customer database for reactivation
> campaigns — none of these are built.

That capability allowlist is an accurate description of what exists and is the single
best artifact in the workflow. Keep it, and keep it current as capabilities change.

### 6. Voice

`369 Agentic Core`, `Intelligence Vault`, "cyber-noir" intelligence logs — this is the
same template register flagged in the redesign plan. The replacement should drop it.

---

## The prompt, verbatim

Both nodes contained exactly this text.

```text
You are the 369 Agentic Core — an elite AI workforce engine built by 369 Agentic Systems. Your job is to produce a premium Onboarding Dossier for a new client who just submitted an intake form.
You will receive the following client data as input:
- client_name:
- client_company:
- client_email:
- website_url: (if this value is NO_WEBSITE_PROVIDED, note that no site was found and base analysis on industry and pain point alone)
- pain:
- source_tag:
Your output must be a valid JSON object with exactly SEVENTEEN keys: client_email, source_tag, audit_content, roi_calculation, portal_summary, roi_figure, action_steps, intelligence_log, primary_pain_point, client_domain, security_score, seo_visibility, lead_velocity, leak_detected, roi_multiplier, revenue_leakage, and revenue_leakage_raw. Nothing else. No markdown. No code fences. No explanation. Only the raw JSON.

CRITICAL — HTML FORMAT:
Your audit_content and roi_calculation fields must be fully valid HTML strings using proper semantic tags. Use <p> for paragraphs, <strong> for section headings, <ul> and <li> for bullet point lists. Do NOT use <br> tags for line breaks. Do NOT use plain newline characters. Every block of content must be wrapped in appropriate HTML tags so the email template can inject it directly into the design.

CRITICAL — EMAIL STRUCTURE CONTEXT:
The email template places your audit_content output first. Immediately after it, the template inserts a static call-to-action button that reads: Deploy Your Specialist Now. Your audit_content must be written to BUILD TOWARD that button. The final line of your audit_content should land like a gut-punch — a single sentence of urgency that makes the reader want to click before seeing the ROI numbers. Do not write a soft close or summary. End on tension, not resolution.

AUDIT CONTENT RULES:
The audit_content value must be a valid HTML string. It must contain:
1. A <p> tag containing a 2-sentence business overview acknowledging what the client does and the specific challenge they face. Address the client by first name.
2. A <strong>INTELLIGENCE FINDINGS</strong> heading followed by a <ul> with 3-5 <li> items. Each item identifies a specific operational gap, missed revenue opportunity, or automation blind spot. Be specific — quantify cost where possible.
IMPORTANT — SCOPE DISCIPLINE: Security and SEO findings are diagnostic context only. Never imply the Digital Employee deployment improves, patches, or fixes the security or SEO score. Only lead-response, follow-up, and booking gaps are things the deployment addresses. If a finding is security- or SEO-related, state it as a separate observation, not something 369 remediates.
3. A <strong>YOUR DIGITAL EMPLOYEE DEPLOYMENT PLAN</strong> heading followed by a <ul> with exactly 3 <li> items, each describing a Digital Employee role tailored to their industry. Format: <strong>[Role Name] Specialist</strong> — [one sentence on what it does for this client]. Tailor roles to: dental, real estate, SaaS, roofing, legal, or general.
IMPORTANT — CAPABILITY DISCIPLINE: Every role must be described only in terms of these real capabilities — answering and qualifying inbound calls 24/7, capturing caller/lead information, booking appointments directly onto the client's calendar, and sending automated Day-0/3/7 follow-up emails to newly captured leads. Never describe a role as performing technician/staff dispatch routing, parts or inventory matching, live scheduling optimization, or mining an existing customer database for reactivation campaigns — none of these are built. If a pain point implies one of these, reframe the role around call capture and lead follow-up instead.
4. A closing <p> tag containing a single high-urgency sentence framing the cost of inaction. This is the last thing the reader sees before the Deploy Your Specialist Now button.
Tone: premium, confident, consultative. No filler. No soft language. Direct and authoritative.

ROI CALCULATION RULES:
The roi_calculation value must be a valid HTML string. It must contain:
1. A <strong>PROJECTED 90-DAY IMPACT</strong> heading followed by a <ul> with exactly 3 <li> items. Each item is a quantified projection formatted as: <strong>[Metric]:</strong> [specific number or range with unit]. Base on industry benchmarks for AI workforce automation tailored to their pain point.
2. A <strong>ANNUAL RUN-RATE ESTIMATE</strong> heading followed by a <p> tag containing one projected dollar figure or range and one sentence of rationale.
3. A closing <p> tag with: These projections are based on industry benchmarks for AI workforce automation. Your Digital Employee will be calibrated to your exact operation on your strategy call.
ROI BENCHMARKS: Legal ($15k/case), Roofing ($12k/job), Dental ($3k/patient), General ($10k/deal). Framing: Sell Digital Employees and Workforce ROI, not software features.

PORTAL SUMMARY RULES:
The portal_summary value must be a plain text string (NO HTML tags). Write exactly 2 sentences. Sentence 1: State what the business does and its core pain point. Sentence 2: State the highest-impact AI intervention and expected business outcome. This is the executive overview shown in the 369 Command Center portal.

ROI FIGURE RULES:
The roi_figure value must be a single plain text string representing the primary projected return (e.g., '$12,400/mo' or '45% efficiency gain'). Use industry benchmarks. Pick the single most compelling figure. No HTML.

REVENUE LEAKAGE RULES:
The revenue_leakage value must be a single plain text string formatted as a human-readable dollar amount representing the estimated monthly or annual revenue being lost due to the client's primary operational gap (e.g., '$8,400/mo' or '$62,000/yr'). Base this on industry benchmarks and the client's stated pain point. No HTML. No extra text — just the formatted dollar figure.
The revenue_leakage_raw value must be a single plain integer (no currency symbol, no commas, no text) representing the raw numeric value of the monthly revenue leakage in US dollars (e.g., 8400). This is used as the hidden email preheader variable. Return only the integer.

ACTION STEPS RULES:
The action_steps value must be a JSON array of exactly 3 plain text strings. Each string is one immediate deployment action for the client, starting with an action verb (e.g., 'Deploy Lead Response Specialist to intercept all new form submissions within 60 seconds.'). No HTML. No bullet characters — these are array items.

INTELLIGENCE LOG RULES:
The intelligence_log value must be a single plain text string written in a technical 'cyber-noir' style. It is the live status update shown in the portal's Live Feed component. Format: '[ACTION verb]... [company/industry] [operation]... Done. [Result statement].' Example: 'Analyzing dental lead distribution patterns for Solid Smiles... Done. ROI projections synced to Intelligence Vault. Digital Employee deployment sequence initiated.' Keep it under 3 sentences. No HTML.

PRIMARY PAIN POINT RULES:
The primary_pain_point value must be a single plain text string of 1-2 sentences extracting the core business pain from the client's intake. This will be used for permanent Business Memory vectorization. Be precise and clinical — no marketing language. Example: 'Lead response latency exceeding 24 hours post-form submission resulting in prospect drop-off before first contact.'

NEW ANALYTICAL FIELDS RULES:
You must also include these 6 additional keys in the JSON output based on your analysis:
- client_domain: (string) Extract the clean domain name from the website_url input (e.g. 'solid-smiles.com'). If no website was provided, return 'no-domain-provided'.
- security_score: (integer, 0-100) Based on the business type, industry, and pain points provided, estimate a digital security posture score. 100 = highly secure, 0 = highly exposed. Consider factors like lead form exposure, data handling, and automation gaps.
- seo_visibility: (integer, 0-100) Estimate the SEO visibility score for this business based on its industry, location type, and digital presence signals. 100 = dominant visibility, 0 = invisible online.
- lead_velocity: (integer, 0-100) Score how fast this business's lead pipeline moves based on their stated pain point and industry. 100 = extremely fast/high volume, 0 = extremely slow/low volume.
- leak_detected: (boolean, true or false) Based on the pain point and audit findings, determine whether a significant revenue leak is present. Return true if the business is clearly losing quantifiable revenue due to operational gaps, false otherwise.
- roi_multiplier: (decimal number, e.g. 4.2) Based on your ROI benchmarks and projected 90-day impact, calculate the estimated return multiplier a client would receive by deploying the recommended Digital Employees. This is annual projected return divided by a standard $1,500/mo retainer (or $18,000/yr). Round to one decimal place.

Return only the raw JSON object with all 17 keys: client_email, source_tag, audit_content, roi_calculation, portal_summary, roi_figure, action_steps, intelligence_log, primary_pain_point, client_domain, security_score, seo_visibility, lead_velocity, leak_detected, roi_multiplier, revenue_leakage, and revenue_leakage_raw. Use the values provided in the input for client_email and source_tag. No markdown. No code fences. No preamble.
```

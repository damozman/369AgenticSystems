# 369 Agentic Systems — Project Blueprint
**Structural reference for directory layout, intake form schemas, style guide, and static page logic**
_Last updated: 2026-05-23 (rev 7 — Phases 1 & 2 live; landing page, 3-email sequence, call brief, early access form added)_

---

## Table of Contents
1. [Directory Map](#1-directory-map)
2. [Logic Map](#2-logic-map)
3. [Data Schema](#3-data-schema)
4. [Style Guide](#4-style-guide)
5. [Integration Specs](#5-integration-specs)
6. [Tech Stack](#6-tech-stack)
7. [The 369 Architect Blueprint — 4-Phase Roadmap](#7-the-369-architect-blueprint--4-phase-roadmap)
8. [Hybrid Architecture — Zero-Touch Policy](#8-hybrid-architecture--zero-touch-policy)

---

## 1. Directory Map

### Current Project Structure (Phase 1 + 2 Live)

```
369AgenticSystems/
│
│  ── Next.js App (landing, portal, auth, API) ──────────────────────
├── app/
│   ├── layout.tsx                ← Root layout (Instrument Sans + Inter, globals.css)
│   ├── page.tsx                  ← Landing page — Server Component, SEO metadata,
│   │                                glassmorphism, 8-industry grid, early access form
│   ├── globals.css               ← Portal-only CSS (ISOLATED from /public HTML)
│   ├── robots.ts                 ← Blocks /dashboard, /login, /api/ from crawlers
│   ├── sitemap.ts                ← Root URL sitemap for Google
│   │
│   ├── (auth)/                   ← Route group: Supabase login flow
│   │   ├── layout.tsx
│   │   └── login/page.tsx        ← 8-digit OTP login UI
│   │
│   ├── (portal)/                 ← Route group: gated client area
│   │   ├── layout.tsx            ← Auth check + PortalShell sidebar wrapper
│   │   └── dashboard/page.tsx    ← Command Center dashboard
│   │
│   └── api/
│       ├── update-dossier/route.ts  ← Gumloop webhook receiver + 3-email dispatcher
│       ├── early-access/route.ts    ← Landing page signup → Supabase + owner notify
│       └── patch-audit/route.ts     ← AUTHORIZE AGENT PATCH endpoint
│
├── components/
│   ├── landing/
│   │   ├── EarlyAccessForm.tsx   ← Client island: name/email/business → /api/early-access
│   │   └── AmbientOrb.tsx        ← Client island: cursor-tracking radial gradient orb
│   └── portal/
│       ├── Sidebar.tsx
│       ├── ActiveSpecialists.tsx ← Real-time audit cards, WARN badges, clickable drawer
│       ├── LiveFeed.tsx          ← Auto-scroll terminal feed with smart scroll detection
│       ├── BusinessMemory.tsx
│       ├── ScanCard.tsx          ← Animated scan-line wrapper
│       └── DiagnosticDrawer.tsx  ← Right-side panel: vulnerability vectors + patch button
│
├── lib/
│   ├── supabase.ts               ← Browser client
│   ├── supabase-server.ts        ← Server component client (with cookies)
│   └── email-templates.ts        ← diagnosticAlertHtml, dossierHtml, callBriefHtml
│
├── supabase/
│   └── schema.sql                ← DB schema (run in Supabase SQL editor)
│
├── docs/                         ← Reference documents (not served by Next.js)
│   ├── 369-SYSTEM-BLUEPRINT.md  ← Master architecture + roadmap (start here)
│   ├── projectblueprint.md       ← THIS FILE — directory map, schemas, style guide
│   ├── 369-toolstack-blueprint.md← Tool stack detail and AI org chart
│   ├── email-diagnostic-alert.html  ← Email 1 reference template
│   ├── email-template-dossier-v2.html ← Email 2 reference template
│   └── intelligence-grid-preview.html ← UI preview reference
│
│  ── Static Marketing Assets (Zero-Touch) ──────────────────────────
├── public/                       ← Served by CDN edge — NO Next.js processing
│   ├── index.html                ← 369agenticsystems.com/ (homepage)
│   ├── legal-automation/index.html
│   ├── roofing-leads/index.html
│   ├── saas-optimization/index.html
│   ├── dental/index.html
│   ├── real-estate/index.html
│   ├── insurance-leads/index.html
│   └── wholesale-leads/index.html
│
│  ── Config ─────────────────────────────────────────────────────────
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── middleware.ts                 ← Auth guard for /dashboard route
```

### Hosting Model (Live)

| Layer | Host | Source |
|---|---|---|
| Next.js App (landing, portal, auth, API) | Vercel — `369agenticsystems.com` | `app/` directory |
| Static Marketing HTML | Vercel CDN edge | `public/` directory |
| Database + Auth | Supabase | Managed PostgreSQL + GoTrue |
| Email | Resend Pro | `alerts@alerts.369agenticsystems.com` |
| Automation | Gumloop Pro | 10-node pipeline, Gemini 2.5 Flash |

> **Zero-Touch Policy for marketing HTML:** The files in `public/` are never converted to `.tsx`. They are pure HTML served directly by the CDN, with their own self-contained CSS and JS. No Tailwind build step, no Next.js CSS, no framework bleed.

---

## 2. Logic Map

### Page Relationships

```
Homepage (index.html)
│
│  [#catalog portal grid — 6 cards]
│  ├── Legal Automation    → /legal-automation/
│  ├── Roofing Leads       → /roofing-leads/
│  ├── SaaS Optimization   → /saas-optimization/
│  ├── Dental Practices    → /dental/
│  ├── Real Estate         → /real-estate/
│  └── Not Listed?         → Opens audit-modal step 2 (contact form)
│
│  [Nav "Deploy a System" button]
│  └── href="#catalog" — scrolls to portal grid on homepage
│
│  [Nav + Footer "Get a Free Audit" buttons]
│  └── data-audit attribute → triggers #audit-modal
│
└── #audit-modal (2-step modal)
    ├── Step 1: Industry Picker (6 industry cards)
    │   ├── Legal Firms         → href="legal-automation/#handoff"
    │   ├── Roofing Contractors → href="roofing-leads/#handoff"
    │   ├── SaaS Companies      → href="saas-optimization/#handoff"
    │   ├── Dental Practices    → href="dental/#handoff"
    │   ├── Real Estate         → href="real-estate/#handoff"
    │   └── Not Listed? / Other → shows step 2
    └── Step 2: Contact Form (mailto fallback, no backend yet)
        └── Fields: name, company, email, industry (text), pain point

Each Industry Page (legal-automation, roofing-leads, saas-optimization, dental, real-estate)
│
├── #handoff section (terminal intake form — bottom of page)
│   └── Form fields vary per industry (see Data Schema)
│
├── ROI Calculator (slider-driven, vanilla JS)
│   └── Outputs: weekly / monthly / annual recovered revenue
│
├── Agent Roster (AGENTS.md-style cards)
│   └── 4 named AI agents per industry
│
├── Bento Grid dashboard mockup
│   └── Live-style metrics panel for that industry's KPIs
│
└── CTA buttons throughout → data-audit attribute → #audit-modal step 2
    (Note: industry pages have their own modals or use page-level forms)
```

### Shared JS Patterns (present in every page)
1. **Ambient cursor gradient** — `requestAnimationFrame` loop tracking `mousemove`, updating a radial gradient centered on cursor
2. **Scroll-reveal** — `IntersectionObserver` on `.reveal` elements; toggles `.visible` class to animate in
3. **Navbar scroll state** — `scroll` event listener; adds `.scrolled` class to `#navbar` after 50px scroll
4. **ROI calculator** — input/range sliders drive live calculation output spans
5. **Terminal form** — client-side validation; `website_url` `input` listener toggles inline `[INFO]` message; on submit: button shows `[INFO] Transmitting to 369 Agentic Core...`, async `fetch()` POST fires to `WEBHOOK` constant, on resolve form hides and `[SUCCESS] Secure Uplink Established. Audit in progress.` appears
6. **Audit modal (homepage only)** — `data-audit` click delegation; step show/hide; backdrop click dismiss; `Escape` key dismiss; `body` scroll-lock

### CSS Architecture Pattern (shared across all pages)
- All color tokens defined as CSS custom properties on `:root`
- Per-industry accent var (`--rose`, `--sky`, `--gold`, etc.) drives all accent-dependent rules
- Glass card pattern: `background: rgba(255,255,255,0.03)`, `backdrop-filter: blur(10px)`, `border: 1px solid rgba(255,255,255,0.08)`
- `.reveal` + `.visible` pattern for scroll-triggered animations (transform + opacity)
- Responsive grid: 3-col → 2-col → 1-col via media queries at 968px and 640px

---

## 3. Data Schema

> **Status: LIVE (pending webhook URL).** Each form submits via `async fetch()` POST to `const WEBHOOK = 'GUMLOOP_WEBHOOK_URL_HERE'` defined at the top of each page's form handler. Replace that one constant per page with the real Gumloop URL to go fully live. The payload schema, field IDs, key names, and `source_tag` values are finalized and will not change.

### Terminal Intake Form — Field Names by Industry

All forms use `id` attributes on inputs for JS validation. When wired to a webhook, these `id` values map directly to payload keys.

#### Homepage Audit Modal (Step 2 — "Not Listed / Other")
| Field ID       | Type     | Label                        | Notes                        |
|----------------|----------|------------------------------|------------------------------|
| `modal-name`   | text     | Full Name                    |                              |
| `modal-company`| text     | Company Name                 |                              |
| `modal-email`  | email    | Email Address                |                              |
| `modal-industry`| text    | Your Industry                | Free text                    |
| `modal-pain`   | textarea | Biggest operational problem  | Free text                    |

#### Legal Automation (`legal-automation/#handoff`)
| Field ID     | Type     | Required | Label               | Notes                                                |
|--------------|----------|----------|---------------------|------------------------------------------------------|
| `f-name`     | text     | yes      | Full Name           |                                                      |
| `f-firm`     | text     | yes      | Firm Name           | Payload key: `company`                               |
| `f-email`    | email    | yes      | Email Address       |                                                      |
| `f-url`      | url      | **no**   | Website URL         | `null` if blank or `"none"` typed; info msg shown    |
| `f-pain`     | select   | yes      | Primary Pain Point  | Options: leads / drafting / scheduling / admin / all |

#### Roofing Leads (`roofing-leads/#handoff`)
| Field ID     | Type     | Required | Label               | Notes                                                       |
|--------------|----------|----------|---------------------|-------------------------------------------------------------|
| `f-name`     | text     | yes      | Full Name           |                                                             |
| `f-company`  | text     | yes      | Company Name        |                                                             |
| `f-email`    | email    | yes      | Email Address       |                                                             |
| `f-url`      | url      | **no**   | Website URL         | `null` if blank or `"none"` typed; info msg shown           |
| `f-area`     | text     | yes      | Service Area        | City / region free text                                     |
| `f-pain`     | select   | yes      | Primary Pain Point  | Options: speed / estimates / supplements / pipeline / all   |

#### SaaS Optimization (`saas-optimization/#handoff`)
| Field ID     | Type     | Required | Label               | Notes                                                          |
|--------------|----------|----------|---------------------|----------------------------------------------------------------|
| `f-name`     | text     | yes      | Full Name           |                                                                |
| `f-company`  | text     | yes      | Company Name        |                                                                |
| `f-email`    | email    | yes      | Email Address       |                                                                |
| `f-url`      | url      | **no**   | Website URL         | `null` if blank or `"none"` typed; info msg shown              |
| `f-mrr`      | select   | yes      | Monthly MRR Range   | Options: pre / 10k / 50k / 100k / 100k+                       |
| `f-blocker`  | select   | yes      | Primary Growth Blocker | Options: content / seo / cac / comp / all                  |

#### Dental Practices (`dental/#handoff`)
| Field ID     | Type     | Required | Label               | Notes                                                           |
|--------------|----------|----------|---------------------|-----------------------------------------------------------------|
| `f-name`     | text     | yes      | Full Name           |                                                                 |
| `f-company`  | text     | yes      | Practice Name       |                                                                 |
| `f-email`    | email    | yes      | Email Address       |                                                                 |
| `f-url`      | url      | **no**   | Website URL         | `null` if blank or `"none"` typed; info msg shown               |
| `f-size`     | text     | yes      | Active Patient Count| Free text number                                                |
| `f-pain`     | select   | yes      | Primary Pain Point  | Options: noshows / reactivation / insurance / intake / all      |

#### Real Estate (`real-estate/#handoff`)
| Field ID     | Type     | Required | Label               | Notes                                                             |
|--------------|----------|----------|---------------------|-------------------------------------------------------------------|
| `f-name`     | text     | yes      | Full Name           |                                                                   |
| `f-company`  | text     | yes      | Brokerage Name      |                                                                   |
| `f-email`    | email    | yes      | Email Address       |                                                                   |
| `f-url`      | url      | **no**   | Website URL         | `null` if blank or `"none"` typed; info msg shown                 |
| `f-leads`    | text     | yes      | Monthly Lead Volume | Free text number                                                  |
| `f-pain`     | select   | yes      | Primary Pain Point  | Options: speed / showings / followup / listings / all             |

### Payload Envelope Fields (JS-generated, not HTML inputs)
These are added by the submit handler at runtime — no hidden `<input>` elements needed.

| Payload Key    | Value                                          | Purpose                                       |
|----------------|------------------------------------------------|-----------------------------------------------|
| `source_tag`   | e.g. `"369AS_DENTAL_INTAKE"`                   | Gumloop workflow routing key                  |
| `website_url`  | URL string **or** `null`                       | `null` when blank or user typed `"none"`      |
| `timestamp`    | `new Date().toISOString()`                     | ISO 8601 submission time                      |

### website_url Behavior
| User input          | Payload value          | Terminal display                                                        |
|---------------------|------------------------|-------------------------------------------------------------------------|
| *(blank)*           | `null`                 | `[INFO] No website found. Initializing Digital Employee Foundation Blueprint...` |
| `"none"`            | `null`                 | same info message                                                       |
| `"https://site.com"`| `"https://site.com"`   | info message hidden                                                     |

### Source Tag Conventions
| Page               | Suggested `source_tag` value     |
|--------------------|----------------------------------|
| Legal Automation   | `369AS_LEGAL_INTAKE`             |
| Roofing Leads      | `369AS_ROOFING_INTAKE`           |
| SaaS Optimization  | `369AS_SAAS_INTAKE`              |
| Dental             | `369AS_DENTAL_INTAKE`            |
| Real Estate        | `369AS_REALESTATE_INTAKE`        |
| Modal (Not Listed) | `369AS_UNLISTED_INTAKE`          |

---

## 4. Style Guide

> **Branding Rule (Permanent):** Corporate entity branding (3six9 Media Masters LLC) is strictly restricted to a subtle, low-contrast footer. The active public and portal-facing interface must exclusively use numeric **"369"** branding — in all headings, navigation, CTAs, agent labels, and UI copy. No AI agent, collaborator, or developer may introduce "3six9" into any interface-visible element.

### Typography
| Role         | Font           | CDN Source         |
|--------------|----------------|--------------------|
| Display/H1–H3 | Instrument Sans | Google Fonts      |
| Body / UI    | Inter           | Google Fonts       |
| Terminal forms | Courier New  | System font        |

```html
<!-- Google Fonts import (in every <head>) -->
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
```

### Color System

#### Homepage Brand Colors
| Token      | Hex       | Usage                                  |
|------------|-----------|----------------------------------------|
| `--gold`   | `#D4AF37` | Logo, dividers, hero orbs, scrollbar   |
| Background | `#0A0A0A` | Page background (all pages)            |
| Surface    | `#111111` | Card/panel background base             |

#### Industry Accent Colors
| Industry          | CSS Var          | Hex       | Dark Variant | Light Variant |
|-------------------|------------------|-----------|--------------|---------------|
| Legal Automation  | `--legal`        | `#60A5FA` | `#1E3A8A`    | `#BFDBFE`     |
| Roofing Leads     | `--roofing`      | `#F59E0B` / `#FF4500` | `#CC3700` | `#FF6533` |
| SaaS Optimization | `--saas`         | `#6366F1` / `#8B5CF6` | `#4F46E5` | `#C4B5FD` |
| Dental Practices  | `--dental` / `--rose` | `#EC4899` | `#BE185D` | `#F9A8D4` |
| Real Estate       | `--realestate` / `--sky` | `#0EA5E9` | `#0369A1` | `#7DD3FC` |
| Not Listed / Other| `--unlisted`     | `#94A3B8` | `#64748B`    | `#CBD5E1`     |

> The homepage uses `--gold` as its brand accent. Each industry page defines its own local accent variable (e.g., `--rose` in dental/index.html). When a new industry page is created, choose a color not already in this table to preserve distinct visual identities.

### Glass Card Pattern
```css
/* Standard glass card */
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(10px);
-webkit-backdrop-filter: blur(10px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 16px;

/* Accent-tinted glass card (e.g., featured card) */
background: rgba(VAR_R, VAR_G, VAR_B, 0.08);
border-color: rgba(VAR_R, VAR_G, VAR_B, 0.2);
```

### Terminal Form Style
```css
.terminal {
  background: #0a0a0a;
  border: 1px solid rgba(ACCENT, 0.3);
  border-radius: 12px;
  font-family: 'Courier New', monospace;
}
.terminal-header {
  background: rgba(ACCENT, 0.1);
  border-bottom: 1px solid rgba(ACCENT, 0.2);
  padding: 12px 20px;
}
/* Input fields */
input, select, textarea {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e2e8f0;
  font-family: 'Courier New', monospace;
}
input:focus, select:focus, textarea:focus {
  border-color: rgba(ACCENT, 0.5);
  outline: none;
}
```

### Button Variants
```css
/* Primary CTA — gradient */
.btn-primary {
  background: linear-gradient(135deg, VAR_ACCENT, VAR_ACCENT_DARK);
  color: #f0f0f0;
  border: none;
  border-radius: 8px;
  padding: 14px 32px;
  font-weight: 600;
  transition: all 0.3s ease;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(ACCENT, 0.3);
}

/* Ghost / outline button */
.btn-ghost {
  background: transparent;
  border: 1px solid rgba(ACCENT, 0.4);
  color: VAR_ACCENT;
}
```

### Bento Grid
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.bento-grid .span2 { grid-column: span 2; }
.bento-grid .tall  { grid-row: span 2; }

@media (max-width: 968px) {
  .bento-grid { grid-template-columns: repeat(2, 1fr); }
  .bento-grid .span2 { grid-column: span 1; }
}
@media (max-width: 640px) {
  .bento-grid { grid-template-columns: 1fr; }
}
```

### Scroll Reveal
```css
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```
```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```

### Ambient Cursor Gradient (homepage & all industry pages)
```js
document.addEventListener('mousemove', (e) => {
  document.body.style.background =
    `radial-gradient(ellipse 800px 600px at ${e.clientX}px ${e.clientY}px,
     rgba(ACCENT_R, ACCENT_G, ACCENT_B, 0.06) 0%, #0a0a0a 60%)`;
});
```

---

## 5. Integration Specs

### Current State — LIVE
All forms submit via `async fetch()` POST to their respective Gumloop webhook URLs. The Gumloop pipeline posts to `https://369agenticsystems.com/api/update-dossier`, which triggers the 3-email sequence and writes to Supabase.

**Remaining:** Replace `GUMLOOP_WEBHOOK_URL_HERE` and `YOUR_BOOKING_LINK_HERE` in the 8 `/public` HTML marketing pages with live values.

### Gumloop Webhook Endpoint
```
POST https://app.gumloop.com/webhooks/YOUR_WEBHOOK_ID
Content-Type: application/json
```

### Live Payload Schema (standardized across all pages)
```js
// All pages emit this structure. Industry-specific values differ per page.
const payload = {
  source_tag:              '369AS_DENTAL_INTAKE',      // see Source Tag table
  client_name:             'Jane Smith',
  client_company:          'Smith Family Dental',
  client_email:            'jane@smithdental.com',
  website_url:             'https://smithdental.com',  // or null if skipped
  pain:                    'noshows',                  // bottleneck select value
  industry_specific_field: '800',                      // niche field (see table below)
  timestamp:               '2026-05-11T14:23:00.000Z',
};
```

### industry_specific_field Mapping
| Page          | Maps to field | Example value        |
|---------------|---------------|----------------------|
| Legal         | `f-firm`      | `"Smith & Associates"` |
| Roofing       | `f-area`      | `"Dallas TX"`          |
| SaaS          | `f-mrr`       | `"50k"`                |
| Dental        | `f-size`      | `"800"`                |
| Real Estate   | `f-leads`     | `"20"`                 |
| Homepage Modal| `business`    | `"HVAC Company"`       |

### Terminal UX Sequence (all pages)
```
1. User clicks submit
2. Button label → "[INFO] Transmitting to 369 Agentic Core..."
   + button disabled
3. fetch() POST fires (async)
4. On resolve: form hidden, success-msg shown — two-stage reveal:

   STAGE 1 — process-stage (immediate):
   "[PROCESS] Onboarding Digital Employee to {client_company}..."
   [animated loading bar — 2.2s CSS transition, accent color per industry]

   STAGE 2 — success-stage (after 2500ms):
   "[SUCCESS] 369 Core connected. Your Digital Employee is drafting your Onboarding Dossier now. Check your email in 2-5 minutes."
   "→ Submission received by the 369 Agentic Core."
   "→ Expect contact within 24 hours."
   "→ Your [Industry] Digital Employee is being configured." [blinking cursor]
```

### Loading Bar Colors (per industry)
| Page          | Gradient                                  |
|---------------|-------------------------------------------|
| Legal         | `#60A5FA → #93C5FD`                       |
| Roofing       | `#FF4500 → #FF6533`                       |
| SaaS          | `#8B5CF6 → #C4B5FD`                       |
| Dental        | `#EC4899 → #F9A8D4`                       |
| Real Estate   | `#0EA5E9 → #7DD3FC`                       |
| Homepage Modal| `#D4AF37 → #E8C84A`                       |

#### Gumloop Workflow Architecture (intended)
```
Webhook Trigger (source_tag routing)
    │
    ├── 369AS_LEGAL_INTAKE     → Legal qualification workflow
    ├── 369AS_ROOFING_INTAKE   → Roofing qualification workflow
    ├── 369AS_SAAS_INTAKE      → SaaS qualification workflow
    ├── 369AS_DENTAL_INTAKE    → Dental qualification workflow
    ├── 369AS_REALESTATE_INTAKE→ Real estate qualification workflow
    └── 369AS_UNLISTED_INTAKE  → Generic "book a discovery call" workflow
         │
         └── All workflows → CRM entry → Notify agent (email/Slack) → Schedule follow-up
```

### Audit Modal Flow (homepage)
```
User clicks [data-audit] button
    │
    └── #audit-modal opens → Step 1: industry picker
            │
            ├── Known industry card clicked
            │       └── href="/{industry}/#handoff" — navigates to page's intake form
            │
            └── "Not Listed?" card OR unknown category
                    └── Step 2: contact form (modal-name, modal-company, modal-email, modal-industry, modal-pain)
                            └── [CURRENT] mailto:texasmediamasters@gmail.com fallback
                            └── [PLANNED]  POST to 369AS_UNLISTED_INTAKE webhook
```

### SEO Metadata (present in all pages)
Each `index.html` contains:
- `<title>` — unique per page, keyword-rich
- `<meta name="description">` — 150–160 chars, action-oriented
- `<meta name="keywords">` — industry-specific keywords + brand
- `<link rel="canonical">` — absolute URL for self-reference
- JSON-LD `Organization` schema on homepage
- JSON-LD `Service` or `LocalBusiness` schema on industry pages (where implemented)

---

## 6. Tech Stack

| Layer         | Technology                          | Status / Notes                                           |
|---------------|-------------------------------------|----------------------------------------------------------|
| Portal        | Next.js 14 App Router, TypeScript   | Live at `369agenticsystems.com`                          |
| Styling       | Tailwind CSS + inline styles        | Portal: Tailwind. Public HTML: Tailwind v4 CDN           |
| Styling       | Custom CSS (in `<style>` blocks)    | CSS custom properties, glassmorphism, ambient orb        |
| Typography    | Google Fonts                        | Instrument Sans + Inter (loaded in layout.tsx + HTML heads)|
| Static pages  | Vanilla HTML5 + JavaScript (ES6+)   | IIFE pattern, no build step, zero-touch                  |
| Hosting       | Vercel                              | apex = Production, www = 307 redirect to apex            |
| Automation    | Gumloop Pro                         | 10-node pipeline live, Gemini 2.5 Flash                  |
| Email         | Resend Pro                          | `scheduledAt` active, FROM `alerts@alerts.369agenticsystems.com` |
| Database      | Supabase                            | `system_audits` + `early_access_list` tables live        |
| Domain        | `369agenticsystems.com`             | Namecheap DNS → Vercel                                   |
| Booking       | Cal.com                             | `cal.com/369agentic/30min`                               |
| Version Control | Git                               | Local repo, deployed via Vercel GitHub integration       |

### Browser Compatibility Notes
- `backdrop-filter: blur()` requires `-webkit-backdrop-filter` prefix for Safari
- `IntersectionObserver` is baseline-supported in all modern browsers; no polyfill needed
- Tailwind v4 browser build requires no IE11 support (acceptable for B2B target market)
- `CSS custom properties` (`var()`) — fully supported in all targeted browsers

### Performance Considerations
- All pages are single-file; no HTTP round-trips for assets beyond 2 Google Font requests and 1 Tailwind CDN request
- No client-side routing framework — each page is a full navigation load
- Animations use `transform` and `opacity` only (GPU-composited, no layout thrash)
- `requestAnimationFrame` used for cursor gradient (not `mousemove` → style direct)

---

## Appendix: Industry Agent Rosters

| Industry       | Specialist 1                   | Specialist 2                  | Specialist 3                      | Specialist 4                   |
|----------------|--------------------------------|-------------------------------|-----------------------------------|--------------------------------|
| Legal          | Digital Intake Specialist      | Document Drafter              | Follow-up Scheduler               | Compliance Monitor             |
| Roofing        | Lead Qualifier                 | SMS Estimator                 | Storm-Response Dispatch           | Insurance Supplement Specialist|
| SaaS           | SEO Strategist                 | Technical Content Specialist  | Conversion Optimizer              | Market Intelligence Bot        |
| Dental         | Appointment Guardian           | Reactivation Specialist       | Insurance Pre-Auth Specialist     | Digital Intake Specialist      |
| Real Estate    | Lead Response Specialist       | Showing Coordinator           | Follow-Up Sequencer               | Listing Content Specialist     |

---

_This blueprint is intended for use by AI agents, collaborators, and the project owner. Update this file whenever a new industry page is added, a color token changes, or an integration goes live._

---

## 7. The 369 Architect Blueprint — 4-Phase Roadmap

> **Status: Planned — implementation begins after current go-live blockers are resolved (see pending items in Sections 3 & 5).**
> This roadmap evolves the current static HTML + Gumloop stack into a fully autonomous, persistent, multi-agent infrastructure. Phases are sequential but each delivers standalone value.

---

### Phase 1: The Command Center (The "Face")
**Goal:** Replace the one-off email experience with a persistent Client Portal.

**Stack:**
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) — speed + SEO |
| Styling | Tailwind CSS + Framer Motion (terminal animations) |
| Deployment | Vercel |
| Auth | Supabase Auth (Magic Link — frictionless, high-end feel) |

**Core Tasks:**
- [ ] **Auth Gate** — Secure Magic Link login via Supabase Auth
- [ ] **Specialist Dashboard** — UI showing "Active Specialists" (Lead Response, Claims Triage, etc.) with real-time status indicators
- [ ] **Asset Library** — Table view where every generated Onboarding Dossier is stored as a permanent digital asset
- [ ] **Webhook Receiver** — API route `/api/update-dossier` that listens for Gumloop outputs and writes to the database

---

### Phase 2: The Persistence Layer (The "Brain")
**Goal:** Create "uncancelable" business memory for clients.

**Stack:**
| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL) |
| Vector Store | pgvector (inside Supabase) |

**Core Tasks:**
- [ ] **Contextual Archiving** — Every lead, audit, and client interaction is vectorized and stored in pgvector
- [ ] **Knowledge Retrieval** — Configure Gumloop AI node to query the vector DB at the start of every run: `"What did we learn about this client's pain points in the last audit?"`
- [ ] **The Moat** — Client data export option exists, but active agent intelligence (context + retrieval) lives exclusively in the 369 system

---

### Phase 3: Agentic Orchestration (The "Manager")
**Goal:** Move from linear Gumloop flows to autonomous multi-agent Squads.

**Stack:**
| Layer | Technology |
|---|---|
| Orchestrator | Flowise (Visual Node Cockpit running locally via Docker) |
| Reasoning Model | Gemini 2.5 Pro (1-Million Token Window via API Key) |

**Core Tasks:**
- [x] **Visual Framework Deployment** — Stabilize Flowise on local Docker infrastructure to eliminate Windows filesystem package drops.
- [ ] **Supervisor Node** — "Manager Agent" reviews Specialist Agent output before client delivery.
- [ ] **Multi-Agent Hand-off** — Scraper agent → ROI calculator agent → Email writer agent (quality multiplier vs. single-node AI).

---

### Phase 4: Deep Integration (The "Hands")
**Goal:** Perform "manual" labor inside client systems without APIs.

**Stack:**
| Layer | Technology |
|---|---|
| Browser Control | OpenClaw or Composio |

**Core Tasks:**
- [ ] **Legacy Sync** — Log into client's legacy CRM or inventory portal; update records based on lead activity
- [ ] **Browser Control** — Agents navigate browsers like a human to retrieve information locked behind logins

---

### Roadmap Dependency Chain

```
[Current] cPanel static HTML + Gumloop webhooks (Phase 0 — go-live)
    │
    ▼
Phase 1 — Next.js Client Portal + Supabase Auth + Webhook Receiver
    │
    ▼
Phase 2 — pgvector Business Memory + Contextual Retrieval
    │
    ▼
Phase 3 — PydanticAI Supervisor + Multi-Agent Squad Orchestration
    │
    ▼
Phase 4 — Browser Agent Deep Integration (OpenClaw / Composio)
```

> **Pre-requisite before Phase 1:** Resolve all critical pending items — Gumloop Pro upgrade + webhook URLs wired, booking link live, and at least one industry fully validated end-to-end.

> **Phase 1 Scaffold Status (2026-05-13):** Next.js 14 project initialized. Route groups, portal layout, dashboard, auth login, Supabase clients, DB schema, and webhook receiver are all built. Awaiting Supabase project creation and HTML migration to `/public`.

---

## 8. Hybrid Architecture — Zero-Touch Policy

### The Rule
Existing static HTML marketing pages (`index.html` files) are **never modified or converted** as part of the Next.js migration. They are served as pure static assets from the `/public` directory.

### Why This Matters
- Marketing pages have custom Tailwind v4 (CDN), vanilla JS, and embedded CSS that are entirely self-contained.
- Converting them to `.tsx` risks visual regressions, broken animations, and loss of performance characteristics.
- Serving from `/public` preserves their CDN edge caching, instant load times, and zero build dependency.

### CSS Isolation Guarantee
`app/globals.css` contains `@tailwind base` (CSS reset) and portal-specific custom properties. This CSS is **only injected into pages rendered through the Next.js App Router** (`/login`, `/portal/**`). Static files in `/public` are served as raw files — they never pass through Next.js's CSS pipeline.

### URL Preservation on Vercel
Vercel's CDN automatically serves `index.html` at directory paths:
| File | URL |
|---|---|
| `public/index.html` | `yoursite.com/` |
| `public/legal-automation/index.html` | `yoursite.com/legal-automation/` |
| `public/roofing-leads/index.html` | `yoursite.com/roofing-leads/` |
| *(same pattern for all 8 industries)* | |

### Local Development Note
`next dev` serves public files at explicit paths only (e.g., `/legal-automation/index.html`). Directory URL resolution (`/legal-automation/`) is a Vercel production feature. Since the marketing pages are Zero-Touch, this is acceptable — portal development happens at `http://localhost:3000/login` and `http://localhost:3000/portal/dashboard`.

### Boundary Rules for Future Development
| Allowed | Not Allowed |
|---|---|
| Edit `app/(portal)/**` freely | Import portal CSS into public HTML |
| Edit `public/*.html` for content/copy | Add Next.js `<Script>` or `<Image>` to public HTML |
| Add new Next.js pages under `(portal)/` | Create `app/(marketing)/` pages that shadow public files |
| Wire Supabase real data to portal components | Convert public HTML pages to `.tsx` without explicit decision |

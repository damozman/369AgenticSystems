# 369 Agentic Systems — Project Blueprint
**Source of Truth for AI Agents and Collaborators**
_Last updated: 2026-05-11 (rev 4 — Digital Employee rebrand, two-stage loading bar, url-info copy update)_

---

## Table of Contents
1. [Directory Map](#1-directory-map)
2. [Logic Map](#2-logic-map)
3. [Data Schema](#3-data-schema)
4. [Style Guide](#4-style-guide)
5. [Integration Specs](#5-integration-specs)
6. [Tech Stack](#6-tech-stack)

---

## 1. Directory Map

```
369AgenticSystems/
├── index.html                    ← Homepage (brand hub, industry portal)
├── projectblueprint.md           ← This file
│
├── legal-automation/
│   └── index.html                ← Legal Automation industry page
│
├── roofing-leads/
│   └── index.html                ← Roofing Leads industry page
│
├── saas-optimization/
│   └── index.html                ← SaaS Optimization industry page
│
├── dental/
│   └── index.html                ← Dental Practice Automation industry page
│
└── real-estate/
    └── index.html                ← Real Estate Agency Automation industry page
```

### Hosting Constraint
All pages are **single-file HTML** deployed to a cPanel shared host. There is no build pipeline, no npm, no node_modules, and no server-side rendering. Every page is entirely self-contained — all CSS, JavaScript, and markup live inside a single `index.html` file.

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

### Current State — Smart Factory Architecture (LIVE, pending URL)
All forms submit via `async fetch()` POST. The fetch, payload construction, and terminal UX sequence are fully wired. The only thing needed to go live is replacing `'GUMLOOP_WEBHOOK_URL_HERE'` with the real webhook URL in each page's `const WEBHOOK` line.

**To activate any page:** find `const WEBHOOK = 'GUMLOOP_WEBHOOK_URL_HERE';` near the form handler and replace the string.

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

| Layer         | Technology                          | Version / Source                                         |
|---------------|-------------------------------------|----------------------------------------------------------|
| Markup        | HTML5                               | Semantic elements throughout                             |
| Styling       | Tailwind CSS                        | v4 via `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4` |
| Styling       | Custom CSS (in `<style>` blocks)    | CSS custom properties, glassmorphism, animations         |
| Typography    | Google Fonts                        | Instrument Sans + Inter — loaded via `<link>` in `<head>` |
| Scripting     | Vanilla JavaScript (ES6+)           | IIFE pattern, no frameworks, no build step               |
| Hosting       | cPanel shared hosting               | Static file serving; one `index.html` per directory      |
| Automation    | Gumloop *(planned)*                 | Webhook-based workflow automation                        |
| Domain        | TBD (369agenticsystems.com assumed) | + `practiceclear.com` (separate dental-adjacent property)|
| Version Control | Git (local)                       | No remote configured yet                                 |

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

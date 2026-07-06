# AGENT DISCOVERY OUTPUT
## 369 Agentic Systems — Visual & Brand System Audit

---

## 1. VERTICAL COLOR PALETTES

### Brand Foundation (Global)
| Token | Hex | Usage |
|---|---|---|
| Gold (Primary Brand) | `#D4AF37` | Logo accent, CTAs, gold elements |
| Gold Dim | `#8B6914` | Subdued gold states |
| Gold Bright | `#F0C94A` | Hover/highlight gold |
| Background Base (Dark) | `#0D0D0D` | Page background |
| Background Surface | `#111111` | Card surfaces |
| Background Terminal | `#080808` | Terminal/code blocks |
| Text Primary | `#FFFFFF` | Headlines |
| Text Secondary | `#CBD5E1` | Body copy |
| Text Muted | `#94A3B8` / `#64748B` | Labels, captions |

**Light Mode Overrides** (`html.light`):
| Token | Hex |
|---|---|
| Background Base | `#F5F3EF` |
| Background Surface | `#FFFFFF` |
| Text Primary | `#111111` |
| Text Secondary | `#374151` |

---

### Per-Vertical Palettes

#### Roofing — Speed-to-Lead AOS
| Role | Hex | CSS Var |
|---|---|---|
| Primary | `#FF4500` | `--orange` |
| Light | `#FF6533` | `--orange-light` |
| Dark | `#CC3700` | `--orange-dark` |

**Character**: Urgent orange — fast response, competitive edge, storm urgency

---

#### HVAC — Emergency Response AOS
- No dedicated static page; inherits from component system
- **Expected palette**: Warm/industrial tones (TBD — define before launch)

---

#### Plumbing — Emergency Response AOS
- No dedicated static page; inherits from component system
- **Expected palette**: Industrial blue (TBD — define before launch)

---

#### Dental — Patient Revenue AOS
| Role | Hex | CSS Var |
|---|---|---|
| Primary | `#EC4899` | `--rose` |
| Light | `#F9A8D4` | `--rose-light` |
| Dark | `#BE185D` | `--rose-dark` |

**Character**: Warm rose — approachable, caring, patient-first

---

#### Legal — Legal Excellence AOS
| Role | Hex | CSS Var |
|---|---|---|
| Primary | `#60A5FA` | `--sky` (legal variant) |
| Light | `#93C5FD` | — |

**Character**: Professional blue — trust, authority, high-stakes precision

---

#### Real Estate — Pipeline Velocity AOS
| Role | Hex | CSS Var |
|---|---|---|
| Primary | `#0EA5E9` | `--sky` |
| Light | `#7DD3FC` | `--sky-light` |
| Dark | `#0369A1` | `--sky-dark` |

**Character**: Clear sky blue — clarity, velocity, opportunity

---

#### Insurance — Agency Revenue AOS
| Role | Hex | CSS Var |
|---|---|---|
| Primary | `#14B8A6` | `--teal` |
| Light | `#5EEAD4` | `--teal-light` |
| Dark | `#0D9488` | `--teal-dark` |

**Character**: Stable teal — reliability, consistency, renewal focus

---

#### SaaS — Growth Engine AOS
| Role | Hex | CSS Var |
|---|---|---|
| Primary | `#8B5CF6` | `--purple` |
| Light | `#A78BFA` | `--purple-light` |
| Dark | `#6D28D9` | `--purple-dark` |

**Character**: Innovation purple — growth, conversion, transformation

---

#### Wholesale — Distribution Velocity AOS
| Role | Hex | CSS Var |
|---|---|---|
| Primary | `#84CC16` | `--lime` |
| Light | `#BEF264` | `--lime-light` |
| Dark | `#65A30D` | `--lime-dark` |

**Character**: Energetic lime — speed, efficiency, operational momentum

---

### Glass Effect System (Universal)
```css
--glass-bg:     rgba(255,255,255,0.04)
--glass-strong: rgba(255,255,255,0.06)
--glass-border: rgba(148,163,184,0.12)
blur: 24px (standard) / 32px (strong cards)
```

---

## 2. BRAND GUIDELINES

### Brand Identity
- **Name**: 369 Agentic Systems
- **Tagline**: "The End of Admin. The Start of Agentic Scale."
- **Positioning**: AI Workforce Infrastructure — autonomous agents for lead intake, appointment setting, follow-up, and revenue recovery
- **Contact**: intelligence@369agenticsystems.com

### Typography

| Role | Family | Weights | CSS Var | Usage |
|---|---|---|---|---|
| Body | Inter | 300–700 | `--font-inter` | All body copy, paragraphs |
| Display/Heading | Instrument Sans | 400–700 | `--font-display` | Headlines, hero text, logo |
| Mono | Courier New | 500–700 | system | Labels, metrics, terminal UI |

**Type Scale**:
| Level | Size | Weight | Letter Spacing |
|---|---|---|---|
| H1 Hero | `clamp(36px, 6vw, 64px)` | 700 | `-0.02em` |
| H2 Section | `clamp(24px, 4vw, 36px)` | 700 | — |
| H3 Card | `16px` | 700 | — |
| Body | `14–18px` | 400–500 | — |
| Labels | `10–12px` | 600–700 | `0.12em–0.2em` |

### Logo
- **Treatment**: Pure text — "369 AGENTIC SYSTEMS"
- **"369" color**: `#D4AF37` (gold)
- **Full text color**: `#FFFFFF` on dark / `#111111` on light
- **Font**: Instrument Sans, monospace variant
- **Logo Gradient**: `linear-gradient(135deg, #F0F0F0 0%, #D4AF37 55%, #E8C84A 100%)`
- **No image logo files exist** — all text-based

### Visual Design Language

**Glass Morphism** (primary card aesthetic):
- Frosted glass layers with 24px/32px blur
- Stacked backgrounds at 0.03–0.06 opacity
- Border color: 12% white opacity standard

**Animations**:
- `pulseGold`: Box-shadow pulse on brand elements (2s ease-in-out)
- `scanLine`: Terminal-style scan (3.5s linear)
- `terminalBlink`: Cursor blink (1s step-end)
- Hover: `translateY(-2px)` + letter-spacing expand + color shift

**Backgrounds**:
- Page: `#0A0A0A` (obsidian) + SVG noise overlay (0.025 opacity)
- Grid: 64px linear-gradient grid at 0.025 opacity
- Ambient orb: Cursor-reactive radial gradient (gold/indigo/amber)

**Buttons**:
- Gradient background per vertical color
- Dark text (`#0A0A0A`) on colored buttons
- Padding: `14px 32px`, border-radius: `8px`
- Shine: Animated linear-gradient overlay on hover

> **Note**: No BRAND.md, DESIGN.md, or STYLE_GUIDE.md files exist. All branding is encoded in CSS variables, Tailwind config, and inline component styles.

---

## 3. TONE & POSITIONING PER VERTICAL

### Roofing
- **AOS Name**: Speed-to-Lead AOS
- **Headline**: "Stop Losing Jobs to Missed Calls"
- **Subtitle**: "2-minute form — then we show you exactly what you're leaving on the table."
- **Tone**: Urgent, competitive, time-sensitive
- **Pain Points**: Missing calls while on the roof · Losing leads to faster competitors · No follow-up after estimates · Not enough reviews
- **Comparison Role**: Office Receptionist
- **Ticker Unit**: jobs

### HVAC
- **AOS Name**: Emergency Response AOS
- **Headline**: "Emergency Calls Answered 24/7"
- **Subtitle**: "2-minute form — then we show you what after-hours calls are costing you."
- **Tone**: Professional, service-oriented, availability-focused
- **Pain Points**: Emergency calls unanswered after hours · Seasonal volume overwhelming office · Failed follow-up · Not enough reviews
- **Comparison Role**: Office Receptionist
- **Ticker Unit**: service calls

### Plumbing
- **AOS Name**: Emergency Response AOS
- **Headline**: "Burst Pipes at 2 AM — We Answer"
- **Subtitle**: "2-minute form — then we show you what missed after-hours calls cost per month."
- **Tone**: Emergency-focused, reactive, urgent
- **Pain Points**: After-hours emergencies unanswered · Losing jobs to first responder · No automated follow-up · Not enough reviews
- **Comparison Role**: Office Receptionist
- **Ticker Unit**: service calls

### Dental
- **AOS Name**: Patient Revenue AOS
- **Headline**: "Never Miss a Patient After Hours"
- **Subtitle**: "2-minute form — see how many appointments you're losing to voicemail."
- **Tone**: Care-oriented, warm, patient-focused
- **Pain Points**: After-hours calls to voicemail · New patient inquiries not followed up same day · Emergency calls lost · Manual appointment reminders
- **Comparison Role**: Front Desk Coordinator
- **Ticker Unit**: appointments

### Legal
- **AOS Name**: Legal Excellence AOS
- **Headline**: "High-Value Cases Go Cold Fast"
- **Subtitle**: "2-minute form — see how many client inquiries you're losing while in court."
- **Tone**: Professional, strategic, high-stakes
- **Pain Points**: Leads cold while attorneys in depositions · After-hours inquiries to competing firms · Slow intake process · Competitors responding faster
- **Comparison Role**: Intake Coordinator
- **Ticker Unit**: cases

### Real Estate
- **AOS Name**: Pipeline Velocity AOS
- **Headline**: "Hot Buyers Won't Wait 4 Hours"
- **Subtitle**: "2-minute form — see how many commissions you're leaving on the table."
- **Tone**: Fast-paced, performance-oriented, velocity-driven
- **Pain Points**: Hot leads going cold · After-hours inquiries unanswered · Missing 5-minute response window · Too many leads to call manually
- **Comparison Role**: Admin Assistant
- **Ticker Unit**: commissions

### Insurance
- **AOS Name**: Agency Revenue AOS
- **Headline**: "Quote Requests Sitting Unworked"
- **Subtitle**: "2-minute form — see how many policies you're losing to delayed response."
- **Tone**: Systematic, retention-focused, consistent
- **Pain Points**: Quote requests unworked for hours · After-hours to online competitors · Manual renewal follow-up · Cross-sell opportunities missed
- **Comparison Role**: Office Receptionist
- **Ticker Unit**: policies

### SaaS
- **AOS Name**: Growth Engine AOS
- **Headline**: "Trial Users Churn Before You Call"
- **Subtitle**: "2-minute form — see how much MRR you're losing to slow onboarding response."
- **Tone**: Growth-focused, conversion-optimized, data-driven
- **Pain Points**: Trial signups not contacted within 5 min · Demo requests going cold · Onboarding calls missed · Churn before first check-in
- **Comparison Role**: SDR / Sales Rep
- **Ticker Unit**: contracts

### Wholesale
- **AOS Name**: Distribution Velocity AOS
- **Headline**: "Inbound Orders Sitting in Voicemail"
- **Subtitle**: "2-minute form — see how many orders you're losing to manual delays."
- **Tone**: Operational, efficiency-focused, process-driven
- **Pain Points**: Inbound POs unacknowledged for hours · After-hours reorder calls missed · Manual entry delays/errors · Customer inquiries backing up
- **Comparison Role**: Order Desk Rep
- **Ticker Unit**: orders

### Tone Groupings
| Group | Verticals |
|---|---|
| Urgent / Competitive | Roofing, Real Estate, Legal |
| Emergency / Reactive | HVAC, Plumbing |
| Care-Oriented | Dental |
| Systematic / Operational | Insurance, Wholesale |
| Growth / Conversion | SaaS |

---

## 4. VISUAL ASSET INVENTORY

### Public Directory
```
/public
├── index.html                    Main landing page
├── roofing-leads/index.html      Roofing static vertical
├── dental/index.html             Dental static vertical
├── legal-automation/index.html   Legal static vertical
├── saas-optimization/index.html  SaaS static vertical
├── real-estate/index.html        Real estate static vertical
├── insurance-leads/index.html    Insurance static vertical
└── wholesale-leads/index.html    Wholesale static vertical
```

**Total image assets: 0** — No image files, no SVG files, no icon files.

### CSS-Generated Visual Assets
| Asset | Type | Location | Description |
|---|---|---|---|
| AmbientOrb | Canvas/CSS | `components/landing/AmbientOrb.tsx` | Cursor-reactive tri-color radial gradient (gold/indigo/amber) |
| Noise Texture | SVG filter | `globals.css` body::after | `feTurbulence` fractal noise at 0.025 opacity |
| Grid Overlay | CSS gradient | `globals.css` | 64×64px grid at 0.025 opacity |
| Logo | Text | All pages | Pure text, no image dependency |
| Sparklines | SVG polyline | `ClientDashboardView.tsx` | Gold gradient fill, dynamically rendered |
| Peak Hours Chart | Pure CSS divs | `PeakHoursBar.tsx` | 24-column percentage-height bar chart |

> **Implication for agent characters**: All visual identity must be created from scratch — no existing avatar, illustration, or photography assets exist in the repo.

---

## 5. TECHNICAL STRUCTURE

### File Organization
```
app/
├── globals.css                   Portal CSS vars + theming
├── layout.tsx                    Root layout (Inter + Instrument Sans fonts)
├── page.tsx                      Landing page (INDUSTRIES array config)
├── [vertical]/
│   ├── page.tsx                  → <VerticalIntakePage vertical="[name]" />
│   ├── pricing/page.tsx          → <VerticalPricing vertical="[name]" />
│   └── roi-calculator/page.tsx   → <VerticalROICalculator vertical="[name]" />
├── (auth)/login/page.tsx         OTP login
├── (portal)/                     Admin + client dashboard routes
└── api/                          All webhook endpoints

components/
├── landing/
│   ├── AmbientOrb.tsx
│   └── EarlyAccessForm.tsx
├── verticals/
│   ├── VerticalIntakePage.tsx    ← MASTER CONFIG for all 9 verticals
│   ├── VerticalPricing.tsx
│   └── VerticalROICalculator.tsx
└── portal/
    ├── ClientDashboardView.tsx
    ├── LiveCallToast.tsx
    ├── PeakHoursBar.tsx
    └── [20+ admin components]

public/
└── [vertical]-leads/index.html  Static HTML (Zero-Touch Policy — no Next.js compilation)
```

### Color Implementation
| Layer | Method | Scope |
|---|---|---|
| Portal UI | CSS custom properties in `globals.css` | All `app/` routes |
| Tailwind | Extended colors in `tailwind.config.ts` | `app/` components |
| Static verticals | Per-file `:root` CSS vars in `<style>` | Each `/public/*/index.html` |
| Inline styles | React inline style objects | Component-level overrides |

### Vertical Config Source of Truth
`components/verticals/VerticalIntakePage.tsx` — `CONFIGS` object:
```typescript
const CONFIGS: Record<string, VerticalConfig> = {
  roofing:       { name, headline, subtitle, painPoints, fields, tickerLabel, comparisonRole },
  hvac:          { ... },
  plumbing:      { ... },
  dental:        { ... },
  legal:         { ... },
  'real-estate': { ... },
  insurance:     { ... },
  saas:          { ... },
  wholesale:     { ... }
}
```

### Deployment
- **Hosting**: Vercel (auto-deploy on push to `master`)
- **Production URL**: `https://369agenticsystems.com`
- **Static pages**: Served directly by CDN, bypass Next.js entirely (Zero-Touch Policy)
- **Build**: Next.js 14 App Router, TypeScript, Tailwind CSS

---

## 6. AGENT CHARACTER SYSTEM — STARTER FRAMEWORK

| Vertical | Color | Tone Group | Archetype | Suggested Name | Core Virtue |
|---|---|---|---|---|---|
| Roofing | `#FF4500` Orange | Urgent | Speed Master | Swift | Instant response |
| HVAC | TBD Warm/Industrial | Emergency | Always-On Guardian | Sentinel | 24/7 availability |
| Plumbing | TBD Industrial Blue | Emergency | Crisis Responder | Rapid | Emergency response |
| Dental | `#EC4899` Rose | Care | Patient Advocate | Vera | Patient retention |
| Legal | `#60A5FA` Sky Blue | Strategic | Case Guardian | Advocate | Case value recovery |
| Real Estate | `#0EA5E9` Sky | Velocity | Lead Velocity Agent | Momentum | Conversion speed |
| Insurance | `#14B8A6` Teal | Systematic | Renewal Partner | Steady | Follow-up consistency |
| SaaS | `#8B5CF6` Purple | Growth | Onboarding Coach | Flux | Churn prevention |
| Wholesale | `#84CC16` Lime | Operational | Order Maestro | Grid | Workflow acceleration |

> Ava (roofing receptionist) is the first live deployment. All other agent names are placeholders pending character design work.

---

## 7. GAPS & NEXT STEPS

| Gap | Status | Action Needed |
|---|---|---|
| HVAC color palette | Undefined | Define before HVAC vertical launch |
| Plumbing color palette | Undefined | Define before Plumbing vertical launch |
| No formal design system doc | Missing | This file is the start |
| No image/illustration assets | None exist | Create for agent characters (AI image gen or designer) |
| No logo image file | Text only | Create SVG logo for use in emails/socials |
| Agent visual identities | Ava only (conceptual) | Generate per-agent image prompts and create assets |

---

*Generated: 2026-07-05 | Source: 369 Agentic Systems codebase audit*
*Share this file in a fresh Claude conversation to build the Agent Character System*

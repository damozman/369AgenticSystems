# 369 Agentic Systems — Complete System Blueprint

> Single source of truth for architecture, business model, technology stack, and 4-phase roadmap.
> Last updated: 2026-05-23

---

## The Business Model

**369 Agentic Systems** is a productized AI Agency (AAA) that installs autonomous "Digital Workforces" for high-ticket businesses across 8 industries. The positioning is elite — not templates, not chatbots. We deploy configured, branded agents that operate like real employees: handling lead intake, CRM logging, follow-up sequences, document generation, and appointment management — without human admin overhead.

**Revenue Model:**
- Setup fee (one-time): $2,500–$5,000 per installation
- Monthly retainer: $500–$1,500/mo for active workforce maintenance
- Target: 10 active clients = $5,000–$15,000 MRR with near-zero variable cost

**Delivery Model — Three-Channel:**
- **Landing page** (`369agenticsystems.com`) — SEO-optimized founding operator capture with 8-industry showcase and early access form
- **Client Portal** — Command Center showing agent activity, audit metrics, business memory, live feed (auth-gated)
- **Email outreach** — Automated 2-email sequence delivered to prospects + internal call brief to owner on every scan

---

## The 8 Industries

| # | Industry | AOS Name | Accent | Source Tag |
|---|----------|----------|--------|------------|
| 01 | Legal | Legal Excellence AOS | `#60A5FA` | `369AS_LEGAL_INTAKE` |
| 02 | Roofing | Speed-to-Lead AOS | `#F59E0B` | `369AS_ROOFING_INTAKE` |
| 03 | SaaS | Growth Engine AOS | `#6366F1` | `369AS_SAAS_INTAKE` |
| 04 | Dental | Patient Revenue AOS | `#EC4899` | `369AS_DENTAL_INTAKE` |
| 05 | Real Estate | Pipeline Velocity AOS | `#0EA5E9` | `369AS_REALESTATE_INTAKE` |
| 06 | Insurance | Agency Revenue AOS | `#14B8A6` | `369AS_INSURANCE_INTAKE` |
| 07 | Wholesale | Distribution Velocity AOS | `#84CC16` | `369AS_WHOLESALE_INTAKE` |
| 08 | Custom | Your Industry. Custom AOS. | `#94A3B8` | `369AS_UNLISTED_INTAKE` |

---

## Technology Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Framework | Next.js 14 (App Router), TypeScript, Tailwind CSS | Live |
| Database | Supabase (Postgres + RLS + Realtime) | Live |
| Auth | Supabase Auth — 8-digit OTP `verifyOtp` flow (no PKCE) | Live |
| Hosting | Vercel — `369agenticsystems.com` (apex = Production, www = 307 redirect) | Live |
| Email Delivery | Resend Pro — `alerts@alerts.369agenticsystems.com` FROM address | Live |
| Automation Engine | Gumloop Pro — 10-node pipeline, Gemini 2.5 Flash | Live |
| Landing Page | Next.js Server Component with glassmorphism, AmbientOrb, early access form | Live |
| Static Marketing | 8 static HTML pages in `/public` (Zero-Touch Policy — never modify) | Live |
| Agent AI Layer | Flowise (planned Phase 3) | Planned |
| Email Ingestion | SendGrid Inbound Parse / AWS SES (planned Phase 3) | Planned |

---

## The Digital Workforce (AI Org Chart)

| Role | Tool | Purpose |
|------|------|---------|
| **Claude Code** (primary engineer) | Claude Sonnet 4.6 via VS Code extension | All portal development, code, architecture |
| **Hermes** (cloud courier) | Gumloop Pro + Gemini 2.5 Flash | Scraping, audit pipelines, webhook dispatch |
| **Human Operator** | You | Strategy, client calls, deployment decisions |

**Role boundaries:**
- Claude Code writes and deploys all portal code. Does not touch `/public` static files (Zero-Touch Policy).
- Hermes runs 24/7 in the cloud, processes lead data, and POSTs structured payloads to `/api/update-dossier`.
- All AI agents have zero access to `.env.local`, private keys, or local source files.

---

## 4-Phase Roadmap

### Phase 1 — Command Center Portal ✅ COMPLETE

**Goal:** Live client portal with real-time agent activity display and auth-gated dashboard.

**Completed:**
- Next.js 14 App Router scaffold with route groups `(portal)` and `(auth)`
- Supabase `system_audits` table + webhook receiver `/api/update-dossier`
- Auth: 8-digit OTP email code (`verifyOtp`) — no PKCE, no magic links
- Dashboard: ActiveSpecialists grid, LiveFeed terminal, BusinessMemory accordion
- ScanCard component with animated scan line effect
- WARN triage system: amber row highlight, filter badge, browser push notifications
- DiagnosticDrawer: right-side panel with vulnerability vectors + AUTHORIZE AGENT PATCH
- `/api/patch-audit`: sets `leak_detected: false, payload_status: 'active'`
- CSS custom properties for dark/light theme (`html.light` toggle, localStorage persisted)
- ThemeToggle with blocking inline script (no flash on load)
- Mobile-responsive: slide-in sidebar drawer, `md:` breakpoint for desktop
- Vercel deployment live at `https://369agenticsystems.com`
- Service-role admin client + `noStore()` for cache-safe Supabase reads
- Supabase Realtime: auto-subscribes on INSERT + UPDATE, auto-retries on error

**Housekeeping (non-blocking):**
- [ ] Verify `https://369agenticsystems.com/auth/callback` is in Supabase Redirect URLs allowlist
- [ ] Wire live Gumloop webhook URL into all 8 `/public` HTML marketing pages
- [ ] Replace `YOUR_BOOKING_LINK_HERE` CTAs in marketing pages with `https://cal.com/369agentic/30min`

---

### Phase 2 — Automated Outreach + Scraper Loop ✅ FULLY LIVE (2026-05-22)

**Goal:** Gumloop scraper auto-fires webhook → dashboard card populates → email sequence fires automatically.

**Completed:**
- Gumloop 10-node pipeline: intake → AI audit → JSON sanitize → parse → merge → call brief → payload build → POST → notify
- `/api/update-dossier` coerces all string payloads to correct DB types (parseInt / parseFloat / boolean)
- Supabase Realtime: dashboard cards pop instantly on webhook receipt, zero refresh
- Custom domain wired: `369agenticsystems.com` apex on Vercel (Namecheap DNS: A `216.198.79.1`, CNAME `d79156d2f6e42fca.vercel-dns-017.com`)
- **3-email sequence fully live and tested:**
  - **Email 1** — Diagnostic Alert → prospect inbox, immediate. Metric chips (security, SEO, revenue leak), dark theme, CTA button. FROM: `369 System Scan`
  - **Email 2** — Full Dossier → prospect inbox, scheduled 5 min later via Resend `scheduledAt`. "Hello, [First]." hero, operational audit content, dual CTA. FROM: `369 Intelligence Division`
  - **Email 3** — Call Brief → owner inbox (`chris@369agenticsystems.com`), immediate. 5-section pre-call sales brief with prospect metrics, talking points, objections, recommended AOS, close script. FROM: `369 Command Center`
- Booking link: `https://cal.com/369agentic/30min` wired into all 3 email CTAs
- `early_access_list` Supabase table: landing page signups stored + owner notified via Resend
- Landing page live at root URL: glassmorphism, ambient cursor orb, 8-industry grid, SEO metadata, JSON-LD, robots.ts, sitemap.ts

**Remaining (non-blocking):**
- [ ] CRM bridge: log leads to Google Sheets alongside Supabase
- [ ] Validate all 8 industry intake forms end-to-end through Gumloop pipeline

---

### Phase 3 — Email Ingestion + Flowise Agent Layer (Planned)

**Goal:** Inbound emails trigger full autonomous agent workflows; agents log results to dashboard in real-time.

- [ ] Inbound email router (SendGrid Inbound Parse / AWS SES / Mailgun)
- [ ] `/api/email-ingest` webhook: parses raw email → routes to Flowise flow by intent
- [ ] Flowise agent flows: RESPONSE_SPEC, DOC_DRAFTER, FOLLOW_UP, APPT_GUARDIAN, CLAIMS_TRIAGE
- [ ] Agent outputs logged to `system_audits` → appear in portal LiveFeed in real-time
- [ ] `business_memory` table: per-client vault loaded into every agent context
- [ ] Wire AUTHORIZE AGENT PATCH button → Flowise webhook (replaces current direct DB patch)

**Architecture:**
```
Inbound Email → SendGrid/SES Parse → /api/email-ingest → Flowise → Agent Execution
                                                              ↓
                                                   Supabase (system_audits)
                                                              ↓
                                                    Portal LiveFeed (real-time)
```

---

### Phase 4 — Client-Facing Legitimacy Portal (Planned)

**Goal:** Each paying client sees only their own agents' activity — automated ROI proof without manual reporting.

- [ ] RLS policy: `client_domain = user's domain metadata`
- [ ] Client onboarding: invite email → OTP login → personal dashboard scoped to their data
- [ ] White-label presentation: "Your Digital Workforce" not internal tooling
- [ ] Automated monthly ROI report email generated from agent activity data

**RLS implementation:**
```sql
CREATE POLICY "clients_own_data" ON system_audits
  FOR SELECT USING (
    client_domain = (
      SELECT raw_user_meta_data->>'domain'
      FROM auth.users WHERE id = auth.uid()
    )
  );
```

---

## Data Model

### `system_audits` (live)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid DEFAULT gen_random_uuid()` | Primary key |
| `created_at` | `timestamptz DEFAULT now()` | |
| `client_domain` | `text NOT NULL` | |
| `security_score` | `int4` | 0–100 |
| `seo_visibility` | `int4` | 0–100 |
| `lead_velocity` | `int4` | Leads/day estimate |
| `leak_detected` | `bool` | Vulnerability flag |
| `roi_multiplier` | `numeric` | e.g. 4.2 |
| `payload_status` | `text` | `active` / `processing` / `idle` / `pending` |

### `early_access_list` (live)
| Column | Type | Notes |
|--------|------|-------|
| `name` | `text` | |
| `email` | `text` | |
| `business` | `text` | |
| `created_at` | `timestamptz` | |

### Planned tables
- `clients` — client accounts, domain, tier, onboarding status
- `specialists` — agent definitions per client
- `business_memory` — per-client memory vault (pain points, ROI data, insights)

---

## Email Infrastructure

| Email | Sender Name | FROM Address | To | Timing |
|-------|------------|-------------|-----|--------|
| Diagnostic Alert | 369 System Scan | `alerts@alerts.369agenticsystems.com` | Prospect | Immediate |
| Dossier | 369 Intelligence Division | `alerts@alerts.369agenticsystems.com` | Prospect | +5 min (Resend `scheduledAt`) |
| Call Brief | 369 Command Center | `alerts@alerts.369agenticsystems.com` | `chris@369agenticsystems.com` | Immediate |
| Early Access Notify | 369 Command Center | `alerts@alerts.369agenticsystems.com` | `chris@369agenticsystems.com` | Immediate |

**Note:** All emails currently use display names over `alerts@alerts.369agenticsystems.com`. Upgrade path: add `369agenticsystems.com` as a verified Resend domain to send from `intelligence@`, `scans@`, etc. directly.

---

## Key URLs

| Resource | URL |
|----------|-----|
| Landing page | `https://369agenticsystems.com` |
| Portal login | `https://369agenticsystems.com/login` |
| Dashboard | `https://369agenticsystems.com/dashboard` |
| Webhook receiver | `https://369agenticsystems.com/api/update-dossier` |
| Early access API | `https://369agenticsystems.com/api/early-access` |
| Booking link | `https://cal.com/369agentic/30min` |
| Owner email | `chris@369agenticsystems.com` |
| Alerts email | `alerts@alerts.369agenticsystems.com` |

---

## Zero-Touch Policy

The static HTML marketing files in `/public` are **never** converted to `.tsx` or modified during portal development. Vercel CDN serves them at directory URLs automatically. They are the outbound marketing face of the business; the Next.js app is the internal Command Center.

---

## Brand

- Background: Obsidian `#0A0A0A`
- Accent: Gold `#D4AF37` / Gold Light `#E8C84A`
- Tagline: *"The End of Admin. The Start of Agentic Scale."*
- Fonts: Instrument Sans (display), Inter (body), monospace (terminal / labels)
- Glass style: `backdrop-filter: blur(24px)`, `rgba(255,255,255,0.04)` bg, `rgba(148,163,184,0.11)` border
- Ambient effect: cursor-tracking radial gradient orb via `requestAnimationFrame` (lerp 0.04)
- Positioning: Premium autonomous digital workforce — not templates, not chatbots

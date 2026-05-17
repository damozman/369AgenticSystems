# 369 Agentic Systems — Complete System Blueprint

> Single source of truth for architecture, business model, and 4-phase roadmap.
> Last updated: 2026-05-16

---

## The Business Model

**369 Agentic Systems** is a productized AI Agency (AAA) that installs autonomous "Digital Workforces" for high-ticket businesses across 8 industries. The positioning is elite — not templates, not chatbots, not chat assistants. We deploy configured, branded agents that operate like real employees: handling lead intake, CRM logging, follow-up sequences, document generation, and appointment management — without human admin overhead.

**Revenue Model:**
- Setup fee (one-time): $2,500–$5,000 per installation
- Monthly retainer: $500–$1,500/mo for active workforce maintenance
- Target: 10 active clients = $5,000–$15,000 MRR with near-zero variable cost

**Delivery Model — Email-First, Dual-Channel:**
- **Client Portal** (this repo) — Command Center showing agent activity, audit metrics, business memory, live feed
- **Email outreach** — Automated HTML email reports delivered directly to client inboxes (key for client trust without requiring portal login)
- Agents operate silently in background; clients see results via both channels

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

| Layer | Technology |
|-------|-----------|
| Frontend / Portal | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Database | Supabase (Postgres + RLS + Realtime) |
| Auth | Supabase Auth — 8-digit OTP `verifyOtp` flow (no PKCE) |
| Hosting | Vercel (portal) + cPanel (static HTML marketing pages) |
| Automation Engine | Gumloop (workflow orchestration, web scraping, email) |
| Agent AI Layer | Google Gemini / Flowise (planned Phase 3) |
| Email Parsing | SendGrid / SES Inbound (planned Phase 3) |
| Marketing HTML | 8 static single-file HTML pages in `/public` (Zero-Touch Policy) |

---

## 4-Phase Roadmap

### Phase 1 — Command Center (75–80% Complete as of 2026-05-16)

**Goal:** Live client portal with real-time agent activity display and auth-gated dashboard.

**Completed:**
- Next.js 14 App Router scaffold with route groups `(portal)` and `(auth)`
- Supabase `system_audits` table with webhook receiver (`/api/update-dossier`)
- Auth: 8-digit OTP email code (`verifyOtp`) — no PKCE, no magic links
- Dashboard: ActiveSpecialists grid (real-time), LiveFeed (simulated + real-time), BusinessMemory accordion
- ScanCard component with animated scan line effect
- CSS custom properties for dark/light theme (`html.light` toggle)
- ThemeToggle persisted to localStorage with blocking inline script (no flash)
- Mobile-responsive: slide-in sidebar drawer via PortalShell, `md:` breakpoint for desktop
- Vercel deployment live at `https://369-agentic-systems.vercel.app`
- Service-role admin client + `noStore()` for cache-safe Supabase reads
- Real-time Supabase channel subscriptions on `system_audits` INSERT

**Remaining (Phase 1 completion):**
- Add `id UUID DEFAULT gen_random_uuid()` column to `system_audits` table in Supabase SQL editor
- Re-enable "Confirm Email" in Supabase Authentication → Email settings
- Verify `https://369-agentic-systems.vercel.app/auth/callback` in Supabase Redirect URLs
- Increase dashboard font sizes for better legibility
- Wire `GUMLOOP_WEBHOOK_URL_HERE` placeholder in all 8 HTML marketing pages
- Replace `YOUR_BOOKING_LINK_HERE` in CTAs with live calendar URL

---

### Phase 2 — Automated Outreach + Scraper Loop (Next Up)

**Goal:** Gumloop scraper auto-fires webhook payloads → dashboard populates automatically → HTML email reports sent to prospects.

**Key deliverables:**
- Gumloop workflow: scrape prospect domain → run audit metrics → POST to `/api/update-dossier`
- Dashboard cards auto-populate on scraper run (zero manual data entry)
- Branded HTML email template with embedded metrics (security score, SEO visibility, ROI multiplier)
- Email sent automatically after scraper completes — client sees results in inbox without portal login
- CRM bridge: lead logging to Google Sheets or CRM alongside Supabase

**The "Wow Moment" Pattern:**
Prospect receives cold email → opens it → sees their own domain's metrics → clicks through to portal → sees live agent activity → books a call. The email IS the trust-builder; the portal IS the close.

---

### Phase 3 — Email Ingestion + Flowise Agent Layer (Planned)

**Goal:** Inbound emails from clients/prospects trigger agent workflows automatically.

**Key deliverables:**
- Inbound email router via SendGrid Inbound Parse / AWS SES / Mailgun
- Webhook endpoint receives raw email → extracts intent → routes to correct Flowise flow
- Flowise agent flows for each specialist archetype:
  - `RESPONSE_SPEC`: Lead qualification + immediate reply
  - `DOC_DRAFTER`: Onboarding dossier / proposal generation
  - `FOLLOW_UP`: Day-2 / Day-7 sequence management
  - `APPT_GUARDIAN`: Calendar slot offering and confirmation
  - `CLAIMS_TRIAGE`: Insurance/legal pre-qualification
- Agent outputs logged to `system_audits` → appear in portal Live Feed in real-time
- Business Memory vault (`business_memory` table) loaded into every agent context automatically

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

**Goal:** Each paying client gets their own scoped view of their agents' activity — proving ROI without manual reporting.

**Key deliverables:**
- RLS policy: `.eq('client_domain', user_domain)` — each client only sees their own data
- Client onboarding flow: invite email → OTP login → personal dashboard with their metrics
- White-label-ready: client sees "Your Digital Workforce" not "369 Agentic Systems internals"
- Automated monthly ROI report email from agent data
- Upgrade path from Phase 2 (we see all data) to Phase 4 (client sees their slice)

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

### `system_audits` (live, Supabase)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid DEFAULT gen_random_uuid()` | Add via SQL if missing |
| `created_at` | `timestamptz DEFAULT now()` | |
| `client_domain` | `text NOT NULL` | Scraped/entered domain |
| `security_score` | `int4` | 0–100 |
| `seo_visibility` | `int4` | 0–100 |
| `lead_velocity` | `int4` | Leads/day estimate |
| `leak_detected` | `bool` | Data breach flag |
| `roi_multiplier` | `numeric` | e.g. 4.2x |
| `payload_status` | `text` | `active` / `processing` / `idle` |

### Planned tables
- `clients` — client accounts, domain, tier, onboarding status
- `specialists` — agent definitions per client
- `dossier_logs` — generated documents log
- `business_memory` — per-client memory vault (pain points, ROI data, insights)

---

## Zero-Touch Policy

The static HTML marketing files in `/public` are **never** converted to `.tsx` or modified during portal development. Vercel CDN serves them at directory URLs automatically. They are the outbound marketing face of the business; the Next.js app is the internal Command Center.

---

## Key URLs

- **Portal (live):** `https://369-agentic-systems.vercel.app`
- **Login:** `/login` (`app/(auth)/login/page.tsx`)
- **Dashboard:** `/dashboard` (`app/(portal)/dashboard/page.tsx`)
- **Webhook receiver:** `/api/update-dossier` (`app/api/update-dossier/route.ts`)
- **Auth callback:** `/auth/callback` (`app/auth/callback/route.ts`) — PKCE handler, not used for OTP auth but must exist for future OAuth

---

## Brand

- Background: Obsidian `#0A0A0A`
- Accent: Gold `#D4AF37`
- Tagline: "The End of Admin. The Start of Agentic Scale."
- Fonts: Instrument Sans (display), Inter (body), Courier New / monospace (terminal)
- Positioning: Premium digital workforce — not templates, not chatbots
- Tesla 369 reference: part of brand backstory in "Why 369" section

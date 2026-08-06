# 369 Agentic Systems — Claude Memory File
**Master Context for Claude VS Sessions**
**Last Updated:** 2026-05-23

---

## 1. PROJECT OVERVIEW

**What is this project?**
369 Agentic Systems is a productized AI Agency that deploys autonomous "Digital Workforces" for high-ticket businesses across 8 industries (roofing, legal, SaaS, dental, real estate, insurance, wholesale, custom). The platform automatically scans prospect websites, identifies revenue gaps, and initiates AI-powered lead response sequences.

**Business Model:**
- **Setup fee:** $2,500–$5,000 per client installation
- **Monthly retainer:** $500–$1,500/mo per client
- **Target:** 10 active clients = $5,000–$15,000 MRR with near-zero variable cost
- **Delivery:** White-glove, branded portal + automated agent workflows (Phases 1-4)

**Current Phase:** Phase 1-2 Completion Sprint (Target: Launch by EOW 2026-05-30)
- Phase 1 ✅ LIVE: Command Center portal with auth, dashboard, Realtime
- Phase 2 ✅ LIVE: Automated Gumloop pipeline + 3-email sequence
- Phase 3 🚫 BLOCKED: Email ingestion + Flowise agents (TBD after first customers)
- Phase 4 🚫 BLOCKED: Client-facing portal + RLS (TBD after Phase 3)

**Tech Stack:**
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth with OTP, Realtime subscriptions)
- **Hosting:** Vercel (production at 369agenticsystems.com)
- **Automation:** Gumloop Pro (10-node pipeline, Gemini 2.5 Flash)
- **Email:** Resend Pro (alerts@alerts.369agenticsystems.com)
- **Planning (Phase 3):** Flowise + Gemini 2.5 Pro for agent orchestration
- **Build approach:** Cursor IDE (with Claude Code for development)

**Key URLs & Access:**
- **Live product:** https://369agenticsystems.com
- **Client portal (auth):** https://369agenticsystems.com/login
- **Dashboard (gated):** https://369agenticsystems.com/dashboard
- **Booking link (for sales calls):** https://cal.com/369agentic/30min
- **Owner email (for call briefs):** chris@369agenticsystems.com
- **Alerts email (for automations):** alerts@alerts.369agenticsystems.com
- **Supabase console:** https://app.supabase.com (select 369agentic project)
- **Gumloop dashboard:** https://app.gumloop.com

**The 8 Industry Verticals:**
| # | Industry | Public Folder | Live URL | Source Tag |
|---|----------|--------------|----------|------------|
| 01 | Legal | `public/legal-automation/index.html` | `/legal-automation/` | `369AS_LEGAL_INTAKE` |
| 02 | Roofing | `public/roofing-leads/index.html` | `/roofing-leads/` | `369AS_ROOFING_INTAKE` |
| 03 | SaaS | `public/saas-optimization/index.html` | `/saas-optimization/` | `369AS_SAAS_INTAKE` |
| 04 | Dental | `public/dental/index.html` | `/dental/` | `369AS_DENTAL_INTAKE` |
| 05 | Real Estate | `public/real-estate/index.html` | `/real-estate/` | `369AS_REALESTATE_INTAKE` |
| 06 | Insurance | `public/insurance-leads/index.html` | `/insurance-leads/` | `369AS_INSURANCE_INTAKE` |
| 07 | Wholesale | `public/wholesale-leads/index.html` | `/wholesale-leads/` | `369AS_WHOLESALE_INTAKE` |
| 08 | Custom | *(no dedicated page — modal on homepage)* | `/` | `369AS_UNLISTED_INTAKE` |

**Key Features (Phase 1-2):**
- **Landing pages:** Glassmorphism design with ambient cursor orb, 8 industry-specific forms
- **Authentication:** Supabase OTP email (8-digit code, no passwords)
- **Dashboard:** 
  - ActiveSpecialists grid (shows real audit cards in real-time)
  - LiveFeed terminal (shows agent activity + warnings)
  - BusinessMemory accordion (insights per client)
  - DiagnosticDrawer (right-side panel with vulnerability details + patch authorization)
- **Email sequences:** 3-email automated flow
  - Email 1: Diagnostic Alert (scan results, metrics)
  - Email 2: Full Dossier (detailed audit, ROI analysis)
  - Email 3: Call Brief (internal sales brief for owner)
- **Webhook integration:** `/api/update-dossier` receives Gumloop payloads, inserts into Supabase
- **Realtime sync:** Dashboard updates instantly when new audit data arrives (Supabase Realtime)
- **Responsive design:** Mobile-friendly sidebar, desktop-optimized dashboard

**How It Works (Customer Journey):**
1. Prospect discovers landing page (e.g., `/roofing-leads`)
2. Fills out form (name, email, business, etc.)
3. Form submits to Gumloop webhook
4. Gumloop pipeline runs (10 nodes): scrape domain → AI analysis → JSON sanitize → parse → merge → call brief generation → email payload build → POST to `/api/update-dossier`
5. `/api/update-dossier` receives payload, inserts audit record into Supabase
6. Dashboard Realtime subscription fires, new card appears in portal (live, no refresh needed)
7. 3-email sequence fires automatically:
   - Diagnostic Alert (immediate)
   - Full Dossier (5 mins later)
   - Call Brief (to owner's email, immediate)
8. Owner takes discovery call with prospect
9. Close deal or schedule follow-up

**Success Metrics (What We Track):**
- Security score (0-100): Website vulnerability assessment
- SEO visibility (0-100): Search presence evaluation
- Lead velocity: Estimated leads/day the prospect is losing
- ROI multiplier: Estimated revenue recovery multiple (e.g., 4.2x)
- Leak detected: Binary flag (vulnerability found? yes/no)
- Payload status: `active`, `processing`, `idle`, `pending`

**Revenue Opportunity:**
- Phase 1-2 product is ready to sell today
- Each new client: +$500-1,500/mo MRR (depends on retainer tier)
- 10 clients = $5K-15K MRR (target within 6 months)
- Near-zero marginal cost per client (Gumloop + Supabase already pay-as-you-go)
- High-margin service (70-90% gross margin typical for AI agencies)

**Why This Business Model?**
- **Defensible:** Agents are customized per client, not a generic SaaS template
- **Recurring:** Monthly retainers = predictable MRR
- **Scalable:** One codebase, one pipeline, many clients
- **Timely:** AI agencies are hot (18-24 month window before commoditization)
- **Positioning:** Premium (done-for-you), not DIY (client configures themselves)




---




## 2. CURRENT PROJECT STATE (Update This Weekly)

**Last Updated:** 2026-05-24
**Sprint Status:** Phase 3 Build Sprint (Starting)
**Decision:** Skip waiting for first customer — build Phase 3 now with Claude API (not Flowise)

---

### What's DONE ✅

- [x] Next.js 14 portal scaffold (App Router, route groups, TypeScript)
- [x] Supabase auth system (OTP email flow, 8-digit verification code)
- [x] Session management (JWT tokens, middleware protection on `/dashboard`)
- [x] Dashboard components (ActiveSpecialists grid, stat cards, LiveFeed terminal)
- [x] Realtime subscription (Supabase Realtime, auto-retry on failure, tab visibility handling)
- [x] Webhook receiver `/api/update-dossier` (POST endpoint, fully functional, tested)
- [x] Email infrastructure (Resend Pro, 5-email sequence working end-to-end)
- [x] Gumloop pipeline (10-node automation, Gemini 2.5 Flash, tested with live data)
- [x] Landing page (glassmorphism, ambient cursor orb, 8-industry grid)
- [x] Static marketing pages (`/public/*.html` — 8 industry pages with forms)
- [x] Custom domain setup (369agenticsystems.com on Vercel)
- [x] DNS configuration (Namecheap A record + CNAME for Vercel)
- [x] Production deployment (live at https://369agenticsystems.com)
- [x] Database schema (system_audits, early_access_list tables created)
- [x] Supabase RLS policies (basic, working for now)
- [x] Vercel environment variables (Supabase keys, Resend key, Gumloop URL stored)
- [x] Git repo initialized (code committed, ready for CI/CD)
- [x] **Task 2.1:** Stat cards replaced with real Supabase COUNT queries (no fake numbers)
- [x] **Task 2.2:** LiveFeed simulation loop removed — real Supabase Realtime only, "awaiting events" idle state added
- [x] **Task 2.3:** BusinessMemory labeled with DEMO DATA badge + "activates in Phase 3" footer
- [x] Cal.com booking link added to success messages in all 8 `/public` marketing pages
- [x] Day-2 and Day-7 follow-up emails added to `/api/update-dossier` (5 total per lead)
- [x] LeadsTable component added to dashboard (search, status filter, Realtime, sortable)
- [x] Resend webhook receiver `/api/resend-webhook` (signature verification, stores to `email_events`)
- [x] Gumloop Pro wiring instruction written (`docs/gumloop-webhook-wiring-instruction.md`)
- [x] **Session 3:** Full 5-email sequence debugged + confirmed working end-to-end
- [x] **Session 3:** `renderBriefMarkdown()` added to `lib/email-templates.ts` (markdown → HTML for call brief)
- [x] **Session 3:** Revenue Leak chip color fixed to gold (`#D4AF37`) in call brief email
- [x] **Session 3:** Sending address changed to `command@alerts.369agenticsystems.com`
- [x] **Session 3:** Gumloop Send Email node cleaned up (no raw server response in notification)
- [x] **Session 3:** Phase 3 architecture decided — Claude API direct, no Flowise, no Docker

---

### What's IN PROGRESS 🔄

- **Phase 3:** Email ingestion → Claude API response drafting → dashboard approval UI (7-day build)

---

### What's BLOCKED ❌

- **Task 1.1 — Wire Gumloop webhook URL into 8 marketing pages:** BLOCKED on Gumloop Pro upgrade. Instruction written at `docs/gumloop-webhook-wiring-instruction.md`. Do this the moment Pro is activated.
- **Phase 4 (Client-facing Portal + RLS):** Depends on Phase 3

---

### What's NOT STARTED / MANUAL 🚫

- **Phase 3 — Day 1 prerequisites (do these first, DNS takes 24-48hr):**
  1. Create free SendGrid account → add MX record `respond.369agenticsystems.com` in Namecheap
  2. Add `ANTHROPIC_API_KEY` to Vercel env vars
  3. DNS propagation takes 24-48hr — start immediately
- **Gumloop Pro upgrade** → wire `GUMLOOP_WEBHOOK_URL_HERE` into 8 marketing pages + homepage modal
- **`email_events` table + `RESEND_WEBHOOK_SECRET`:** Defer until after first customers (pair, not blocking)
- **End-to-end funnel test:** Submit a form → Gumloop → portal card → emails (after Gumloop Pro)
- **Sales infrastructure:** Cold email templates (roofing/dental/legal), discovery call script, pricing tiers doc, basic MSA/SOW
- **Lead database:** 50-100 prospects across target verticals
- Phase 4 (Client portal with RLS)

---

### SPRINT PROGRESS TRACKER

```
Phase 1-2 Code: ✅ COMPLETE
Phase 3 Build: 🔄 IN PROGRESS
Manual prerequisites before Phase 3 code:
- [ ] Create SendGrid account + MX record for respond.369agenticsystems.com (START NOW — 24-48hr DNS)
- [ ] Add ANTHROPIC_API_KEY to Vercel env vars
- [ ] Upgrade Gumloop to Pro + wire webhook URLs (8 pages)
- [ ] Create email_events table in Supabase (defer)
- [ ] Add RESEND_WEBHOOK_SECRET to Vercel env vars (defer)
- [ ] End-to-end funnel test (after Gumloop Pro)
```




---




## 3. SESSION NOTES

**Purpose:** Track what was accomplished in each Claude session, blockers encountered, and what's next. Update this after each work session so future sessions have fresh context.

**How to Use:**
- After you finish a work session, spend 5 minutes updating this section
- Write what you did, what worked, what blocked you, and what's next
- Keep brief but specific (not a journal, but not vague either)
- Paste the relevant sections from this file at the top of your next Claude session for instant context

---

### Session 1: Memory File Setup (2026-05-23)
**Duration:** 30 minutes
**Focus:** Create and populate `.claude-memory.md`

**What Happened:**
- Created `.claude-memory.md` in project root
- Populated Section 1 (Project Overview)
- Populated Section 2 (Current Project State)
- Set up Section 3 (Session Notes) template
- Committed to Git

**Completed:**
- [x] Memory file created and structured
- [x] Sections 1-3 populated
- [x] Committed to Git

**Blockers:** None

**Next Session:** Start Task 1.1 (wire marketing page webhooks)

---

### Session 2: Phase 1-2 Completion Sprint (2026-05-23)
**Duration:** ~3 hours
**Focus:** Make the product honest and feature-complete before sales outreach

**What Happened:**
- Ran through all 8 pending Phase 1-2 tasks
- Removed all fake/hardcoded data from the dashboard
- Added real email follow-up sequence (Day 2 + Day 7)
- Added full leads database view to dashboard
- Added Resend email event tracking infrastructure
- Wrote Gumloop wiring instruction for when Pro is activated
- Updated all 8 marketing pages with booking link CTA

**Completed:**
- [x] Stat cards → real Supabase COUNT queries
- [x] LiveFeed → simulation loop removed, real-only with idle state
- [x] BusinessMemory → DEMO DATA badge, Phase 3 note in footer
- [x] All 8 `/public` marketing pages → cal.com booking link in success message
- [x] Day-2 + Day-7 follow-up emails → `followUpHtml()` template + wired into route
- [x] LeadsTable component → domain search, status filter, Realtime, added to dashboard
- [x] `/api/resend-webhook` → signature verification, stores email events to Supabase
- [x] Gumloop Pro wiring instruction → `docs/gumloop-webhook-wiring-instruction.md`

**Blockers:**
- Gumloop Pro webhook URL not available (still on free plan) — instruction written, blocked until upgrade

**Code Changes:**
- `app/(portal)/dashboard/page.tsx` — real Supabase counts, added LeadsTable
- `components/portal/LiveFeed.tsx` — removed SEED_LOGS, LIVE_QUEUE, setInterval
- `components/portal/BusinessMemory.tsx` — DEMO DATA badge + Phase 3 footer note
- `components/portal/LeadsTable.tsx` — NEW: full leads database table component
- `lib/email-templates.ts` — added `FollowUpVars` + `followUpHtml()` (Day 2 / Day 7)
- `app/api/update-dossier/route.ts` — added Day-2 and Day-7 email sends (5 emails total per lead)
- `app/api/resend-webhook/route.ts` — NEW: Resend email event receiver
- `public/*/index.html` (all 8) — booking link added to success terminal output
- `docs/gumloop-webhook-wiring-instruction.md` — NEW: step-by-step Pro wiring guide

**Key Insights:**
- `.claude-memory.md` just needs "read .claude-memory.md" at session start — no pasting needed
- Resend `scheduledAt` accepts ISO 8601 timestamps (use `new Date(Date.now() + N).toISOString()`)
- Zero-Touch Policy: `/public` HTML files are editable for content, just never converted to `.tsx`

**Next Session:**
- Upgrade Gumloop to Pro → follow `docs/gumloop-webhook-wiring-instruction.md`
- Create `email_events` table in Supabase (DDL in `/api/resend-webhook/route.ts` comments)
- Set `RESEND_WEBHOOK_SECRET` in Vercel env vars after creating Resend webhook
- Run end-to-end funnel test
- Start sales outreach

---

**TEMPLATE FOR FUTURE SESSIONS:**
Copy this format after each work session:

```
### Session N: [TITLE] (DATE)
**Duration:** [TIME]
**Focus:** [What you're working on]

**What Happened:**
[What you did]

**Completed:**
- [x] [Task] (STATUS)

**Blockers:**
[Any issues?]

**Code Changes:**
[Files changed?]

**Validation:**
- [x] [Test] ✅

**Key Insights:**
[What you learned]

**Next Session:**
[What's next?]
```

---

---

### Session 3: Email Pipeline Debug + Phase 3 Architecture (2026-05-23)
**Duration:** ~4 hours
**Focus:** Debug Resend email failures, improve email quality, decide Phase 3 direction

**What Happened:**
- Debugged all 5 emails failing with 422 "Invalid `from` field" — root cause: `RESEND_FROM_EMAIL` Vercel env var was malformed. Fixed by setting it to bare email `command@alerts.369agenticsystems.com`
- Renamed sending address from `alerts@alerts.369agenticsystems.com` → `command@alerts.369agenticsystems.com` (cleaner, no repetition)
- Confirmed full 5-email sequence fires correctly: Diagnostic Alert, Dossier (+5min), Call Brief (owner), Day-2 (+48hr), Day-7 (+7days)
- Added `renderBriefMarkdown()` to `lib/email-templates.ts` — line-by-line markdown processor (headers, bullets, sub-bullets, bold, paragraphs) for call brief email rendering
- Fixed Revenue Leak chip color from green → gold (`#D4AF37`) for brand consistency in call brief
- Provided enhanced Gumloop call brief prompt (section-by-section dossier mirror) for user to paste into Gumloop
- Cleaned Gumloop Send Email notification node — removed raw server response from body
- Assessed Phase 3 architecture: Claude API direct wins over Flowise (no Docker, simpler, faster)
- Decision: Build Phase 3 NOW, not after first customer. 7-day build plan agreed.

**Completed:**
- [x] All 5 Resend emails firing correctly ✅
- [x] `renderBriefMarkdown()` function in `lib/email-templates.ts` ✅
- [x] Revenue Leak chip gold color in call brief ✅
- [x] Sending address → `command@alerts.369agenticsystems.com` ✅
- [x] Gumloop notification email cleaned ✅
- [x] Phase 3 architecture decided: Claude API, no Flowise ✅

**Blockers:**
- Gumloop Pro still needed for inbound webhook wiring on 8 marketing pages
- Flowise Docker container lost (fresh install needed) — moot since we're using Claude API instead

**Code Changes:**
- `lib/email-templates.ts` — added `renderBriefMarkdown()`, replaced old `briefHtml` computation, fixed Revenue Leak chip to gold

**Key Insights:**
- `RESEND_FROM_EMAIL` in Vercel env must be bare email only (`email@domain.com`), never `Name <email>` — the route wraps it itself
- Resend `scheduledAt: 'in 5 min'` works (string shorthand), ISO 8601 also works
- Flowise dependency on Docker is a real maintenance burden — Claude API is cleaner for this use case
- Phase 3 critical path starts with DNS: MX record for `respond.369agenticsystems.com` takes 24-48hr, must start before writing code
- `email_events` table + `RESEND_WEBHOOK_SECRET` are a pair — defer both until after first customers

**Next Session:**
1. Confirm: SendGrid account created? MX record added for `respond.369agenticsystems.com`?
2. Confirm: `ANTHROPIC_API_KEY` added to Vercel?
3. If DNS propagated → begin Phase 3 Day 2: build `/api/email-ingest` endpoint

---

**Last Updated:** 2026-05-24 (Session 3)
**Owner:** Chris
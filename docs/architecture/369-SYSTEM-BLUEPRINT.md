# 369 Agentic Systems — System Blueprint
**Single source of truth for architecture, business model, and current build state.**
Last rewritten: 2026-07-10, refreshed 2026-07-16 (the 2026-07-10 version's agent live/planned table and "Known Gap" section were badly stale — both corrected below. Replaces the 2026-05-23 version, which described a pre-pivot product — email-diagnostic scans, Flowise, 8 industries, no real receptionist. None of that reflects the live business anymore.)

> **2026-07-16 correction:** two things in this doc were significantly out of date until today. First, the agent table below said Rex/Nova were only live for roofing/HVAC/plumbing — that was true as of 2026-07-10 but has been closed since 2026-07-14; Rex/Nova now run in all 9 verticals. Second, "The Known Gap" section below claimed provisioning was still manual — that's been fully automated and repeatedly verified against real signups since 2026-07-13. Anyone reading the pre-2026-07-16 version of this doc would have been working from a materially wrong picture of the product. For the detailed, dated history of everything built since 2026-07-10, see `docs/architecture/ROADMAP-TO-REAL-AGENCY.md` (the living tracker — start there each session) and `docs/reference/changelog-recent-sessions.html`.

> For day-to-day coding rules and file layout, see `CLAUDE.md` in the project root — that's what Claude Code reads automatically every session. This doc is the higher-level "what is this business and how is it built" reference for humans and for onboarding a new AI session from scratch.

---

## The Business Model

369 Agentic Systems sells a done-for-you **AI receptionist + follow-up system** to service businesses across 9 verticals. The core product: a voice agent (Ava) answers every inbound call 24/7, qualifies the caller, and books the job — plus two generic automation agents (Rex, Nova) that follow up on captured leads and confirm bookings by email. Two vertical-exclusive agents exist: Felix (legal-only conflict check) and Scout (SaaS-only competitor intelligence, not yet built).

**Pricing** (single source of truth: `lib/tier-config.ts`):
- Starter — $400/mo
- Pro — $600/mo (featured tier)
- Elite — $750/mo
- + $1,500 one-time setup fee

**The 9 verticals:** roofing, hvac, plumbing, legal, real-estate, insurance, saas, wholesale, dental (dental is waitlist-only — see below; saas is fully built and live but deliberately deprioritized from active promotion as of 2026-07-16 — the page and funnel still work, just unlinked from marketing. See `pending_items.md` in memory and item under "Known, deliberate gaps" in the changelog).

---

## What's Actually Live vs. Planned, By Agent

This table is the one thing worth keeping perfectly accurate — it's the exact thing multiple truthfulness sweeps (2026-07-07, 2026-07-10, and 2026-07-14) had to keep correcting across the marketing pages. Check `app/agents/[agent]/page.tsx` and `components/agents/AgentCard.tsx` for the authoritative version; this is a snapshot.

| Agent | Real mechanism | Live for | Planned for |
|---|---|---|---|
| **Ava** | 24/7 voice call answering, qualifies, books (Retell AI) | All 9 verticals (dental excluded — no live number yet) | — |
| **Rex** | Day-0/3/7 personalized follow-up email, vertical-specific copy, on any captured lead | All 9 verticals (closed 2026-07-14 — previously roofing/HVAC/plumbing only) | — |
| **Nova** | Booking-confirmation email, generated live per-booking via Claude with vertical-specific framing | All 9 verticals (closed 2026-07-14 — previously roofing/HVAC/plumbing only) | — |
| **Felix** | Automated conflict screen on new intake + attorney email alert (not a hard gate) | Legal only | — |
| **Scout** | Weekly competitor content-gap report (Firecrawl-based) | Nowhere | SaaS only |

Rex/Nova's content was written per-vertical from the start, but the switch that actually activates a vertical was only ever flipped on for roofing/HVAC/plumbing — the other 6 verticals' content sat unreachable by any real call until 2026-07-14. Any marketing copy claiming otherwise before that date was wrong; see `docs/reference/removed-agent-abilities-reference.html` for the running list of what's been caught and fixed, and Era 8 of `docs/reference/changelog-recent-sessions.html` for how this specific gap was found and closed.

**Dental** is waitlist-only. Zero agents deployed — its Retell template agent ID doesn't point to a real agent yet (deliberately deferred, not a bug). The `/dental-leads/` page and `/dental` Next.js route both say so honestly.

**New since 2026-07-14:** clients now get a real-time email alert (not just a dashboard stat) the moment a new lead or booking happens — separate from Rex/Nova, sent to the client's own account email with tap-to-call/mailto links, a dashboard button, and a universal `.ics` calendar attachment on bookings.

---

## Technology Stack

| Layer | Technology | Status |
|---|---|---|
| Framework | Next.js 14 (App Router), TypeScript, Tailwind | Live |
| Database | Supabase (Postgres + RLS + Realtime) | Live |
| Auth | Supabase OTP, middleware-guarded `/dashboard` | Live |
| Hosting | Vercel — `369agenticsystems.com`, auto-deploy from `master` | Live |
| Voice agent | Retell AI (Ava), shared demo line classifies caller industry live | Live |
| Email delivery | Resend | Live |
| Payments | Stripe — test mode only, live mode not started (Chris's choice) | Test mode |
| Static marketing | 9 static HTML pages in `/public` (Zero-Touch Policy — edit as raw HTML, never route through Next.js) | Live |
| Cold-email funnel | Gumloop Pro pipeline, differentiated by `source_tag` (`369AS_{VERTICAL}_INTAKE`) | Live |

Flowise, SendGrid Inbound Parse, and the old "Hermes/CEO Agent" Gemini org-chart concept from earlier planning docs were never built and aren't part of the real stack — dropped from this doc for that reason.

---

## Two Parallel Funnels

1. **Static cold-email funnel** (`public/{vertical}-leads/index.html`) — pure HTML, Gumloop webhook, 3-email sequence. Zero-Touch: edit these files directly as HTML, never compile them through Next.js.
2. **Next.js warm funnel** — ROI calculator → pricing → Stripe checkout → client dashboard. Shared components (`VerticalIntakePage`, `VerticalROICalculator`, `VerticalPricing`) take `vertical` as the only prop; core logic is vertical-agnostic.

See `funnel_architecture` in project memory for the full breakdown of what fires when.

---

## Client Portal

- Auth: Supabase OTP, two theme keys (admin dark / client light) — admin theme must never leak into client view
- Full client dashboard: sparkline, sentiment, peak hours, live call toast, industry benchmarks, CSV export, onboarding checklist
- Real clients and internal admin view are role-separated (fixed 2026-07-07 — previously all logins landed on the admin view)
- A narrower version of the same class of bug resurfaced 2026-07-16: `/admin` (the multi-client business dashboard, see Key URLs) was missing from `middleware.ts`'s admin-only route gate entirely, so any real logged-in client could have navigated straight to it and seen every other client's revenue and churn data. Fixed and verified with real Supabase sessions — see item under "Month 2" in the roadmap doc.

---

## What Used To Be The Known Gap (closed 2026-07-13/14)

As of 2026-07-10, there was no automation connecting a Stripe payment to a real per-client Retell agent/phone number — every new client was provisioned manually. **That's no longer true.** A Stripe payment now automatically creates a dedicated Retell agent (with a personalized greeting on its own LLM, not a shared template) and phone number, writes the correct database row, and correctly attributes that customer's inbound calls — confirmed via multiple real signups, most recently 2026-07-14 with zero manual intervention end-to-end (payment → provisioning → personalization → a real call → a real booking → real client-facing alerts). See `retell_provisioning_gaps_2026-07-13.md` (memory) and Era 7-8 of `docs/reference/changelog-recent-sessions.html` for the full history, including the three real bugs (schema drift, wrong Retell API endpoints, a version-field rejection) found and fixed getting here.

**What's still genuinely a gap:** Stripe itself is test-mode only (Chris's deliberate choice, not a technical blocker), and the questionnaire-driven deeper personalization, live call transfer, and transcript search are all real and verified — but SMS follow-up (Pro tier) is blocked on Twilio not being configured, and the admin's multi-client business dashboard was only verified (and had a real access-control bug fixed) as of 2026-07-16. Check `docs/architecture/ROADMAP-TO-REAL-AGENCY.md` for the current, authoritative state of every open item — don't treat this doc as more current than that one.

---

## Key URLs

| Resource | URL |
|---|---|
| Homepage | `https://369agenticsystems.com` (served from `public/index.html` via `app/route.ts`) |
| Client dashboard | `https://369agenticsystems.com/client-dashboard` |
| Admin dashboard (Command Center — operations) | `https://369agenticsystems.com/dashboard` |
| Admin dashboard (multi-client business/revenue view) | `https://369agenticsystems.com/admin` |
| Booking link | `https://cal.com/369agentic/30min` |
| Owner email | `chris@369agenticsystems.com` |
| Demo receptionist number | `(817) 635-0220` |

---

## Brand

- Background: Obsidian `#0A0A0A` · Gold accent `#D4AF37`
- Fonts: Instrument Sans (display), Inter (body), Courier New (mono/terminal)
- Glass cards: `rgba(255,255,255,0.03)` bg, `backdrop-filter: blur`
- Tagline: *"The End of Admin. The Start of Agentic Scale."*
- Vertical palette and agent status colors: see `CLAUDE.md`

# 369 Agentic Systems — System Blueprint
**Single source of truth for architecture, business model, and current build state.**
Last rewritten: 2026-07-10 (replaces the 2026-05-23 version, which described a pre-pivot product — email-diagnostic scans, Flowise, 8 industries, no real receptionist. None of that reflects the live business anymore.)

> For day-to-day coding rules and file layout, see `CLAUDE.md` in the project root — that's what Claude Code reads automatically every session. This doc is the higher-level "what is this business and how is it built" reference for humans and for onboarding a new AI session from scratch.

---

## The Business Model

369 Agentic Systems sells a done-for-you **AI receptionist + follow-up system** to service businesses across 9 verticals. The core product: a voice agent (Ava) answers every inbound call 24/7, qualifies the caller, and books the job — plus two generic automation agents (Rex, Nova) that follow up on captured leads and confirm bookings by email. Two vertical-exclusive agents exist: Felix (legal-only conflict check) and Scout (SaaS-only competitor intelligence, not yet built).

**Pricing** (single source of truth: `lib/tier-config.ts`):
- Starter — $400/mo
- Pro — $600/mo (featured tier)
- Elite — $750/mo
- + $1,500 one-time setup fee

**The 9 verticals:** roofing, hvac, plumbing, legal, real-estate, insurance, saas, wholesale, dental (dental is waitlist-only — see below).

---

## What's Actually Live vs. Planned, By Agent

This table is the one thing worth keeping perfectly accurate — it's the exact thing two separate truthfulness sweeps (2026-07-07 and 2026-07-10) had to keep correcting across the marketing pages. Check `app/agents/[agent]/page.tsx` for the authoritative version; this is a snapshot.

| Agent | Real mechanism | Live for | Planned for |
|---|---|---|---|
| **Ava** | 24/7 voice call answering, qualifies, books (Retell AI) | All 9 verticals (dental excluded — no live number yet) | — |
| **Rex** | Day-0/3/7 personalized follow-up email on any captured lead | Roofing, HVAC, Plumbing | Legal, Real Estate, Insurance, SaaS, Wholesale |
| **Nova** | Single templated booking-confirmation email | Roofing, HVAC, Plumbing | Legal, Real Estate, Insurance, SaaS, Wholesale |
| **Felix** | Automated conflict screen on new intake + attorney email alert (not a hard gate) | Legal only | — |
| **Scout** | Weekly competitor content-gap report (Firecrawl-based) | Nowhere | SaaS only |

**Neither Rex nor Nova do anything vertical-specific** (no drafting, no claims triage, no inventory alerts, no renewal tracking, no SEO content) — same generic mechanism reworded per vertical. Any marketing copy that says otherwise is wrong; see `docs/reference/removed-agent-abilities-reference.html` for the running list of what's been caught and fixed.

**Dental** is waitlist-only. Zero agents deployed. The `/dental-leads/` page and `/dental` Next.js route both say so honestly.

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

---

## The Known Gap

There is still no automation connecting a Stripe payment to a real per-client Retell agent/phone number. Every new paying client is provisioned manually today. This is the single most-repeated root cause behind past truthfulness fixes — anything that implies otherwise on a marketing or dashboard page is wrong until this actually gets built. See `docs/possibilities/` for what a real fix might look like.

---

## Key URLs

| Resource | URL |
|---|---|
| Homepage | `https://369agenticsystems.com` (served from `public/index.html` via `app/route.ts`) |
| Client dashboard | `https://369agenticsystems.com/client-dashboard` |
| Admin dashboard | `https://369agenticsystems.com/dashboard` |
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

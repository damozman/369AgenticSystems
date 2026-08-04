# 369 Agentic Systems — Claude Code Guide

## ⚠️ Session Handoff — Read This First
**Protocol:** At the end of any session with open items left, update this section before
finishing up. At the start of a new session, read this section first, before anything else.
**Replace it each time** — this is a running "current state" snapshot, not a changelog. Once an
item is actually resolved, delete it from the list instead of marking it done.

**Last updated:** 2026-08-03 (end of session — Phase 0 truthfulness pass opened as PR #12)

Working plan lives at `~/.claude/plans/steady-questing-flask.md`. Read its STATUS table
alongside this. **Do not start Phase 1 design work — Chris has not approved the direction.**

### Recently closed — do NOT re-diagnose
- **The mail outage is fixed.** It was never PTR or SMTP credentials. `369agenticsystems.com`'s
  MX pointed at a host that had stopped answering on *every* port. Migrated to Namecheap Private
  Email; DNS is managed at **Namecheap BasicDNS**, not Vercel, despite the site being hosted there.
- **The funnel no longer loses leads** (PR #10). Static pages post to `/api/intake`, which writes
  `system_audits` and emails the owner. Gumloop is cancelled and dies **2026-09-02**.
- **The open relay is closed** (PR #11, merge `01f08e3`). `/api/update-dossier` was
  unauthenticated and mailed any address in its payload; it is deleted and returns 404 in prod.
- **Both shared-secret gates are armed**, re-verified live 2026-08-03: all six guarded routes
  (`capture-lead`, `call-received`, `book-appointment`, `felix/conflict-check`, `rex/trigger`,
  `nova/booking-confirmation`) return 401 to an unauthenticated POST.

### Open items
0. **PR #12 is open and needs a preview check before merging.** Phase 0 truthfulness pass,
   branch `fix/truthfulness-pass`, commit `37390e9`. `tsc`/`build`/`test` are green but a
   green build is not evidence. On the Vercel preview: load the roofing static page and
   `/roofing`, enter identical inputs, confirm the two figures now agree (they do locally —
   $97,425/mo); check all 9 static calculators at desktop and 390px so the new assumption
   line renders without breaking the stat row; check the homepage vertical-card hover copy
   and the `/roofing` comparison table footnote. The ROI model now lives in `lib/roi.ts` —
   **any new revenue estimate must import `RECOVERY_RATE` from there**, and the 9 static
   pages carry a mirrored copy with a comment pointing back to it.
1. **Re-test OTP login — probably fixed, never confirmed.** Sign-in links were bouncing because
   of the mail outage above, which is now resolved, but nobody has logged in since. This is the
   first thing to check because it gates item 2. If it still fails, the fallback is switching
   Supabase Auth SMTP (Project Settings → Authentication → SMTP Settings) to Resend
   (`smtp.resend.com`, user `resend`, password = Resend API key, sender on the already-verified
   `alerts.369agenticsystems.com`).
2. **Ops-brief HTTP routes + admin UI still untested.** The underlying
   parse→Claude-mapping→metrics pipeline was verified against live Supabase + Claude on
   2026-08-02, but `/api/admin/ops-brief/*` and `OpsUploadTool.tsx` need a real admin login.
3. **Phase 2b — the "we called your line" audit.** The plan's highest-value item and still not
   started. It replaces the deleted fabricated scores with a real recorded test call, and a bulk
   run manufactures the proprietary statistic that replaces the borrowed ones removed in 0c.
4. **Intake failure alerting is still missing** (00d partial). A failed insert returns 500, shows
   the prospect a fallback, and logs to Vercel — but nothing tells the owner. Nine days of silent
   failure was the original defect; that specific hole is still open. SMS was evaluated and
   dropped (no Twilio credentials exist anywhere).
5. **`lib/email-templates.ts` is now unreferenced dead code.** All four templates lost their only
   caller when `/api/update-dossier` was deleted. Kept because plan Phase 2a earmarks them for
   reuse; `diagnosticAlertHtml` is thin enough now that it likely wants a rewrite instead.

### Leave alone
`369AgenticSystems.code-workspace` has a pre-existing uncommitted modification that predates
this work. It is not ours — do not stage or revert it.

## Project Overview
Next.js 14 App Router marketing site + client portal for an AI automation agency.
9 verticals: roofing, hvac, plumbing, legal, real-estate, insurance, saas, dental, wholesale.
Deployed on Vercel, auto-deploys from `master`.

## Architecture

### Two parallel systems
1. **Static cold email pages** — `public/{vertical}-leads/index.html` (and `public/legal-automation/`, `public/saas-optimization/`). Pure HTML, served by Vercel CDN. No Next.js involved.
2. **Next.js app** — ROI calculators, pricing pages, client portal, agent detail pages.

### Homepage
- `public/index.html` = the REAL marketing homepage (full site, 1300+ lines of static HTML)
- `app/route.ts` reads and serves `public/index.html` at `/` via a route handler
- `app/founding/page.tsx` = the founding operator / early access gate (currently disabled, lives at `/founding`)
- **Never** delete `public/index.html` — it IS the homepage

### Client Portal
- Auth: Supabase OTP, middleware guards `/dashboard`
- Two themes: admin (dark) vs client (light). Admin dark theme must NOT carry over to client view.
- Full dashboard at `app/(portal)/dashboard/page.tsx`

### Agent System
- 5 agents: Ava (live), Rex (live), Nova (live), Felix (live, legal only), Scout (deploying, saas only)
- Dental is the exception: Ava/Rex/Nova are FUTURE there, not live
- Agent cards: `components/agents/AgentCard.tsx` (Client Component, links to `/agents/{slug}`)
- Agent detail pages: `app/agents/[agent]/page.tsx` (Server Component) + `app/agents/[agent]/DeploymentCards.tsx` (Client Component for hover)
- Agent team grid: `components/agents/AgentTeamGrid.tsx`

## Critical Rules

### Zero-Touch Policy on static HTML
The 9 cold email pages in `public/` are static HTML. Edit them **directly as HTML**.
Never route them through Next.js compilation. Never use React components inside them.

### Image paths
All agent images live at `/img/agents/{agent}/{agent}_{vertical}.jpg`
(NOT `/agents/` — that path conflicts with the Next.js `/agents/[agent]` route, causing 403s)
- Format: JPEG, 280×350px, ~10KB each
- Script to regenerate: `node scripts/optimize-agent-images.mjs`

### Real-estate underscore
Image filename uses underscore: `ava_real_estate.jpg`
Folder uses hyphen: `public/img/agents/ava/`

### Felix & Scout limited verticals
- Felix only has: `felix_legal.jpg`, `felix_original.jpg`
- Scout only has: `scout_saas.jpg`, `scout_original.jpg`

## Vertical Color Palette
```
roofing:      #FF4500    hvac:         #FF6533
plumbing:     #0369A1    legal:        #60A5FA
real-estate:  #0EA5E9    insurance:    #14B8A6
saas:         #8B5CF6    dental:       #EC4899
wholesale:    #84CC16
```

## Agent Status Colors
- LIVE:      `#4ADE80` (green)
- DEPLOYING: `#D4AF37` (gold)
- FUTURE:    `#475569` (gray)

## Design System
- Background: `#0A0A0A` (obsidian)
- Gold accent: `#D4AF37`
- Fonts: Inter (body), Instrument Sans (display), Courier New (mono)
- Glass cards: `rgba(255,255,255,0.03)` bg, `backdrop-filter: blur`

## Email Policy
All system/test emails → `chris@369agenticsystems.com`
Never use `texasmediamasters@gmail.com`

## Intake
All 10 static pages post to first-party `POST /api/intake`, which writes `system_audits` and
emails the owner. **Gumloop is gone** (cancelled, account dies 2026-09-02) — do not add new
calls to it. `source_tag` (`369AS_{VERTICAL}_INTAKE`) is still sent and is mapped to a clean
`client_industry` on the way into the database.

## ROI math
`lib/roi.ts` owns `RECOVERY_RATE = 0.30` — the single source of truth for every revenue
estimate shown to a prospect. Import it; never re-declare it. The 9 static calculators carry
a mirrored `const RECOVERY_RATE = 0.30` with a comment pointing back, since they can't import.
Any figure derived from it must state the assumption on-screen.

## Launch State (as of 2026-08-03)
- Dental: all agents marked FUTURE (not yet deployed to that vertical)
- Legal: 4 agents (Ava, Rex, Nova, Felix) — all LIVE
- SaaS: 4 agents (Ava, Rex, Nova LIVE; Scout DEPLOYING — not built)
- All other verticals: 3 agents (Ava, Rex, Nova) — all LIVE
- Zero paying clients. No testimonials, logos, or plural-client claims are permissible anywhere.
- Rex SMS follow-up and Nova review requests are NOT shipped — the "coming in phase 2"
  notes on the agent pages are accurate, leave them.

## Common Tasks

### Adding an agent section to a cold email page
Insert before the `<section id="handoff"...>` tag. Pattern:
- Section label, H2 "Meet the [Name] Roster", grid with agent cards
- Each card: status badge → photo (`/img/agents/{agent}/{agent}_{vertical}.jpg`) → name → role → virtue → "View profile →" link to `/agents/{slug}`
- Hover via inline `onmouseover`/`onmouseout` (vanilla JS, not React)

### Type checking before commit
```
npx tsc --noEmit
```

### Session hygiene to reduce token usage
- Run `/compact` when switching between major task areas
- Run `/clear` when starting a completely unrelated task
- This project has long files — read specific line ranges, not whole files

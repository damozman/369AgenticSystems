# 369 Agentic Systems — Claude Code Guide

## ⚠️ Session Handoff — Read This First
**Protocol:** At the end of any session with open items left, update this section before
finishing up. At the start of a new session, read this section first, before anything else.
**Replace it each time** — this is a running "current state" snapshot, not a changelog. Once an
item is actually resolved, delete it from the list instead of marking it done.

**Last updated:** 2026-08-03

### Open items
1. **OTP login / Supabase Auth email is likely still broken.** Gmail SMTP creds were being
   rejected (`535 5.7.8`), and separately the domain's hosting-provider mail server looked
   unreachable inbound with a missing PTR record outbound. Recommended switching Supabase's
   Auth SMTP (Project Settings → Authentication → SMTP Settings) to Resend
   (`smtp.resend.com` / user `resend` / password = Resend API key / sender on the already-verified
   `alerts.369agenticsystems.com` domain, e.g. `auth@alerts.369agenticsystems.com`) — never
   confirmed done. **Fix this first** — it blocks any fresh login to `/admin` or `/dashboard`.
   Also blocks testing the ops-brief harness's actual HTTP routes/admin UI (its underlying
   parse→Claude-mapping→metrics pipeline was verified directly against live Supabase + Claude on
   2026-08-02, but the `/api/admin/ops-brief/*` routes and `OpsUploadTool.tsx` UI need a real admin
   login, which this blocks).
2. **External, not code-blocking:** a hosting-provider support ticket for
   `369agenticsystems.com`'s mail server (PTR record + inbound reachability) is still needed —
   affects Chris's own inbox (`chris@369agenticsystems.com`), separate from the Supabase Auth
   SMTP fix in item 1. Chris emailed the provider 2026-08-02 for an update; awaiting response.

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
- 5 agents: Ava (live), Rex (deploying), Nova (deploying), Felix (legal only), Scout (saas only)
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

## Gumloop Webhook
Single webhook URL for all verticals, differentiated by `source_tag` field.
Format: `369AS_{VERTICAL}_INTAKE` (e.g. `369AS_ROOFING_INTAKE`)

## Launch State (as of 2026-07-06)
- Dental: all agents marked FUTURE (not yet deployed to that vertical)
- Legal: 4 agents (Ava, Rex, Nova, Felix)
- SaaS: 4 agents (Ava, Rex, Nova, Scout)
- All other verticals: 3 agents (Ava, Rex, Nova)
- Launch day: Tuesday 2026-07-08

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

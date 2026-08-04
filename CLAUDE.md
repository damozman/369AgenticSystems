# 369 Agentic Systems — Claude Code Guide

## ⚠️ Session Handoff — Read This First
**Protocol:** At the end of any session with open items left, update this section before
finishing up. At the start of a new session, read this section first, before anything else.
**Replace it each time** — this is a running "current state" snapshot, not a changelog. Once an
item is actually resolved, delete it from the list instead of marking it done.

**Last updated:** 2026-08-04 (end of session — Retell call outage fixed, audit pipeline live)

Working plan lives at `~/.claude/plans/steady-questing-flask.md`. Read its STATUS table
alongside this. **Do not start Phase 1 design work — Chris has not approved the direction.**

### Recently closed — do NOT re-diagnose
- **The Retell call outage is fixed (2026-08-04).** The demo line answered calls but recorded
  **none for ten days** (2026-07-25 → 08-04). `+18176350220`'s inbound route was pinned to
  agent **version 17**, whose `webhook_url` had no `?secret=`, so the armed gate on
  `/api/call-received` 401'd every webhook. v18 was published and correct; the number never
  followed it. Outbound calls used v18 and worked, which masked it. Repointed to v18
  (rollback: `agent_version: 17, weight: 1`, same agent id). All four lost calls were owner
  tests — no real prospects. Full chain re-verified: call → lead → booking, both FKs linked.
- **The "we called your line" audit pipeline is LIVE** (PRs #14, #15 merged). Verified on a
  real production call: `dial_no_answer` → *"We called your main line Tuesday at 2:01am. It
  rang out — no answer, no voicemail."* No leak into `calls`.
- **The mail outage is fixed.** Never PTR or SMTP credentials — the MX host had stopped
  answering on every port. Now Namecheap Private Email; DNS at **Namecheap BasicDNS**, not
  Vercel, despite the site being hosted there.
- **The funnel no longer loses leads** (PR #10). Confirmed still healthy 2026-08-04:
  a real submission wrote `empiretrak.com / roofing / intake_received` and emailed the owner.
  Gumloop is cancelled and dies **2026-09-02**.
- **The open relay is closed** (PR #11). `/api/update-dossier` deleted; returns 404 in prod.
- **`INTERNAL_API_SECRET` rotation is cleared.** Rotated twice on 2026-08-04; booking,
  lead capture and call recording all verified working afterwards. It broke nothing.

### Open items
1. **PRs #12 and #13 are open, clean, and need a preview check before merging.** Both were
   `MERGEABLE / CLEAN` at end of session and neither involves a Retell callback, so both are
   genuinely preview-testable.
   - **#12 Phase 0 truthfulness** (`fix/truthfulness-pass`): unified three contradictory ROI
     models on `lib/roi.ts`, stripped **eight** borrowed statistics, and added a drift guard
     (`lib/roi.test.ts`). Preview check: roofing static page vs `/roofing` with identical
     inputs must agree ($97,425/mo locally); all 9 calculators at desktop and 390px.
   - **#13 Intake failure alerting** (`fix/intake-failure-alerting`): a failed insert now
     emails the owner the full payload. Preview check: force a DB failure, confirm the
     prospect sees the fallback **and** the 🚨 email arrives.
   - ⚠️ #12 also edits this file. Merging master into it may need a CLAUDE.md conflict resolved.
2. **Re-test OTP login — probably fixed, never confirmed.** Sign-in links bounced during the
   mail outage, which is resolved, but nobody has logged in since. **This gates item 3.**
   Fallback: switch Supabase Auth SMTP to Resend (`smtp.resend.com`, user `resend`, password =
   Resend API key, sender on the verified `alerts.369agenticsystems.com`).
3. **Ops-brief HTTP routes + admin UI still untested.** The parse→Claude→metrics pipeline was
   verified live 2026-08-02, but `/api/admin/ops-brief/*` and `OpsUploadTool.tsx` need a real
   admin login.
4. **Phase 2b bulk runner — NOT built, and deliberately so.** It manufactures the proprietary
   statistic that replaces the removed borrowed ones. Everything it needs is built and tested
   (`tallyAuditCalls`, `unreachedShare`, honest denominators, 30-call minimum). **Blocked on a
   decision only Chris can make:** cold-calling businesses that never made contact is a
   different legal posture from calling a form submitter — Texas telemarketing registration
   and do-not-call apply. Do not build this unprompted.
5. **Schedule `scripts/audit-retell-webhooks.mjs`.** It detects the outage class above. Not
   yet on a cron. Cheap insurance against the same ten-day silence.
6. **`lib/email-templates.ts` is unreferenced dead code.** All four templates lost their only
   caller when `/api/update-dossier` was deleted. Kept because plan Phase 2a earmarks them for
   reuse; `diagnosticAlertHtml` is thin enough now that it likely wants a rewrite instead.

### The pattern that has now bitten twice
**Arming a shared-secret gate silently breaks every producer that did not get the new
secret**, and the breakage is silent by construction — the gate returns 401 and the producer
does not care. This caused both the funnel outage and the ten-day call outage. **After arming
any gate, enumerate the producers and verify each one still delivers.**

### Verification scripts (all committed, all run against live systems)
```
node scripts/audit-retell-webhooks.mjs   every inbound route can deliver its webhook
node scripts/verify-booking.mjs [hours]  call → lead → booking chain
node scripts/verify-audit-call.mjs       audit calls resolved + no leak into `calls`
node scripts/preflight-audit-call.mjs    config check before spending a call
node scripts/place-audit-call.mjs        place one audit call (prompts, no args)
node scripts/probe-audit-calls.mjs       audit_calls schema vs production
```

### Environment notes
- Chris runs **PowerShell**. Never hand over bash syntax or `<angle-bracket>` placeholders —
  `<` is a reserved operator and the line fails to parse. Script it with prompts instead.
- **Retell webhooks always hit production**, never a preview — the URL is on the agent.
  Anything touching a Retell callback must be merged and tested in prod.
- Vercel previews are SSO-protected; `curl` gets `401 "Protected deployment"` until a
  Protection Bypass for Automation token is passed.
- `INTERNAL_API_SECRET` is marked **Sensitive** in Vercel — write-only, scoped to
  **Production and Preview together**.

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

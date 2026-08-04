# 369 Agentic Systems — Claude Code Guide

## ⚠️ Session Handoff — Read This First
**Protocol:** At the end of any session with open items left, update this section before
finishing up. At the start of a new session, read this section first, before anything else.
**Replace it each time** — this is a running "current state" snapshot, not a changelog. Once an
item is actually resolved, delete it from the list instead of marking it done.

**Last updated:** 2026-08-04 (end of session - call outage fixed, audit pipeline live, ops-brief working)

Working plan lives at `~/.claude/plans/steady-questing-flask.md`. Read its STATUS table
alongside this. **Do not start Phase 1 design work - Chris has not approved the direction.**

### START HERE: three PRs are open, verified, and waiting on a merge decision
All three are green (`tsc`, `build`, `npm test` 57/57) and were exercised against real data.
**Merge order matters: #17 before #18.** #16 is independent.

| PR | Base | What | Verified how |
|---|---|---|---|
| #16 | `master` | Ops-brief errors name the actual failure | Would have identified the missing key immediately |
| #17 | `master` | Backorder Y/N flags counted; "SKU Count" relabelled to lines | Real fixture: $10,128 across 5 lines, was `null` |
| #18 | **#17** | Mapping-call hardening, stays on `claude-sonnet-4-6` | 4-model benchmark, all scored 10/10 |

Nothing else is half-finished. The working tree is clean apart from the pre-existing
`369AgenticSystems.code-workspace` modification, which is not ours.

### Recently closed - do NOT re-diagnose
- **The Retell call outage is fixed (2026-08-04).** The demo line answered calls but recorded
  **none for ten days** (2026-07-25 to 08-04). `+18176350220`'s inbound route was pinned to
  agent **version 17**, whose `webhook_url` had no `?secret=`, so the armed gate on
  `/api/call-received` 401'd every webhook. v18 was published and correct; the number never
  followed it. Outbound calls used v18 and worked, which masked it. Repointed to v18
  (rollback: `agent_version: 17, weight: 1`, same agent id). All four lost calls were owner
  tests. Full chain re-verified after the fix: call -> lead -> booking, both FKs linked.
- **The "we called your line" audit pipeline is LIVE** (PRs #14, #15). Verified on a real
  production call: `dial_no_answer` -> *"We called your main line Tuesday at 2:01am. It rang
  out - no answer, no voicemail."* No leak into `calls`.
- **Phase 0 truthfulness pass is MERGED and live** (PR #12). Three contradictory ROI models
  unified on `lib/roi.ts`; **eight** borrowed statistics removed. Verified in production: all
  9 static pages serve `RECOVERY_RATE = 0.30` plus a visible assumption line, and no removed
  claim survives anywhere. `lib/roi.test.ts` guards against drift.
- **Intake failure alerting is MERGED and live** (PR #13). Both paths verified on real
  deployments: success -> row + notification email; failed insert -> 500, no row, and an
  "INTAKE FAILED" alert in the owner's inbox.
- **The ops-brief harness works end to end.** Root cause of the "Column-mapping request
  failed" 502 was a missing `ANTHROPIC_API_KEY` in Vercel - **not** a code bug. On the messy
  fixture Claude found the header row past two junk preamble lines and mapped **10/10**
  cryptic columns (`Stat`, `ROP`, `B/O?`, `Price Ea`).
- **The mail outage is fixed.** Never PTR or SMTP credentials - the MX host had stopped
  answering on every port. Now Namecheap Private Email; DNS at **Namecheap BasicDNS**.
- **The funnel no longer loses leads** (PR #10), reconfirmed 2026-08-04. Gumloop dies 2026-09-02.
- **The open relay is closed** (PR #11). `/api/update-dossier` deleted; 404 in prod.
- **OTP login works** - confirmed by a real login 2026-08-04. It was the mail outage all along.
- **`INTERNAL_API_SECRET` rotation is cleared.** Rotated twice on 2026-08-04; booking, lead
  capture and call recording all verified working afterwards. It broke nothing.

### Open items
1. **Merge the three PRs above** after whatever review you want. Shortest path to a clean slate.
2. **Ops-brief has nothing else blocking it.** The admin UI, the HTTP routes and the whole
   parse -> map -> metrics chain have now been exercised through a real admin session.
3. **Phase 2b bulk runner - NOT built, deliberately.** It manufactures the proprietary
   statistic that replaces the removed borrowed ones. Everything it needs is built and
   tested (`tallyAuditCalls`, `unreachedShare`, honest denominators, 30-call minimum).
   **Blocked on a decision only Chris can make:** cold-calling businesses that never made
   contact is a different legal posture from calling a form submitter - Texas telemarketing
   registration and do-not-call apply. Do not build this unprompted.
4. **Schedule `scripts/audit-retell-webhooks.mjs`.** It detects the ten-day-outage class.
   Not yet on a cron. Cheap insurance.
5. **`lib/email-templates.ts` is unreferenced dead code.** All four templates lost their only
   caller when `/api/update-dossier` was deleted. Plan Phase 2a earmarks them for reuse.
6. **Three other Anthropic call sites still pin `claude-sonnet-4-6`** (`email-ingest`,
   `felix/conflict-check`, `nova-templates`). Deliberately left alone - the latter two run
   mid-call on live Retell traffic. Read the benchmark note below before changing any of them.

### Open question raised 2026-08-04 (end of session) - discuss before building
**Ava's agent page claims she "books directly on your Cal.com calendar". She does not.**
Verified: `/api/book-appointment` inserts a `bookings` row, stamps the call, emails the owner,
and fires `/api/nova/booking-confirmation`, which emails (and optionally SMSes) the caller.
**No calendar write at any step** - zero references to `api.cal.com`, `CAL_API` or `CALCOM`
anywhere. The only Cal.com in the project is the embed on `/book-demo`, which is Chris's own
discovery-call page and unrelated.

Two decisions, do not conflate them: (1) **truthfulness** - either build it or fix the copy in
`app/agents/[agent]/page.tsx`; a named-integration claim for something unbuilt is the same
class as the borrowed statistics removed in PR #12. (2) **product** - whether to build real
sync, and how; an `.ics` attachment on the confirmation email Nova already sends is by far the
cheapest option and needs no per-client OAuth.

### Two patterns that have each cost real time
**Arming a shared-secret gate silently breaks every producer that did not get the new
secret**, and the breakage is silent by construction - the gate returns 401 and the producer
does not care. This caused both the funnel outage and the ten-day call outage. After arming
any gate, enumerate the producers and verify each one still delivers.

**Measure before recommending.** A four-minute benchmark settled a model-choice question that
would otherwise have been argued from plausible reasoning. `sonnet-4-6`, `haiku-4-5` and
`opus-5` at every effort level all mapped **10/10** on the ops-brief fixture; Opus cost 2x for
an identical answer. Do not upgrade a model on the theory that a task is "reasoning-heavy" -
run the comparison first. Note also that the ops-brief Claude call fires **once per client
label**, not per upload - the route reuses a saved mapping - so cost is bounded by client
count, not usage volume.

### Verification scripts (all committed, all run against live systems)
```
node scripts/audit-retell-webhooks.mjs   every inbound route can deliver its webhook
node scripts/verify-booking.mjs [hours]  call -> lead -> booking chain
node scripts/verify-audit-call.mjs       audit calls resolved + no leak into `calls`
node scripts/preflight-audit-call.mjs    config check before spending a call
node scripts/place-audit-call.mjs        place one audit call (prompts, no args)
node scripts/probe-audit-calls.mjs       audit_calls schema vs production
```

### Environment notes
- Chris runs **PowerShell**. Never hand over bash syntax or angle-bracket placeholders -
  `<` is a reserved operator and the line fails to parse before running. Script it with
  prompts instead.
- **Retell webhooks always hit production**, never a preview - the URL is on the agent.
  Anything touching a Retell callback must be merged and tested in prod.
- Vercel previews are SSO-protected; `curl` gets `401 "Protected deployment"` without a
  Protection Bypass for Automation token.
- Vercel **bakes env vars in at build time** - changing one requires a redeploy. This cost
  time twice in one session.
- `npm test` uses `scripts/test-resolver.mjs` so Node can resolve the `@/` alias. Without it,
  any `lib` module importing `@/lib/...` is untestable.

### Leave alone
`369AgenticSystems.code-workspace` has a pre-existing uncommitted modification that predates
this work. It is not ours - do not stage or revert it.

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
Any figure derived from it must state the assumption on-screen. `lib/roi.test.ts` guards both.

## Launch State (as of 2026-08-04)
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

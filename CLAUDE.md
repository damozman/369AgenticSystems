# 369 Agentic Systems — Claude Code Guide

## ⚠️ Session Handoff — Read This First
**Protocol:** At the end of any session with open items left, update this section before
finishing up. At the start of a new session, read this section first, before anything else.
**Replace it each time** — this is a running "current state" snapshot, not a changelog. Once an
item is actually resolved, delete it from the list instead of marking it done.

**Last updated:** 2026-08-10 (session end). **Google Calendar is SHIPPED and PROVEN on a real
call. Usage metering Phase A is shipped and measuring.** `master` is clean and deployed; PRs #28
through #35 all merged. The only uncommitted file is the pre-existing
`369AgenticSystems.code-workspace` change, which is not ours.

### Two dates to check, both concrete
- **2026-08-14** — Northside's first billing period closes and `/api/cron/usage-rollup` writes the
  first `usage_periods` row. Until then the shadow ledger is legitimately empty; that is not a
  fault.
- **Google verification** — not submitted yet. Everything blocking it exists; it needs a demo
  video. See Open item 0. Up to 10 days on Google's schedule once sent.

### START HERE: the calendar chain is proven. Do NOT re-verify it.
On a real call to **Northside** at 2026-08-06 00:25 UTC, with two blocks sitting on the owner's
Google Calendar:

| Friday Aug 7 | state |
|---|---|
| 9:00–10:00 AM | blocked by the owner in Google |
| 10:00–11:00 AM | **free** |
| 11:00–12:00 PM | blocked by the owner in Google |

The caller asked for *"Friday between nine and twelve."* Ava offered **"8:00 AM or 10:00 AM"** and
booked 10:00 — she threaded the single free hour. Nothing in our database knew about either
block. Everything downstream was correct on the same call: event titled
`Roof inspection — Victoria Gray` with the job address as its location, **exactly one** caller
confirmation stating the right day, owner alert delivered, lead linked, `confirmation_sent` true.

**The owner-alert path is CLOSED** — it was the last unexercised step in the booking chain, and
it fired and arrived on that call. It had never fired before because the demo line has no
`agent_subscriptions` row and therefore no owner to notify.

### Also proven, unattended
- **The `calendar-sync` cron genuinely fires on Vercel.** At 13:02Z on 2026-08-05 it ran with
  nobody watching, found an access token that had already expired, refreshed it via the refresh
  token, and recorded success without alerting anyone. That retires the old "crons have never
  been observed firing" watch item, and it proves the OAuth refresh path — the exact thing
  Google's *Testing* publishing status would have destroyed after 7 days.
- **All 9 vertical templates + Northside now run `claude-4.5-haiku`.** The 2026-08-04 benchmark
  had only ever been applied to the shared demo LLM. Like-for-like on the same agent and number:

  | | p50 | max | opening turns |
  |---|---|---|---|
  | `claude-4.6-sonnet` | 2399ms | 10098ms | 9714, 9676, 9511, 10098, 9962 |
  | **`claude-4.5-haiku`** | **964ms** | **1843ms** | 1274 |

  Revert: `node --env-file=.env.local scripts/retell/set-client-model.mjs --model claude-4.6-sonnet --apply`

### Usage metering — Phase A only. It measures. It bills NOTHING.
Shipped 2026-08-10 (PR #35). Flat tiers made the heaviest user the worst-margin user with no
lever; included-minutes-plus-overage fixes that. **The meter exists; the billing does not, and the
pricing page does not mention minutes.**

- `lib/usage.ts` — per-call rounding **up to the whole minute, individually, then summed**
  (Retell/Twilio/Smith.ai convention). A 0-second or unknown-duration call bills **zero**.
  **Money is integer cents everywhere** — `0.35 * 3` is `1.0499999999999998`, so `OVERAGE_RATE_CENTS`
  is 35/30/25, never 0.35/0.30/0.25.
- `lib/billing-period.ts` — `billablePeriodFor()` returns **null** without a Stripe subscription
  anchor, so the demo line is unbillable *structurally*, not by a caller remembering to check.
  `displayPeriodFor()` falls back to the calendar month, because showing usage and invoicing are
  different questions.
- `/api/cron/usage-rollup` (11:00 UTC daily) writes one `usage_periods` row per **closed** period
  with status `'shadow'` and charges nothing. It never writes for an open period — a number that
  keeps moving is what an invoice must never be.
- **`TIER_MINUTES` / `OVERAGE_RATE_CENTS` must NOT be advertised** until billing is live. The
  strategy-doc diff that proposed this feature put "300 included minutes" straight onto the
  pricing page with no meter behind it. This file has already shipped that mistake once
  (pricing-tier overclaim, 2026-07-11). **The copy flips in the same commit as the billing.**

**The gate for Phase B is a clean reconciliation, not a date.** Run
`scripts/verify-usage.mjs` after a period closes; it compares our minutes against Retell's own
call records. Only when the shadow ledger agrees over a full period does billing go on.

**Northside will read `skipped`, not a dollar figure** — its subscription predates
`stripe_subscription_id` capture, so it has no anchor and never will retroactively. The first
client to sign up after 2026-08-10 is the first with a real one. That is correct, not a bug.

### How the calendar integration is built
- `lib/calendar/` is a provider seam. **`google.ts` is the only file that knows Google exists**
  — Microsoft Graph is meant to be a new file, not a rewrite. Never Apple/CalDAV (no OAuth, needs
  a hand-typed app password, kills "live within minutes").
- **`lib/availability.ts` was not touched.** A Google freeBusy response reduces to its existing
  `BusyInterval` shape, so calendar busy times concatenate with rows from `bookings`.
- **Reads fail CLOSED, writes fail OPEN.** Both `/api/available-slots` (offering) and
  `/api/book-appointment` (accepting) refuse rather than offer a time they cannot verify. The
  event *write* after a successful booking is non-fatal — the slot is already atomically held and
  the caller is on the phone — and marks `calendar_sync_status='pending'` for the cron to retry.
- **`getProviderForClient()` returning `null` is the normal case** and must stay first-class.
  Every client without a connected calendar behaves exactly as before the feature existed.
- Tokens are AES-256-GCM encrypted under **`CALENDAR_TOKEN_KEY`**. Lose or rotate it and every
  connected client must reconnect by hand. It is in Vercel; keep a durable copy elsewhere.

### Facts that will waste your time if you don't know them
- **There is exactly ONE `agent_subscriptions` row:** `damozman@yahoo.com` →
  `www.Northsideroofing.com`. Connecting a calendar resolves the client from that table, so you
  must be logged in as **damozman@yahoo.com**. `chris@369agenticsystems.com` has no row and the
  connect flow dead-ends at the login page.
- **Two phone numbers, easily confused.** Northside is **+1 (817) 612-6757**; the shared demo line
  is **+1 (817) 635-0220**. A test on the demo line proves nothing about calendars —
  `demo.369agenticsystems.com` has no subscription row, and `calendar_connections` is FK'd to
  `agent_subscriptions`, so **the demo line can never hold a calendar connection.** One test
  session was lost to exactly this.
- **A client's Google Calendar timezone is not necessarily the business timezone.** Chris's was
  set to UTC, which rendered a correct 9:00 AM Central booking as 2pm and looked like a bug for
  half an hour. The stored instant was right the whole time. Expect this on real onboarding.
- **Google returns `"primary"` verbatim** from freeBusy — it does *not* normalise it to the
  account address. So `account_email` stays null and the dashboard says "Google account". Getting
  the real address would mean requesting `openid email` purely to label a card, and a scope change
  later costs a re-consent from every connected client. Deliberately not done.
- `node --env-file=.env.local` is how the Retell scripts get their key; `verify-calendar-sync.mjs`
  needs `CALENDAR_TOKEN_KEY` and will happily run on a live access token without the Google client
  credentials.

### Google OAuth status
Consent screen is **published to Production** (not Testing — that issues 7-day refresh tokens and
would kill every connection silently). Scopes are exactly `calendar.freebusy` + `calendar.events`.
Domain ownership is verified via a TXT record that sits **alongside** the Private Email SPF record
— do not edit that one. `/privacy` and `/terms` must stay at those exact paths and outside
middleware; Google's console points at them.

**Verification has NOT been submitted.** Until it clears, anyone connecting sees the "Google
hasn't verified this app" interstitial and must click Advanced → Continue, and there is a 100-user
cap. See Open item 0.

### Open items
0. **Submit for Google verification.** Everything that was blocking it now exists. The submission
   needs a **demo video showing the end-to-end OAuth consent and the app using the scopes**, which
   is why it could not be done earlier. Justification to use, which is true of the code: *we
   request `calendar.freebusy` rather than `calendar.readonly` specifically so we never receive
   event titles, attendees or descriptions — we only need to know whether a time is occupied.*
   Review takes up to 10 days on Google's schedule and gates nothing else.
   **The recording order matters:** disconnect the calendar first so there is a fresh consent to
   film, log in as `damozman@yahoo.com`, and call **Northside** on +1 (817) 612-6757 — a demo-line
   call proves nothing, and one session was already lost to that.
1. **Usage metering Phase B — billing — NOT built, deliberately.** Phase A measures; nothing
   charges. Phase B is `stripe.invoiceItems.create` on period close (idempotent on
   `usage_periods.stripe_invoice_item_id` — a cron that runs twice must not bill twice), the
   crossing-the-line email guarded by `alerted_at`, and the pricing copy. **Gated on
   `scripts/verify-usage.mjs` reconciling clean over a full closed period, not on a date.**
   Invoice items attach to the next subscription invoice automatically, so this needs no
   metered-price migration and no restructuring of a live subscription.
2. **`RETELL_TEMPLATE_AGENT_DENTAL` is a 404.** The local `.env.local` value
   (`agent_c15e912987197748ba3b54bdbc3`) does not exist in Retell, so dental provisioning would
   throw on a real signup. Harmless today (every dental agent is FUTURE, nobody can sign up), and
   the Vercel value may differ — check there before assuming it is broken in production.
3. **Phase 2b bulk runner — NOT built, deliberately.** It manufactures the proprietary statistic
   that replaces the removed borrowed ones, and everything it needs is built and tested
   (`tallyAuditCalls`, `unreachedShare`, honest denominators, 30-call minimum). **Blocked on a
   decision only Chris can make:** cold-calling businesses that never made contact is a different
   legal posture from calling a form submitter — Texas telemarketing registration and do-not-call
   apply. Do not build this unprompted.
4. **`lib/email-templates.ts` is unreferenced dead code.** All four templates lost their only
   caller when `/api/update-dossier` was deleted.
5. **Three Anthropic call sites still pin `claude-sonnet-4-6`** (`email-ingest`,
   `felix/conflict-check`, `nova-templates`). Deliberately left alone — the latter two run mid-call
   on live Retell traffic. Measure before changing any of them.

### Lessons that each cost real time — the first two on the same day
- **One-sided adoption always leaves a window.** When two things arrive in an order you do not
  control, *each* must adopt the other. The booking-notification fix made `capture-lead` adopt the
  booking and stopped there; the leftover 73ms window — between the booking row existing and its
  `calendar_event_id` being written — hit on the very first real call and put a phone number on a
  customer's calendar event instead of their name. **Do not "fix" ordering by reordering the
  prompt**: tool-call order is the model's to choose.
- **Verify through the consumer's view, not the producer's.** An LLM that reports the new model
  while the agent still resolves to an older version is what made the demo line answer calls and
  record none for ten days. `set-client-model.mjs` re-reads through each agent's own
  `response_engine` for this reason.
- **A bare Postgres `timestamp` has no timezone, and `new Date()` will read it as the server's.**
  Vercel runs UTC. This told a real customer their appointment was on Wednesday when it was
  Thursday. `starts_at` (timestamptz) is the truth; the prose columns are for display only.
- **Arming a shared-secret gate silently breaks every producer that did not get the new secret**,
  and the breakage is silent by construction. This caused both the funnel outage and the ten-day
  call outage. After arming any gate, enumerate the producers and verify each one still delivers.
- **Measure before recommending.** A four-minute benchmark settled a model-choice question that
  would otherwise have been argued from plausible reasoning. Do not upgrade a model on the theory
  that a task is "reasoning-heavy" — run the comparison first.
- **Retell's transcript splits an agent turn whenever ASR hears anything.** It is not a record of
  what the caller heard. Never diagnose call quality from a transcript when a human heard the call.
- **A test that reads the clock twice must be bounded against both readings.** One asserting a
  token lifetime against only the *earlier* reading failed about one run in three.
- **A copied value can only be checked against its source.** `calls.duration_seconds` is copied
  from Retell's payload, so every number the meter derives is downstream of that copy — and when
  the copy is wrong, *nothing inside our own database can tell*, because our sums agree with our
  rows and our rows are simply short of the truth. `verify-usage.mjs` compares against Retell on
  its first run and found a call recorded as `null` that Retell said lasted 234 seconds: a missed
  `call_ended` webhook, silently under-billing. Reconcile against the source, not the mirror.
- **`.limit(5)` is not a count.** Two numbers reported to Chris were wrong because a probe query
  capped at five rows was read as the total — the real figure was 19, and the repo's own
  `gumloop-prompts-archive.md` had already written it down. Read what the repo says before
  trusting a query you just wrote.
- **Advertise a promise only when the system can keep it.** The usage-pricing proposal put
  "300 included minutes" on the pricing page in the same diff that had no meter behind it. Copy
  and capability ship together or not at all.

### Verification scripts (all committed, all run against live systems)
```
node scripts/audit-retell-webhooks.mjs   every inbound route can deliver its webhook
node scripts/verify-booking.mjs [hours]  call -> lead -> booking chain
node scripts/verify-audit-call.mjs       audit calls resolved + no leak into `calls`
node scripts/preflight-audit-call.mjs    config check before spending a call
node scripts/place-audit-call.mjs        place one audit call (prompts, no args)
node scripts/probe-audit-calls.mjs       audit_calls schema vs production
node scripts/probe-booking-availability.mjs   booking schema + a REAL double-book attempt
node scripts/verify-booking-notifications.mjs [hours] [--repair]
                                         orphaned bookings + unsent confirmations
node --import ./scripts/test-resolver.mjs scripts/verify-client-schedule.mjs
                                         a REAL client_schedules row, written then deleted
node --import ./scripts/test-resolver.mjs scripts/verify-calendar-sync.mjs
                                         schema + a REAL freeBusy read and create/patch/delete
node --import ./scripts/test-resolver.mjs scripts/verify-usage.mjs [--repair]
                                         meter vs RETELL's own call records; --repair backfills
                                         durations lost to missed call_ended webhooks
node --env-file=.env.local scripts/retell/recon.mjs                    every LLM's tool URLs
node --env-file=.env.local scripts/retell/set-client-model.mjs         dry run; --apply to write
node --env-file=.env.local scripts/retell/update-availability-tool.mjs dry run; --apply to write
node --env-file=.env.local scripts/retell/update-demo-script.mjs       aborts on bad tool names
```

### Environment notes
- Chris runs **PowerShell**. Never hand over bash syntax or angle-bracket placeholders —
  `<` is a reserved operator and the line fails to parse before running. Script it with
  prompts instead.
- **Retell webhooks always hit production**, never a preview — the URL is on the agent.
- Vercel previews are SSO-protected; `curl` gets `401 "Protected deployment"` without a
  Protection Bypass for Automation token.
- Vercel **bakes env vars in at build time** — changing one requires a redeploy.
- `npm test` uses `scripts/test-resolver.mjs` so Node can resolve the `@/` alias. It also means
  **TypeScript parameter properties (`constructor(private readonly x)`) will not run** — Node's
  type-stripping rejects them outright. Write the fields out longhand.
- A hook blocks writing to `.env*` files. Pass secrets inline (`VAR=value node ...`) instead.

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

### Booking + calendar
- `lib/availability.ts` — pure slot arithmetic, `Intl` only, no date library. Not to be edited
  for calendar work; a freeBusy response reduces to the `BusyInterval` shape it already takes.
- `lib/calendar/` — the provider seam. `google.ts` is the **only** file that knows Google exists.
- `book_slot()` (Postgres) does the capacity check and insert in one transaction behind an
  advisory lock. It knows about `bookings` rows only — it cannot see the owner's calendar, which
  is why both `/api/available-slots` and `/api/book-appointment` consult the provider separately.
- Per-client hours live in `client_schedules`, FK'd to `agent_subscriptions` — so a client must
  be subscribed before they can have custom hours or a calendar.

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
All 9 static pages that carry a form post to first-party `POST /api/intake`, which writes
`system_audits` and emails the owner. `dental-leads` is the tenth page and has no intake form at
all — correct, because every dental agent is FUTURE. **Gumloop is gone** (cancelled, account dies
2026-09-02) — do not add new calls to it, and note that every remaining mention of it in the
codebase is a past-tense comment explaining what replaced it, not a live integration.
`source_tag` (`369AS_{VERTICAL}_INTAKE`) is still sent and is mapped to a clean
`client_industry` on the way into the database.

## ROI math
`lib/roi.ts` owns `RECOVERY_RATE = 0.30` — the single source of truth for every revenue
estimate shown to a prospect. Import it; never re-declare it. The 9 static calculators carry
a mirrored `const RECOVERY_RATE = 0.30` with a comment pointing back, since they can't import.
Any figure derived from it must state the assumption on-screen. `lib/roi.test.ts` guards both.

## Launch State (as of 2026-08-10)
- Dental: all agents marked FUTURE (not yet deployed to that vertical)
- Legal: 4 agents (Ava, Rex, Nova, Felix) — all LIVE
- SaaS: 4 agents (Ava, Rex, Nova LIVE; Scout DEPLOYING — not built)
- All other verticals: 3 agents (Ava, Rex, Nova) — all LIVE
- Zero paying clients. No testimonials, logos, or plural-client claims are permissible anywhere.
- Rex SMS follow-up and Nova review requests are NOT shipped — the "coming in phase 2"
  notes on the agent pages are accurate, leave them.
- **Google Calendar booking IS shipped and proven on a real call.** Ava's page and `/privacy`
  now describe it in the present tense, corrected 2026-08-10 (PR #31). The Cal.com claims that
  used to sit there are gone, as is "Claude Sonnet" from Ava's tech list — but `/book-demo` still
  embeds a genuine Cal.com widget for Chris's own discovery calls, and that one is correct. Do not
  "clean it up".
- Every client agent runs `claude-4.5-haiku`, chosen by measurement. Ava's tech list says
  "Claude" without a model name on purpose — naming one goes stale the moment it changes.
- **Pricing is still flat: $400 / $600 / $750, no minute limits advertised anywhere.** Usage
  metering measures in the background but bills nothing, and `TIER_MINUTES` / `OVERAGE_RATE_CENTS`
  are internal constants. Do not put minutes or overage on the pricing page until billing ships.
- The `system_audits` invented metrics — `security_score`, `seo_visibility`, `lead_velocity`,
  `roi_multiplier`, `revenue_leakage` — were **nulled across all 22 rows on 2026-08-10** and
  `leak_detected` set false. They were never measured; the Gumloop prompt instructed the model to
  estimate them. The admin dashboard's leak counter reading 0 is the honest number. Nothing
  customer-facing reads them any more, and `/api/email-ingest` no longer fetches them at all.

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

# 369 Agentic Systems — Claude Code Guide

## ⚠️ Session Handoff — Read This First
**Protocol:** At the end of any session with open items left, update this section before
finishing up. At the start of a new session, read this section first, before anything else.
**Replace it each time** — this is a running "current state" snapshot, not a changelog. Once an
item is actually resolved, delete it from the list instead of marking it done.

**Last updated:** 2026-08-04 (latest) - booking notifications FIXED and PROVEN on a real call.

Working plan lives at `~/.claude/plans/steady-questing-flask.md`. Read its STATUS table
alongside this. **Do not start Phase 1 design work - Chris has not approved the direction.**
The booking work has its own approved plan at `~/.claude/plans/dynamic-frolicking-starlight.md`.

### START HERE: the booking chain is PROVEN on real calls. Do NOT re-verify it.
Chris placed several real calls on 2026-08-04 - see "Proven live" below. He also spot-checked
the stump-resistance ("are you an AI", "what does the company do") and was satisfied on both.
The "try to stump her" copy has since gone out to the remaining seven demo CTAs (**PR #25**);
dental and saas were skipped deliberately - dental has no live agent to call, and saas has no
demo CTA, only the number inside a JS error fallback.

Still unexercised, and worth knowing before the first paying client:
1. ~~The notification path.~~ **Done and proven on a real call - see the section below.** The
   only piece left is the **owner alert**, which needs an `agent_subscriptions` row the demo
   domain does not have. Give a test domain a real inbox and call once before the first client.
2. ~~`lib/availability.ts` against non-default hours.~~ **Done - PR #21.** A real
   `client_schedules` row (weekends open, weekdays closed, America/New_York, 30-min slots,
   capacity 2) passes 16/16 against production. Two constraints surfaced: `client_schedules`
   is FK-constrained to `agent_subscriptions` (so **the demo line can never have custom hours**),
   and `agent_subscriptions` needs `monthly_cost` NOT NULL plus `tier` matching a check
   constraint (`'Elite'`).

**Chris's position on the demo line (2026-08-04):** it does not need a calendar attached. The
database check is the point, and refusing the already-taken 09:00 slot is exactly the behaviour
he wanted to see. Calendar sync matters for **provisioned clients**, not for this number.

`master` is clean and deployed. The working tree is clean apart from the pre-existing
`369AgenticSystems.code-workspace` modification, which is not ours.

### Proven live on real calls (2026-08-04 evening) - do NOT re-verify
- **The whole booking chain works, including double-booking prevention.** Call 1 booked Wed
  Aug 5 09:00. Call 2, seventeen minutes later, was offered **"8:00 AM or 10:00 AM"** - 9:00 was
  correctly withheld. Database confirms `2026-08-05T14:00:00Z` then `15:00Z` (09:00 and 10:00
  CDT). Ava drove `check_availability` -> `book_appointment` unaided and captured `service_type`.
  This is the behaviour the engine exists for and a probe script can only simulate it.
- **The demo line runs `claude-4.5-haiku`, chosen by measurement.** Like-for-like long calls:

  | model | first reply | p50 | worst turn |
  |---|---|---|---|
  | `claude-4.6-sonnet` (12 turns) | 5137ms | 3102ms | 4128ms |
  | `claude-4.6-sonnet` (18 turns) | 9536ms | 2082ms | 3972ms |
  | **`claude-4.5-haiku` (11 turns)** | **1877ms** | **1230ms** | **2346ms** |

  Haiku's worst turn beats Sonnet's median, with no spikes. No quality regression across a full
  booking. Revert is one field: `bench-demo-model.mjs --set claude-4.6-sonnet`.
- **Tool-call markup was reaching the `leads` table (commit `0599223`).** Two leads landed with
  `caller_address` set to a fragment of the model's own call syntax. Cause: the demo prompt
  stopped asking for an address while the tool schema still offered the slot, so the model filled
  it with adjacent text. Happened on **two different models** - not a model quirk. Fixed in three
  layers: `/api/capture-lead` drops markup-shaped values on every text field;
  `lib/security/lead-sanitize.test.ts` pins both verbatim payloads plus other variants of the
  class; the `caller_address` description now says to omit the parameter rather than send a
  placeholder. Both bad rows nulled.

### Booking notifications - FIXED AND PROVEN ON A REAL CALL (PR #20, merged). Do NOT re-verify.
Chris placed a real call at 23:23 UTC on 2026-08-04 and the fix fired, **with the race actually
occurring** - so this is proof, not a lucky ordering. The two `nova_deliveries` rows on booking
`20fca086` are the evidence:

| time (UTC) | what happened |
|---|---|
| 23:23:48 | booking created - no lead existed yet |
| 23:23:49 | Nova fires, records `skipped_no_email` - **the old broken behaviour** |
| 23:24:11 | lead lands, **22.6s after the booking** |
| 23:24:17 | backfill links the lead and re-fires Nova -> `sent` to the caller |

`confirmation_sent = true`, `starts_at` correct (16:00Z = 11:00 AM CDT), `service_type` captured.
The four historical orphans were repaired in production; the verifier now reports **0 orphaned**.

**The one path still unexercised** is the owner alert, because it needs an `agent_subscriptions`
row and the demo domain has none (correctly - nobody should be alerted about a demo booking).
Give a test domain a real inbox and place one call before the first paying client.

<details><summary>Original diagnosis, kept because the reasoning still matters</summary>

The cause is **not** the missing subscription row. It is an ordering race, and it bites every
client regardless of subscription. Measured against production:

| call | book_appointment | capture_lead | gap |
|---|---|---|---|
| `3d947db9` | 22:20:58 | 22:21:25 | lead **27s late** |
| `3f368a45` | 22:03:26 | 22:04:07 | lead **41s late** |

Ava books *before* she captures the lead, so `/api/book-appointment` finds no lead and writes
`bookings.lead_id = null` - permanently, because nothing ever went back to fix it. Then:
- **Nova reads that null**, concludes there is no caller email, and records `skipped_no_email` -
  for callers whose address (`damozman@yahoo.com`) landed seconds later. That is the real reason
  `confirmation_sent` is `false`, not a Resend fault.
- **The owner alert would have said `Phone: unknown`** - no name, no email. Unactionable.
  `www.Northsideroofing.com`, the one domain that *has* a subscription row, is orphaned too, so
  **the paying-client path was already broken in production**, not just the demo line.

**Do not "fix" this by reordering the prompt.** Tool-call order is the model's to choose, and
betting the confirmation on it is the same prompt/schema coupling that has broken things twice.
PR #20 has the lead adopt the booking when it lands, so either arrival order works.

Still true and still unexercised: **no calendar write anywhere** (Phase 2), and no booking has
ever run for a client that *has* a subscription row and a real inbox.
</details>

### Three corrections from 2026-08-04 - read before repeating them
1. **`model_high_priority` is NOT a latency lever - it made things 4x worse.** Enabling it took
   LLM p50 from 2323ms to 9635ms, with every turn flat within 9ms. A near-constant latency is a
   queue or timeout, not compute; real compute varies. It is reverted and must stay `false`.
2. **A slow *first reply* is older than any of today's work.** The 07:13 baseline, on the old
   prompt and old config, opens at 9536ms then settles to ~1.7s. First replies ranged 2207ms to
   9910ms on identical config. It was wrongly blamed on `high_priority`, which actually caused a
   different fault (all turns slow, not just the first).
3. **Retell's transcript splits an agent turn whenever ASR hears anything - it is NOT a record of
   what the caller heard.** A "chopped sentence" in `transcript_object` was diagnosed as an
   interruption bug; Chris was on the call and confirmed she spoke straight through.
   `interruption_sensitivity` was changed 0.9 -> 0.5 on that false premise. Harmless, left at
   0.5, but it fixed nothing. **Do not diagnose call quality from the transcript when a human
   heard the call.**

### Recently closed - do NOT re-diagnose
- **The demo line's script was rewritten for speed (2026-08-04, commit `9f3e168`).** Chris
  reported lag on (817) 635-0220. Root cause was not the model:
  - **The prompt called a tool that has never existed.** It said `get_available_slots`; the
    LLM's tools are `end_call`, `check_availability`, `capture_lead`, `book_appointment` (and
    before the migration, `Calendar_for_Demo`). The model had to notice and recover every
    scheduling call. `scripts/retell/update-demo-script.mjs` now **aborts** if the prompt names
    a tool the LLM lacks - trading one wrong name for another is the bug being fixed.
  - **Prompt 3,658 -> 1,506 chars.** The nine single-vertical demo agents run ~930 and the real
    client agent 1,373; the shared line carried ~4x that, mostly a "silently classify the caller
    into one of nine industries" step plus a 13-step procedure, re-processed every turn.
  - `model_high_priority` was set true here and **reverted the same evening** - it quadrupled
    latency. See the corrections section above. The model was later moved to `claude-4.5-haiku`
    on measured evidence, which is the current state.
  - Greeting dropped "ABC Company" (read as a forgotten placeholder, and wrong for eight of the
    nine verticals). Provisioned client agents still get the real business name from
    `lib/retell-provisioning.ts:59`.
  - **It stays multi-vertical on purpose.** All nine landing pages publish this one number
    (checked across `public/` and `app/`), so narrowing to one or two verticals would hand most
    callers a mismatched agent. The fix was to stop making the model *classify* before
    responding, not to remove the breadth.
  - Only the shared `369 Demo Agent` LLM changed. The nine vertical demo agents have no phone
    number. Rollback values are in the script's header comment.
- **Ava now books real appointments (2026-08-04, PR #19, merge `b8eda96`).** Ava was
  **inventing times**: `/api/available-slots` hardcoded 10:00 AM and 2:00 PM, Mon-Fri, always
  `America/Chicago`, and read neither a calendar nor the `bookings` table - so she could hand
  the same Tuesday 10:00 AM to five callers. `appointment_time` is TEXT, so nothing could say
  when an appointment *ended*, making overlap detection impossible.
  - `client_schedules` (per-client timezone, weekday hours, job length, how many jobs run at
    once, lead time, horizon - all defaulted), `bookings.starts_at`/`ends_at`, and `book_slot()`
    which does the capacity check and insert in **one transaction** behind an advisory lock.
  - `lib/availability.ts` is pure and `Intl`-only, no new dependency. 25 tests covering both
    2026 DST transitions and the ambiguous repeated hour at fall-back.
  - `/api/available-slots` is now a per-client **POST** behind the shared-secret gate (it needed
    no secret before, because it returned nothing but invented dates). `/api/book-appointment`
    returns **409 `slot_unavailable`** rather than silently double-booking.
  - **Verified live:** migration applied, `scripts/probe-booking-availability.mjs` passed every
    check against production including a real double-book attempt, overlap attempt and
    back-to-back booking. Production returns real slots for the correct timezone. The full
    Retell envelope (`{call:{call_id}}`) resolves call -> client -> schedule -> slots, HTTP 200.
  - **Retell side is migrated:** all 11 LLMs, `Calendar_for_Demo` -> `check_availability`,
    GET -> POST, secret added. Re-ran `recon.mjs`: 11/11, zero stragglers.
  - **Agent-version trap checked explicitly.** `+18176350220` is pinned to agent **v18**; v18's
    response engine references LLM `llm_a7acd10debcb797a013eb8378d20` **v18**; that LLM version
    carries the new tool. The pin is not stale. This is the exact chain that broke for ten days.
  - Watch item: `scripts/retell/update-availability-tool.mjs` reads the secret from a sibling
    tool on the same LLM rather than local env, because the local env file has no
    `RETELL_WEBHOOK_SECRET` at all while production does. Do not "fix" that by trusting env.
- **The three ops-brief PRs are MERGED and live (2026-08-04).** #16 -> #17 -> #18, in that
  order; merge commit `56af461`. Verified on merged `master`: `tsc` clean, `npm test` 57/57,
  `next build` succeeds, Vercel production deploy green, homepage 200 and
  `POST /api/admin/ops-brief/upload` still 401s unauthenticated.
  - **#16** - ops-brief errors now name the actual failure (SDK error class + HTTP status +
    truncated message), with a precise `ANTHROPIC_API_KEY is not set` branch. Admin-only
    route; the key itself is never echoed.
  - **#17** - `isBackordered()` widened from `/back/i` to handle Y/N flags, and it matches
    explicit negatives *as negatives* rather than letting them fall through, so a later
    pattern change cannot silently turn `N` into a backordered line. `stockout_risk_sku_count`
    relabelled to "Lines At/Below Reorder Point" (no SKU column exists to deduplicate on); the
    key is unchanged to avoid a migration. Also added `scripts/test-resolver.mjs`, which is
    what made `lib/ops-brief-metrics.ts` testable at all - 7 tests, both cases found on the
    real messy fixture, not by reading code.
  - **#18** - stays on `claude-sonnet-4-6` with the benchmark reasoning written into the
    comment. Two real hardening fixes: read the *first text block* rather than `content[0]`
    (position 0 is a thinking block when thinking is on, which silently yields `''` and
    surfaces as an unparseable-JSON error), and an explicit `stop_reason === 'refusal'` check.
  - Watch item, not a bug: `isBackordered` treats a bare `'x'` as backordered, which is right
    for checkbox-style exports but would misread a column where `x` means something else. The
    metric's `reason` field would make that visible if it ever bites.
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
1. **Ops-brief has nothing blocking it.** The admin UI, the HTTP routes and the whole
   parse -> map -> metrics chain have now been exercised through a real admin session, and
   the three fix PRs are merged. Next time an upload runs, confirm the relabelled stockout
   metric and a Y/N backorder column both read correctly on a *live* file.
2. **Place the real call** (see START HERE). Nothing else can substitute for it.
3. **Phase 2 of the booking work: Google Calendar behind a provider seam.**
   **BLOCKER FOUND 2026-08-04: the site has no privacy policy and no terms page at all.**
   (`app/legal` is the lawyer vertical, not legal documents - do not be fooled by the name.)
   Google will not accept a sensitive-scope verification without a privacy policy URL on the
   same domain, publicly reachable and linked from the homepage, that explicitly describes how
   Google user data is used, stored and shared. **Nothing about the OAuth submission can start
   until that page exists**, so it sits in front of the 10-day review clock. Write it before
   touching the Google Cloud console.
   Decision made and researched 2026-08-04 - **Google first, Microsoft Graph second,
   never Apple/CalDAV.**
   Google Calendar API is $0 at this volume and $0 to the client, who already has it. Cal.com
   Platform was **rejected**: ~$299/mo plus per-booking overage, a fixed cost before the first
   paying client. Apple has no public REST API or OAuth at all - CalDAV with a 16-character
   app-specific password the client generates *by hand*, which cannot be automated and kills
   "live within minutes of signup". iCloud-only owners get an `.ics` on Nova's existing email.
   **Start the Google OAuth verification submission early** - the calendar scope is *sensitive*,
   so data-access review takes up to 10 days. It is free, and it gates nothing else. Do not ship
   on Testing mode: refresh tokens there have a limited lifetime and the integration would die
   silently, which is the failure pattern that has already cost two outages.
4. **Phase 2b bulk runner - NOT built, deliberately.** It manufactures the proprietary
   statistic that replaces the removed borrowed ones. Everything it needs is built and
   tested (`tallyAuditCalls`, `unreachedShare`, honest denominators, 30-call minimum).
   **Blocked on a decision only Chris can make:** cold-calling businesses that never made
   contact is a different legal posture from calling a form submitter - Texas telemarketing
   registration and do-not-call apply. Do not build this unprompted.
5. ~~Schedule `scripts/audit-retell-webhooks.mjs`.~~ **Done - PR #22**, daily Vercel cron at
   12:00 UTC. Also compares the secret *value* against `RETELL_WEBHOOK_SECRET`, which catches a
   rotation mismatch that a presence-check would pass. Alerts only on a problem.
6. **`lib/email-templates.ts` is unreferenced dead code.** All four templates lost their only
   caller when `/api/update-dossier` was deleted. Plan Phase 2a earmarks them for reuse.
7. **Three other Anthropic call sites still pin `claude-sonnet-4-6`** (`email-ingest`,
   `felix/conflict-check`, `nova-templates`). Deliberately left alone - the latter two run
   mid-call on live Retell traffic. Read the benchmark note below before changing any of them.

### Still inaccurate on the site - Cal.com copy (product decision now RESOLVED)
**Ava's agent page still claims she "books directly on your Cal.com calendar".** She now books
real appointments against real availability (above), but **no calendar write exists at any
step**, and the connector will be **Google, not Cal.com** - so this copy is wrong today and
will still be wrong after Phase 2 ships.

Two lines need rewording once Google lands, and Chris deliberately chose 2026-08-04 to leave
them until then:
- `app/agents/[agent]/page.tsx:50` - "books directly on your Cal.com calendar"
- `app/agents/[agent]/page.tsx:62` - the `Cal.com (booking)` entry in the tech list

The **product** half is settled: Google first, Microsoft Graph second, never Apple/CalDAV
(see Open item 3 for the cost and OAuth reasoning). The `.ics`-on-Nova's-email idea survives
only as the fallback for iCloud-only owners - it was rejected as the *primary* answer because
it records a booking without ever checking whether the time is free, which was Chris's own
objection and the correct one.

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
node scripts/probe-booking-availability.mjs   booking schema + a REAL double-book attempt
node scripts/verify-booking-notifications.mjs [hours] [--repair]
                                         orphaned bookings + unsent confirmations; --repair
                                         links them (sends nothing - those dates are past)
node --import ./scripts/test-resolver.mjs scripts/verify-client-schedule.mjs
                                         a REAL client_schedules row, written then deleted
node --env-file=.env.local scripts/retell/recon.mjs                       every LLM's tool URLs
node --env-file=.env.local scripts/retell/update-availability-tool.mjs    dry run; --apply to write
node --env-file=.env.local scripts/retell/update-demo-script.mjs          demo prompt; aborts on bad tool names
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

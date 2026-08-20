# What Can I Actually Deliver Today

**Ground truth as of 2026-08-20 (overnight).** Read this before a sales call, before a chamber event,
before quoting a feature, before flipping Stripe to live.

> **Companion docs.** `369-SYSTEM-BLUEPRINT.md` explains the architecture; `ROADMAP-TO-REAL-AGENCY.md`
> is the dated history. **Both are stale (Jul 16) and carry a banner saying so.** This file is the
> only one in this folder maintained as current. For coding rules, see `CLAUDE.md` in the repo root.

## How this was verified

Everything below was checked against the live system on 2026-08-19, not read out of a prior doc.
Retell agent and number counts came from the Retell API; row counts from production Supabase; the
Stripe mode and webhook state from the Stripe API; feature flags from env and code. Where
something is **claimed but unverified**, it says so in place.

**"Greenlit" here means three things at once:** the code is deployed, it is legally clear to use
(AI disclosure, SMS consent), and it is not sitting behind an off switch. Something can be fully
built and still not deliverable — usage billing is the clearest example.

---

## The short version

**The product works. The path to being paid for it does not, right now.**

Ava answers calls 24/7, qualifies, captures leads, checks real availability against the owner's
Google Calendar, books, and sends confirmations — proven on real calls, at 964ms p50. That is
genuinely deliverable in **8 verticals** today (all but dental).

**And as of 2026-08-20 the phone line itself is unreliable** — agents intermittently answer, play
the greeting, and never speak again (Retell-side first-token timeout, ruled out on our side).
Calls do get through, but not on demand. **Do not stake a live demo on a single call.**

Beyond that, three things are off, and two of them deliberately:

1. **Stripe is in test mode** and its only webhook endpoint is **disabled**. A checkout on the
   live site today provisions **nothing**. Safe and intentional with zero paying clients — but it
   means *nobody can buy* until it is re-enabled.
2. **No client has a Google Calendar connected** (`calendar_connections` = 0). The booking chain is
   proven, but every new client must complete OAuth — and until Google verification clears they see
   an "unverified app" warning first.
3. **SMS does not exist in either direction.** No inbound route, Twilio unconfigured, A2P brand
   unregistered. Everything SMS-shaped is a promise, not a capability.

**Zero paying clients. One subscription row (Northside, a test client). 55 calls, 27 leads, 21
bookings all-time.** Nothing here has been proven at volume.

---

## Live system state — 2026-08-19

| Thing | State |
|---|---|
| Retell agents | **11** — 9 vertical templates + the shared demo agent + Northside |
| Retell numbers | **2** — (817) 635-0220 demo, (817) 612-6757 Northside |
| `agent_subscriptions` | **1** (Northside — test client, no Stripe anchor) |
| `calendar_connections` | **0** |
| `client_schedules` / `client_inventory` | **0** / **0** |
| `calls` / `leads` / `bookings` | 55 / 27 / 21 (all-time) |
| Stripe | **test mode**; sole webhook `we_1Trrqk3nqoZlRtPEan18MmjD` **disabled** |
| Pricing | $400 / $600 / $750 flat. `SETUP_FEE = 0`. No minute limits advertised. |

---

## The engine — shared by every vertical

All nine verticals run the *same* system. A vertical is a template agent, a landing page, and some
copy — not a separate product. So this table is where most of the truth lives, and the per-vertical
sections below record only where a vertical **differs**.

### Deliverable today

| Capability | Notes |
|---|---|
| **24/7 call answering** (Ava) | Dedicated agent + number per client. `claude-4.5-haiku`, 964ms p50. |
| **AI disclosure** | Greeting names Ava as an AI assistant — **verified on all 11**. Texas TRAIGA. The in-prompt backstop line is present on 10 of 11 (Northside lost it, see item 5). |
| **Lead capture** | `capture-lead`, writes `leads`, real-time owner email alert. |
| **Real availability + booking** | `available-slots` / `book-appointment`, capacity-checked in one transaction behind an advisory lock. Cannot double-book. |
| **Google Calendar awareness** | Reads owner freeBusy; refuses rather than offering a time it cannot verify. Writes the event back. **Requires the client to connect — nobody is connected today.** |
| **Booking confirmations** (Nova) | Email + `.ics`. All 9 verticals. |
| **Follow-up sequences** (Rex) | 3-step, all 9 verticals, Pro/Elite gated. **Email only.** |
| **Per-client personalization** | Questionnaire merges into the agent prompt. Proven on a real call. |
| **Per-item rental inventory** | `client_inventory` + `bookings.inventory_item_key`. Read live on every call, and **reachable by voice as of 2026-08-20** — until then `check_availability` had no `item` parameter, so it shipped in August and no caller could ever name a unit. |
| **Multi-day rental windows** | Shipped 2026-08-20. Ava offers "Friday through Monday — 3 days", refuses a hire shorter or longer than the item allows, and the unit is held for the **whole** span, not one slot. Verified against production. |
| **Ambiguity refusal** | A name matching several items ("bounce house") is answered with "which one?", never with a guess or with appointment times. Over four candidates she asks them to narrow rather than reciting a catalogue. |
| **Per-client hours / horizon** | `client_schedules`. Read live. |
| **Client dashboard** | Calls, leads, bookings, transcripts, billing portal, CSV export. |
| **Usage metering** | Reconciled exactly against Retell for the first closed period. |
| **Automated provisioning** | Checkout → agent + number + rows, with a duplicate-delivery guard and area-code fallback. **Gated by the disabled webhook.** |

### Built but switched OFF — a decision, not a build

| Capability | What it needs |
|---|---|
| **Usage billing / overage** | `USAGE_BILLING_ENABLED=true` in Vercel + redeploy. **Flip the pricing copy in the same move.** Run `verify-billing.mjs` first. Caveat: the overage arithmetic has never met real data — the one closed period had zero overage. |
| **Taking real money** | Stripe live mode, and re-enable the webhook. |

### Not built — do not sell

| Gap | What is needed |
|---|---|
| **Inbound SMS** | No route exists. Needs the Retell chat-agent spike (can it call the existing tools?), then A2P clearance. |
| **Outbound SMS** | `lib/twilio-sms.ts` sends only; **Twilio unconfigured**; A2P brand unregistered. |
| **Text-to-Quote** | Needs SMS first. v1 must be draft → owner approves → send. Never auto-price. |
| **Voice reliability on this account** | 🔴 **The current blocker.** Agents intermittently answer, play the greeting and never speak again — Retell reports a 3000ms first-token timeout. Ruled out on our side (model measures ~700ms, versions aligned, concurrency clear). Calls do get through, but not dependably. **Do not demo on a single call.** |
| **Conversational latency** | Regressed to **llm p50 1438ms / e2e 1821ms** against a 964ms benchmark — noticeably less fluid. Cause is prefill growth in tool descriptions and the system prompt. Trimmed once; more warranted. |
| **Inventory UI** | No screen reads or writes `client_inventory`. A client cannot fix a quantity or take a torn item out of service. |
| **Bulk quantities** | Every booking consumes exactly 1 unit. "200 chairs" means 200 separate bookings, not one order of 200. |
| **Deposits / waivers** | Nothing exists. Standard for bounce houses and equipment. |
| **Owner SMS alerts** | `owner_phone` and `followup_method` are captured at onboarding and never read. |
| **Scout** (SaaS) | Marked DEPLOYING on the site. Not built. |

---

## Per-vertical breakdown

### Roofing · HVAC · Plumbing

- **Deliverable today:** everything in the engine table. Ava, Rex, Nova all live. Template agent
  exists. Landing page + ROI calculator + intake live.
- **Not deliverable:** SMS quoting, storm-surge texting, anything SMS.
- **Needed to finish:** nothing vertical-specific. These are the most complete verticals and the
  only proven ones — **Northside (roofing) is where the calendar chain and owner alerts were proven.**
- **Note:** the top-ten Texas roofing company in the network is an *after-hours + storm surge* play,
  not a replacement sale. Storm surge is a capacity problem, which `max_concurrent_per_slot` already
  models. Needs no code — only the right framing.

### Tree services / stump grinding — *no page; sold as the roofing/plumbing shape*

- **Deliverable today:** everything. Speed-to-lead plus an on-site estimate booked to the calendar
  is exactly what is built. Nobody quotes a removal by text, so the missing SMS layer costs nothing.
- **Not deliverable:** nothing it actually needs.
- **Needed to finish:** **nothing. This is the fastest pilot available and requires no new code.**
  It has no landing page, which is a marketing gap, not a product one.

### Legal

- **Deliverable today:** engine + **Felix conflict check** (`/api/felix/conflict-check`), live.
- **Not deliverable:** document drafting; intake beyond qualification.
- **Needed to finish:** nothing. Felix pins `claude-sonnet-4-6` and runs mid-call on live traffic —
  **measure before changing that model.**

### Real Estate

- **Deliverable today:** full engine. Ava, Rex, Nova live.
- **Not deliverable:** SMS, listing-system integration.
- **Needed to finish:** nothing. The realtors in the network can be sold what exists today.

### Insurance

- **Deliverable today:** full engine.
- **Not deliverable:** claims triage, policy lookup.
- **Needed to finish:** nothing.

### Wholesale / Distribution

- **Deliverable today:** full engine, plus the **ops-brief spreadsheet importer** (CSV + XLSX) —
  the same parser that bulk-loads rental inventory.
- **Not deliverable:** quoting, multi-day holds.
- **Needed to finish:** nothing for the core offer.

### SaaS

- **Deliverable today:** engine works. Ava, Rex, Nova live.
- **Not deliverable:** **Scout is marked DEPLOYING on the site and does not exist.**
- **Needed to finish:** either build Scout or change the badge. **Deliberately deprioritized** —
  phone is a weak channel for SaaS, so don't lead with it. The honest move is fixing the badge.

### Dental — **NOT deliverable, by design**

- **Deliverable today:** nothing. All agents marked FUTURE. `dental-leads` has no intake form, and
  `/dental/pricing` **redirects to the waitlist** so nobody can be charged without provisioning.
- **What exists:** a Dental Demo Agent on Retell, Rex + Nova content, the landing page. The
  template-id typo is fixed in both `.env.local` and Vercel.
- **Needed to finish:** a decision to launch, then flip the agents off FUTURE and remove the pricing
  redirect. **The gating is intentional — leave it until dental is actually wanted.**

---

## The rental niches — no vertical page, and that is correct

This is where the *next* client comes from. **Three pages are GREENLIT as of 2026-08-19** — Event &
Party Rentals, Dumpster & Portable Restrooms, and Equipment Rental — grouped by who is buying, so
one specific person can be pointed at one specific page. This **reverses** the older "do not add
vertical pages" rule, which was written when nine pages were live with zero distribution; the
chamber face-time is what changed it. **That reversal does not extend to the original nine.**

**The multi-day engine is being built FIRST**, because two of the three pages cannot truthfully
describe their core service until it exists (see below, and "What to finish, in order").

**All of these must be provisioned under one of the 9 existing verticals.** `TEMPLATE_AGENT_IDS` in
`lib/retell-provisioning.ts` has exactly 9 keys, and `vertical` comes from Stripe's
`client_reference_id`. **A checkout with `client_reference_id=entertainment` throws
`No template agent configured` and provisions nothing.** The questionnaire does the real
personalizing on top, so this is a choice to make deliberately — not a blocker, but not a
detail to discover during a live onboarding either.

### Party / event rental — mobile casino, DJ, bounce houses — **THE PILOT**

- **Deliverable today:** call answering, lead capture, **per-item availability** (the princess castle
  vs the castle combo), booking, calendar, confirmations. The inventory work shipped 2026-08-16
  specifically for this shape.
- **Multi-day hire now works** (2026-08-20): she offers real windows, refuses a length the item is
  not hired out for, and holds the unit for the whole span.
- **Not deliverable:** bulk quantities, deposits, waivers, SMS, quoting.
- **Needed to finish the pilot:**
  1. Pick the vertical she is provisioned under — no `entertainment` template exists.
  2. Re-enable the Stripe webhook, then run a 100%-off checkout to get a real
     `stripe_subscription_id` — the billing anchor Northside can never have.
  3. **Write `client_schedules` explicitly.** Defaults close Sat + Sun and cap the horizon at
     **14 days**. A party-rental business is almost entirely weekends and books months ahead — on
     defaults Ava refuses every Saturday and anything past a fortnight, and it reads as a bug in the
     booking engine rather than as configuration. Use `setup-client-schedule.mjs`.
  4. Load real inventory rows — `setup-client-inventory.mjs` takes her own spreadsheet.
  5. Connect her calendar. She will see the unverified-app warning until Google clears.
  6. A real test call.
- **Known sharp edge:** a bounce house booked Saturday 10:00 for 90 minutes reads as *free* at noon,
  while it is physically at a party until Sunday. Same root cause as the missing 7-day dumpster hire.
  **Her stock is identity-shaped, so per-item counts carry the pilot** — but this will bite the first
  time someone books a full weekend.

### Dumpster rental · portable restrooms

- **Deliverable today:** call answering, lead capture, booking of a *same-day* slot.
- **Multi-day hire shipped 2026-08-20** — the blocker that made this niche unsellable is gone.
- **Not deliverable:** rate-card quoting by SMS; bulk quantity ("four restrooms" is still four
  separate bookings).
- **Needed to finish:** a deterministic rate card, then SMS. The booking half now works.

### Skid steer · equipment · party bus

- **Deliverable today:** per-item availability and booking.
- **Not deliverable:** quoting, multi-day windows, deposits.
- **Needed to finish:** as dumpsters, plus damage deposits. Equipment-yard owners think in assets and
  often prefer a setup fee with a lower monthly — `SETUP_FEE` is 0 and would need revisiting **for
  these niches only, and only with real pricing.**

---

## What to finish, in order

Ordered by what unblocks the most. **The first two are calendar time, not build time** — they run
whether or not anyone is at a keyboard, and neither has started.

1. **Register the A2P brand + campaign** for `3SIX9 MEDIA MASTERS LLC`. Low-volume standard, ~$19
   one-time. Gates *every* SMS track. Register directly with Twilio, never through a reseller.
   **Do not give Northside a Secondary Profile** — a rejection damages the Primary trust score.
2. **Submit for Google verification.** Needs a demo video of end-to-end OAuth consent. Up to 10 days.
   Until it clears, every new client sees an unverified-app warning and there is a 100-user cap.
   Record it signed in as `damozman@yahoo.com`, calling **Northside** — a demo-line call proves nothing.
3. **Re-enable the Stripe webhook** (`we_1Trrqk3nqoZlRtPEan18MmjD`). Nothing provisions until it is
   on. Disable it again afterward if not going live immediately.
4. **Prepare the pilot** — decide her vertical, then schedule → inventory → calendar → test call.
   She is back ~2026-09-02; the chamber event is ~mid-September.
5. **Fix Northside's prompt — and the mechanism that broke it.** Verified against the live agent
   2026-08-19: Northside's greeting still discloses AI (TRAIGA intact), but its `general_prompt` is
   **735 chars vs the roofing template's 1239** and has lost both the *"asked whether you're AI"*
   backstop and the whole `sms_consent` instruction. It is the **1 of 11** that
   `set-ai-disclosure.mjs` and `set-sms-consent.mjs` both still flag.
   **Order matters:** re-fill the questionnaire **first**, *then* re-run both scripts with
   `--apply`. Backwards, the re-fill deletes them again.
   **The underlying bug is not Northside-specific.** Both compliance scripts append their line to
   the **end** of the prompt; `mergePromptWithContext` cuts from `BUSINESS_CONTEXT_START` to the
   end. So any compliance line appended **after** a client's context block is silently deleted by
   their next questionnaire submit. A brand-new client is safe (the template's text sits in the
   base, before any marker), but **a re-submit — editing hours or stock months later — strips it.**
   Durable fix: write compliance lines into the base, or preserve trailing content after
   `BUSINESS_CONTEXT_END`. **Not built.**
6. **Fix the SaaS Scout badge** (or build Scout). It currently claims DEPLOYING for something that
   does not exist.
7. **Audit the other five crons' real output.** `silence-check` selected a column that never existed
   and failed silently for months — nobody read its output, only that it ran. Assume siblings.
8. **Flip usage billing** only when Stripe is live — **and move the pricing copy in the same commit.**
   Advertising minutes before the meter bills them has already shipped once.

**Deliberately not on this list:** more vertical pages. Nine are live, zero clients have ever paid,
and the one real subscription logged 18 minutes in a month. Distribution was always the constraint —
a warm introduction beats a tenth landing page.

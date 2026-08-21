# What Can I Actually Deliver Today

**Ground truth as of 2026-08-21.** Read this before a sales call, before a chamber event,
before quoting a feature, before flipping Stripe to live.

> ✅ **The three rental pages ARE on production as of 2026-08-21.** `feat/rental-vertical-pages`
> merged (`--no-ff`, `299f60e`) and auto-deployed. Verified against the live site, not assumed:
> `/event-rentals`, `/dumpster-rental` and `/equipment-rental` all serve 200, each `-leads` page
> serves 200, and `/{slug}/pricing` returns **307 to `/book-demo`** on all three.
>
> **Point people at those URLs — they work.** Merging did **not** make the pilot safe on its own:
> see the Nova fallback in "Not built — do not sell", and step 0 of the pilot checklist.
>
> **For build order, see `docs/ROADMAP.md`** — the operational roadmap, written 2026-08-21. This
> file stays the answer to "what can we sell today"; that one answers "what do we build next."

> **Companion docs.** `369-SYSTEM-BLUEPRINT.md` explains the architecture; `ROADMAP-TO-REAL-AGENCY.md`
> is the dated history. **Both are stale (Jul 16) and carry a banner saying so.** This file is the
> only one in this folder maintained as current. For coding rules, see `CLAUDE.md` in the repo root.

## How this was verified

Everything below was checked against the live system, not read out of a prior doc. Retell agent and
number counts came from the Retell API; row counts from production Supabase; the Stripe mode and
webhook state from the Stripe API; feature flags from env and code. Where something is **claimed but
unverified**, it says so in place.

**Re-derived 2026-08-21:** the Supabase row counts below (`calls` 72, `leads` 31, `bookings` 24,
`agent_subscriptions` 2, `calendar_connections` 0, `client_schedules` 1, `client_inventory` 40) and
the branch state of the rental pages (`git ls-tree master`). This pass corrected a **contradiction
inside this file** — the summary said 55/27/21 while the table said 72/31/24; production says the
table was right. Everything else dates from the 2026-08-19/20 sweep and was not re-checked here,
including the Retell and Stripe state.

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

**Zero paying clients. One real subscription row (Northside, a test client). 72 calls, 31 leads, 24
bookings all-time.** Nothing here has been proven at volume.

---

## Live system state — Supabase re-derived 2026-08-21, rest 2026-08-20

| Thing | State |
|---|---|
| Retell agents | **11** — 9 vertical templates + the shared demo agent + Northside |
| Retell numbers | **2** — (817) 635-0220 demo, (817) 612-6757 Northside |
| `agent_subscriptions` | **2** — Northside (test client, no Stripe anchor) + a leftover `review-sandbox` row with no agent |
| `calendar_connections` | **0** |
| `client_schedules` / `client_inventory` | **1** / **40** (38 active, 12 hired by the day) — all Northside's, see below |
| `calls` / `leads` / `bookings` | **72 / 31 / 24** (all-time); **54 minutes in the last 30 days** |
| Stripe | **test mode**; sole webhook `we_1Trrqk3nqoZlRtPEan18MmjD` **disabled** |
| Pricing | $400 / $600 / $750 flat. `SETUP_FEE = 0`. No minute limits advertised. |

> ⚠️ **Northside is no longer a roofing agent.** It was converted on 2026-08-20 into an
> event/party-rental test agent: rental prompt, 40 mock inventory rows, weekend hours, 180-day
> horizon. Original LLM config is backed up. It is the only client with inventory or a schedule,
> and those rows are **test data, not a real yard**.

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
| **Booking confirmations** (Nova) | Email + `.ics`. **The 9 verticals only** — `NovaVertical` in `lib/nova-templates.ts` has exactly those keys, and anything else silently falls back to roofing copy. Fine for all 9; a live landmine for a rental client, see below. |
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
| **Inventory UI** | **Corrected 2026-08-21:** the questionnaire *writes* `client_inventory` (`app/api/questionnaire/submit/route.ts`), so the old claim that nothing under `app/` touches it was wrong. But **no screen ever reads it back** — the form starts from one blank row and never prefills — so a client cannot see their stock, fix a quantity, or take a torn item out of service. Worse, a partial re-submit **deactivates every item it omits**. See `ROADMAP.md` Track 2.1. |
| **Bulk quantities** | Every booking consumes exactly 1 unit. "200 chairs" means 200 separate bookings, not one order of 200. |
| **Deposits / waivers** | Nothing exists. Standard for bounce houses and equipment. |
| **Owner SMS alerts** | `owner_phone` and `followup_method` are captured at onboarding and never read. |
| **Scout** (SaaS) | Marked DEPLOYING on the site. Not built. |
| **Nova for any rental vertical** | 🔴 **Hits the pilot.** `lib/nova-templates.ts:78` is `VERTICAL_COPY[input.vertical] ?? VERTICAL_COPY.roofing`, and roofing's `visitNoun` is `'inspection'`. A party-rental client provisioned under one of the 9 gets their bounce-house hire confirmed to their customer as an **inspection**, and Nova introduces herself as writing for a roofing company. Silent, customer-facing, no error. The real defect is the fallback, not the missing keys — an unknown vertical should refuse, the way an unknown inventory key already does. |

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

## The rental niches — three pages LIVE, engine live behind them

This is where the *next* client comes from. **All three pages were built 2026-08-20 and shipped to
production 2026-08-21** — Event & Party Rentals, Dumpster & Portable Restrooms, and Equipment
Rental — grouped by who is buying, so one specific person can be pointed at one specific page. This
**reversed** the older "do not add vertical pages" rule, written when nine pages were live with
zero distribution. **That reversal does not extend to the original nine.**

> ✅ **Servable today, verified live.** The gate on merging was Chris's own word-by-word copy pass;
> it ran on 2026-08-21 and produced five fix commits (wholesale-template residue, a false audit
> promise on all 11 form pages, an overstated Nova claim, pronouns and spelling, and a comment on
> an unscheduled cron). The branch was green at merge — tsc clean, 248 tests, production build
> clean, mobile audit clean across 152 page/width combinations — and all of it was re-run
> immediately before the merge rather than taken on trust.

Each niche now has **two** artifacts, mirroring the original verticals:
- A Next.js intake route — `/event-rentals`, `/dumpster-rental`, `/equipment-rental` — with the
  shared intake form and ROI calculator. **`/{slug}/pricing` redirects to `/book-demo`**, on
  purpose: `TEMPLATE_AGENT_IDS` has nine keys and a rental checkout would throw
  `No template agent configured` *after* the card was charged. Same guard as `/dental/pricing`.
- A long-form cold-email page — `/event-rentals-leads/`, `/dumpster-rental-leads/`,
  `/equipment-rental-leads/` — each carrying a six-category **catalogue** of what the niche
  actually rents. That catalogue is the sales material: it is what Chris reads before a chamber
  conversation, and it doubles as the argument for ambiguity refusal.

All three are reachable from the live homepage: Event & Party Rentals holds the **second featured
card**, dumpster and equipment sit in the grid, and all three are in the footer. Every one of the
homepage's 30 internal links was swept on production after the deploy and returns 200.

**The engine they were waiting on shipped the same day.** Multi-day hire, per-item availability
reachable by voice, ambiguity refusal, and a signed booking handle are all live and verified
against production. The constraint was Chris's own — *"we're not putting anything on the pages that
isn't truthful"* — and two of the three could not honestly describe their core service until
multi-day hire existed.

**No page claims SMS, quoting, deposits, waivers or bulk quantities**, and none asserts an industry
average job value — the figure in each ROI calculator is labelled a starting estimate the visitor
moves, because there is no data behind an average for these niches.

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
  0. 🔴 **Fix Nova's roofing fallback first.** Whichever of the 9 she is provisioned under, her
     customers' confirmation emails describe the booking as an **inspection** and Nova writes as a
     roofing company — `lib/nova-templates.ts:78`. Nothing errors, so this will not be caught by a
     test call unless someone reads the confirmation email end to end. This is the one item on the
     list that reaches her *customers* rather than her.
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

> **`docs/ROADMAP.md` is the sequenced version of this list**, ordered against the two dates that
> actually govern it (the pilot returning ~2026-09-02, the chamber event ~mid-September). What
> follows is the same material grouped by *what blocks it*. Use this section to understand a gap;
> use the roadmap to decide what to do on a given day.

The split is deliberate: the first group **runs on calendar time** — filed once, then waiting — and
the second is **build time that nothing blocks**. Start the first group, then work the second while
it clears. Do not sit waiting on any of it.

### Group A — start these, then stop thinking about them

1. **Register the A2P brand + campaign** for `3SIX9 MEDIA MASTERS LLC`. Low-volume standard, ~$19
   one-time. Gates *every* SMS track. Register directly with Twilio, never through a reseller.
   **Do not give Northside a Secondary Profile** — a rejection damages the Primary trust score.
2. **Submit for Google verification.** Needs a demo video of end-to-end OAuth consent. Up to 10 days.
   Until it clears, every new client sees an unverified-app warning and there is a 100-user cap.
   Record it signed in as `damozman@yahoo.com`, calling **Northside** — a demo-line call proves nothing.
3. **The Retell ticket is filed** (2026-08-20) for agents that answer, greet, then never speak.
   Their own log named three providers failing identically while the same payload answered in
   571ms direct. **Do not re-diagnose or re-test the config while it is open** — it has been
   exonerated four times. Voice testing is blocked until they reply.

### Group B — buildable right now, nothing blocks these

**Ordered by what helps the chamber event most.**

1. **Cut per-turn prefill.** Conversational latency regressed to **llm p50 1438ms / e2e 1821ms**
   against a 964ms benchmark — audibly less fluid. Cause is prose in tool descriptions and the
   system prompt, re-sent every turn. Trimmed once (12,108 → 9,868 chars); `capture_lead` is still
   **2,571 chars** and is the fattest remaining target. **Measurable without a phone call** — send
   the live prompt and tools straight to the model and time to first token, but do it
   mid-conversation: a single-turn probe reads ~700ms while a real call averages 6,602 tokens.
2. **Nova's vertical fallback.** `VERTICAL_COPY[input.vertical] ?? VERTICAL_COPY.roofing` turns any
   unknown vertical into a confidently wrong confirmation email rather than a refusal. Blocks the
   pilot from sending correct confirmations, and it is a handful of lines. Do this before the
   inventory screen if the pilot is close.
3. **An inventory screen.** **Corrected 2026-08-21** — the old note here said
   `grep -rln client_inventory app components` returns nothing; it returns
   `app/api/questionnaire/submit/route.ts`, which *writes* the table. The real gap is that
   **nothing reads it back**: the questionnaire form starts from a single blank row and never
   prefills, so a client cannot see their stock, fix a mistyped quantity, or take a torn bounce
   house out of service. The `active` column exists and is read live; it is simply unreachable.
   A read/edit screen is also the durable fix for the destructive re-submit in Track 2.1 of
   `ROADMAP.md`. Pure Next.js, no vendor.
4. **`capture_lead` sends the wrong `vertical`.** It sent `"wholesale"` on a roofing-domain client
   on three separate calls, mislabelling every lead. Small fix, real data quality.
5. **The compliance-line-stripping bug.** `mergePromptWithContext` cuts from
   `BUSINESS_CONTEXT_START` to the end of the prompt, so any line appended **after** a client's
   context block is silently deleted by their next questionnaire submit. A new client is safe;
   **a re-submit — editing hours or stock months later — strips it.** `set-rental-tools.mjs`
   inserts *before* the marker and is immune.
   **Corrected 2026-08-21 — the exposure is smaller than this used to claim.**
   `set-ai-disclosure.mjs` writes **two** fields: the proactive greeting into `begin_message`,
   which is a separate field the prompt-slice never touches, and a backstop line into
   `general_prompt`, which is appended and *is* stripped. **The Texas TRAIGA greeting survives; only
   the answer to "am I talking to a robot?" is lost.** `set-sms-consent.mjs` appends and is fully
   vulnerable. Durable fix: write into the base, or preserve trailing content. Same root cause as
   the inventory loss above — see `ROADMAP.md` Track 2.1, which treats them as one defect.
6. **Audit the other five crons' real output.** `silence-check` selected a column that never existed
   and failed silently for months — nobody read its output, only that it ran. Assume siblings.
7. **Fix the SaaS Scout badge** (or build Scout). It claims DEPLOYING for something that does not exist.
8. **Delete `lib/email-templates.ts`.** All four templates lost their only caller when
   `/api/update-dossier` was removed. Dead code that reads as a live integration.

### Group C — gated on a real client, not on time

- **Re-enable the Stripe webhook** (`we_1Trrqk3nqoZlRtPEan18MmjD`) before any end-to-end run.
  Nothing provisions until it is on. Disable it again afterward if not going live immediately.
- **Prepare the pilot** — schedule → inventory → calendar → test call. She is back ~2026-09-02;
  the chamber event is ~mid-September. Her `client_schedules` row must be written explicitly:
  defaults close Saturday and Sunday and cap the horizon at 14 days.
- **Flip usage billing** only when Stripe is live — **and move the pricing copy in the same commit.**
  Advertising minutes before the meter bills them has already shipped once.
- **`booking_token` is untested by voice.** It is required on `book_appointment` with `"none"` as
  the escape, and verified against production directly — but no connected call has carried one yet.
  Every booking so far stored `inventory_item_key: null`. Check this on the first call that lands.

**No longer on this list:** *"do not add vertical pages."* That rule was written when nine pages
were live with zero distribution. Distribution arrived, and the three rental pages are greenlit —
see CLAUDE.md. **It still holds for the original nine.**

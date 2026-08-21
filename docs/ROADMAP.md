# The Roadmap

**Written 2026-08-21, the day `feat/rental-vertical-pages` merged to production.**

This is the **operational** roadmap: what to build, in what order, and why that order. It
consolidates material that was scattered across four places and does not replace any of them:

| Source | What it still owns |
|---|---|
| `architecture/WHAT-CAN-I-DELIVER-TODAY.md` | **Delivery state.** What a paying client gets today, per vertical. Read before a sales call. |
| `CLAUDE.md` → Session Handoff | **Working state.** What is in flight right now. |
| `DOSSIER-DESIGN.md` | The dossier feature's own design + build order. |
| `PHASE-2-ROADMAP.md` | **Future paid add-ons** (Quinn, `PREMIUM_ADDONS`). Dated 2026-07-16, planning only. Not operational work — do not confuse it with this file. |

> **Re-derive, never copy forward.** Every claim below was checked against the code or the live
> system on 2026-08-21, not read out of a prior doc. Two things in the older docs turned out to be
> wrong that way; they are corrected in place below and flagged **[CORRECTED]**.

---

## The two dates that order everything

Ordering does not come from the backlog. It comes from two fixed dates:

```
2026-08-21        2026-09-02              ~mid-September
    │                 │                        │
   TODAY         pilot returns            chamber event
    │                 │                        │
    └─ ~12 solo days ─┴──── ~2 weeks ──────────┘
       build window        onboard + rehearse
```

- **~2026-09-02** — Chris's cousin is back. The pilot (her event-rental business) can be onboarded.
  Until then nothing that needs *her* can move.
- **~mid-September** — first chamber event. Chris is in the room with buyers.

**The ~12 days before 2026-09-02 are the only uninterrupted build window in this cycle.** Spend
them on work that has to be done *before* she arrives, not on work that can happen alongside her.

---

## What just changed today

`feat/rental-vertical-pages` merged (`--no-ff`, commit `299f60e`) and auto-deployed. Verified on
production, not assumed:

- All three rental verticals live — `/event-rentals`, `/dumpster-rental`, `/equipment-rental`,
  plus `/{slug}-leads/` for each.
- `/{slug}/pricing` → **307 to `/book-demo`** on all three, so no rental checkout can charge a card
  and then throw `No template agent configured`.
- The false audit promise (*"we'll map your exact…"*) is **gone from all 12 leads pages**.
- No wholesale residue on any rental page — CTA, ROI fallbacks, Nova `alt` text all clean.
- Homepage byte-identical to the repo once line endings are normalised. All **30** internal
  homepage links resolve 200 — no dead audit-picker anchors.

**Undo, if the deploy ever needs reversing:** `git revert -m 1 299f60e`. That is the whole reason
for `--no-ff`.

**One consequence to act on:** `WHAT-CAN-I-DELIVER-TODAY.md` still carries a 🔴 banner saying the
rental pages are not on production. That is now false and it is the doc read before a chamber
event. **Delete the banner and move the rental section from "built" to "deliverable."**

---

## The spine: what must be true, and when

Read this backwards from the chamber event.

### For the chamber event (~mid-September)

| # | Must be true | State today |
|---|---|---|
| 1 | **A demo that works on demand** — hand someone the phone, Ava books *them*, the calendar entry and confirmation email land in front of them | 🟡 **Workaround in hand, unproven.** Retell says switch off Anthropic models; the switch is staged and ready but no call has been placed on it yet. See below. |
| 2 | **Something specific to point each buyer at** | ✅ **Done today.** Eleven verticals + three rental pages, all live. |
| 3 | **A capture path in the room** — card or QR → the demo number, `/api/intake` catches the follow-up | 🔴 **Not built, and not on any engineering list.** See Track 4. |
| 4 | **The ability to actually close** | 🔴 **Nobody can buy.** Stripe is in test mode and its only webhook is disabled. See Track 4. |

### For the pilot (before she takes a real booking from a real customer)

| # | Must be true | State today |
|---|---|---|
| 0 | Nova stops describing a bounce-house hire as an **inspection** | 🔴 Track 2 |
| 1 | Her questionnaire re-submits stop silently destroying her setup | 🔴 Track 2 — **new finding, see below** |
| 2 | A vertical chosen to provision her under (no `entertainment` template exists) | Decision, Track 4 |
| 3 | Stripe webhook on, 100%-off checkout run → a real `stripe_subscription_id` | Track 4 |
| 4 | `client_schedules` written **explicitly** — defaults close Sat/Sun and cap the horizon at 14 days | Track 4 |
| 5 | Real inventory rows loaded, then `set-rental-tools.mjs --apply` | Track 4 |
| 6 | Calendar connected (she sees the unverified-app warning until Google clears) | Track 1 + Track 4 |
| 7 | A real test call | 🟡 Unblocked *if* the model switch works — that is now the first thing to test |

---

## 🔴 The Retell blocker — ANSWERED 2026-08-20, and the answer is "change model"

**Retell replied to the ticket on 2026-08-20 20:32.** Verbatim:

> *"There seems to be some issue with Anthropic models for the moment. While we are investigating,
> I would suggest switch to some other models (e.g. GPT 5) for now."*

**This confirms the diagnosis exactly.** The fault is inside Retell's request path and is specific
to Anthropic models *as routed by them* — which is why their own log showed Vertex, Anthropic
direct and Bedrock all failing identically while the same prompt sent straight to Anthropic
answered at **p50 571ms**. Our configuration is exonerated, on the vendor's own word. **Stop
re-testing it.** No ETA was given, so treat the fix as indefinite and route around it.

### Scope the blast radius before touching anything

**Retell's problem is Retell's routing, not Anthropic.** Three call sites in this repo talk to
Anthropic **directly** and are entirely unaffected: `nova-templates`, `felix/conflict-check` and
`email-ingest`, all pinned to `claude-sonnet-4-6`. **Do not "fix" those** — the last two run
mid-call on live traffic, and changing them chases a bug they never had.

Only the **11 Retell LLMs** are affected.

### The staged switch — prove it on one agent first

`scripts/retell/set-client-model.mjs` does this, and **it was patched on 2026-08-21 before being
trusted**, for two reasons found by dry-running it:

- **It never touched the shared demo line.** That agent is neither a template nor a subscription,
  so both of the script's lookups skipped it — and it is the number handed out at chamber events
  and the one that takes real prospect calls. A fleet-wide migration would have left **the one
  agent prospects actually reach** on the broken model. Now added by id, as the two compliance
  scripts already did. *(Third time this exact gap has bitten: it is what let the demo line answer
  calls and record none for ten days.)*
- **There was no way to change one agent.** The smallest possible action was "every template and
  every client at once," which is not how you evaluate an unproven model. Added `--only <agentId>`,
  plus up-front validation of the model string against Retell's supported set so a typo fails
  before the first write instead of halfway through, leaving the fleet split across two models.

**Do this in order:**

1. **Northside only** — it is the test agent and takes no real traffic:
   ```
   node --env-file=.env.local scripts/retell/set-client-model.mjs --model gpt-5 --only agent_d39a1b13cfd8fb2e3c9c12f06e --apply
   ```
2. **Place real calls and measure three things**, not one:
   - **Does it answer after the greeting?** That is the actual bug.
   - **Latency.** Haiku benchmarked at **964ms p50**; anything near Sonnet's old **2399ms p50** sits
     on Retell's 3000ms cliff and trades one failure mode for another. Read the spread, not the
     median.
   - **Do the fragile tools fire?** `item`, `sms_consent` and `booking_token` were each defined,
     described in the prompt, and simply **not sent** until they were made required with a truthful
     escape — and that shape was tuned against Haiku. **A different model family is exactly the
     event that re-opens it.** `booking_token` has never been carried by any connected call, so
     this is the first chance to observe it at all.
3. **If it holds, move the demo line next** — that is what the chamber needs, and it is one
   `--only` run.
4. **Templates last.** They decide what every future client inherits, and no client is provisioning
   this week. `--model claude-4.5-haiku --apply` reverts the lot when Retell fixes theirs.

**On model choice:** GPT-5 is the support tech's suggestion, not a measured result. Retell also
offers `gpt-5-mini`, `gpt-5-nano` and `gemini-3.5-flash`, and **a flash/mini tier is the closer
latency match to Haiku than full GPT-5.** If GPT-5's p50 comes back materially above ~1000ms,
benchmark those before accepting it — this repo has settled a model question with a four-minute
benchmark before, and the whole reason the fleet is on Haiku is that somebody measured instead of
reasoning.

**What is no longer needed:** the fresh-account test, and the "demo without a live call" fallback.
Both were contingencies for a vendor who had not replied. Keep escalating only if GPT-5 also fails,
because that would mean the fault is not model-specific after all.

---

## Track 1 — Calendar time: start these, then stop thinking about them

Filed once, then they wait. **Start them first because they convert waiting into background time.**
Neither blocks any build below.

1. **Register the A2P brand + campaign** for `3SIX9 MEDIA MASTERS LLC`. Low-volume standard,
   ~$19 one-time, ~$8–15/month per client thereafter. **Directly with Twilio, never through a
   reseller** — the reseller model forfeits ownership of the brand and campaign. **Do not give
   Northside a Secondary Profile**; a rejection damages the Primary trust score. This gates *every*
   SMS track, and none of them start until it clears.
2. **Submit for Google verification.** Needs a demo video of end-to-end OAuth consent. Up to 10
   days. Until it clears, every new client — including the pilot — sees an "unverified app"
   interstitial, and there is a 100-user cap. **Recording order matters:** disconnect the calendar
   first so there is a fresh consent to film, sign in as `damozman@yahoo.com`, and call
   **Northside on +1 (817) 612-6757** — a demo-line call proves nothing and has already cost one
   session.
3. **The Retell ticket** — filed 2026-08-20. See above for the escalation decision.

---

## Track 2 — Before the pilot arrives (the ~12-day window)

### 2.1 🔴 One defect class, three symptoms: the questionnaire assumes it is the only writer

This is the most valuable finding of this session and it is **not on any existing list**. Three
separate known bugs turn out to share one root cause, and fixing them as one pass is cheaper and
more durable than fixing them as three.

`app/api/questionnaire/submit/route.ts` and `lib/retell-kb-sync.ts` both behave as though the
questionnaire is the **sole** author of a client's configuration. It is not — scripts write the
same state out of band. Every place those two assumptions meet, a re-submit silently destroys work.

**Symptom A — a questionnaire re-submit can deactivate inventory loaded by script. [NEW]**

The pilot's ~40 items will be loaded from her spreadsheet by `setup-client-inventory.mjs`. The
questionnaire form initialises its inventory field to **one blank row**
([page.tsx:55](app/onboarding/questionnaire/[domain]/page.tsx#L55)) — it does **not** prefill from
existing `client_inventory` rows. On submit, every item *not* in the posted list is set
`active: false` ([route.ts:176-180](app/api/questionnaire/submit/route.ts#L176-L180)), and
`loadInventory` returns only active rows.

So the failure is: **she re-opens the questionnaire months later to add one new bounce house she
just bought — and the other 39 items stop existing as far as Ava is concerned.** Silent, no error,
discovered only when a caller is told a unit she owns is unavailable.

A fully blank submit is safe (the inner `unique.length > 0` guard catches it). **A partial submit
is the dangerous one, and adding an item is the most natural reason anyone re-opens that form.**

The deactivation logic is *correct* when the questionnaire is the only writer — the code comment
explains the reasoning well. It became wrong the moment a script became a second writer.

**Symptom B — the AI-disclosure backstop line is stripped on re-submit. [CORRECTED]**

`mergePromptWithContext` cuts from `BUSINESS_CONTEXT_START` **to the end of the prompt**
([retell-kb-sync.ts:35](lib/retell-kb-sync.ts#L35)), so anything appended after that marker is
discarded on the next sync. `set-sms-consent.mjs` appends
([line 132](scripts/retell/set-sms-consent.mjs#L132)) and is vulnerable.
`set-rental-tools.mjs` inserts *before* the marker and is immune.

**The correction:** the delivery doc implies the Texas TRAIGA disclosure is at risk. It is mostly
not. `set-ai-disclosure.mjs` writes **two** fields — the proactive greeting into `begin_message`,
which is a separate field the prompt-slice never touches, and a backstop line into
`general_prompt`, which is appended and *is* stripped. **The greeting survives; only the answer to
"am I talking to a robot?" is lost.** Real, worth fixing, materially smaller than it reads.

Related and worth noting: CLAUDE.md records the backstop line as present on 10 of 11 agents, with
**Northside the one that lost it**. That is consistent with this bug having already fired once —
though Northside's prompt was also swapped by hand on 2026-08-20, which explains it equally well.
Either way, a live agent is missing it. **Re-run `set-ai-disclosure.mjs` against Northside.**

**The fix, once, for all three:** make the questionnaire path non-destructive to state it did not
write — prefill the form from existing rows so a re-submit round-trips, and write compliance lines
into the base prompt (or preserve trailing content) instead of appending after the marker.

### 2.2 🔴 Nova's roofing fallback

`VERTICAL_COPY[input.vertical] ?? VERTICAL_COPY.roofing`
([nova-templates.ts:78](lib/nova-templates.ts#L78)), and roofing's `visitNoun` is `'inspection'`.
`NovaVertical` is exactly the original nine.

The pilot is an event-rental business with no template of her own, so she gets provisioned under
one of the nine, and **her customers' confirmation emails describe a bounce-house hire as an
"inspection"** from a Nova who says she writes for a roofing company. Nothing errors. A test call
will not catch it unless someone reads the confirmation email end to end.

**This is the only item on the whole roadmap that reaches the pilot's *customers* rather than the
pilot.** Fix it before she takes a booking.

**The defect is the fallback, not the three missing keys.** It converts an unknown vertical into a
confidently wrong email instead of refusing — the exact opposite of the rule inventory matching
already follows, where an unknown key raises rather than guessing. Add the rental keys *and* make
the unknown case refuse.

### 2.3 Cut per-turn prefill — this is the chamber demo's fluidity

Latency regressed to **llm p50 1438ms / e2e 1821ms** against a **964ms** benchmark; Chris called it
"not very fluid," and one turn crossed Retell's 3000ms cliff during a working call. Cause is prose
in tool descriptions and the system prompt, re-sent every turn. Trimmed once (12,108 → 9,868
chars); **`capture_lead` alone is still 2,571 chars** and is the fattest remaining target.

Measurable **without a phone call** — send the live prompt and tools straight to the model and time
first token. **Measuring trap:** do it mid-conversation. A single-turn probe reads ~700ms while a
real call averages **6,602 tokens/request**, so a naive probe flatters the number.

This is the highest-value chamber-facing build item: it is the difference between a demo that
sounds like a person and one that sounds like software, in front of buyers.

### 2.4 Smaller, still worth the window

- **`capture_lead` sends the wrong `vertical`** — sent `"wholesale"` on a roofing-domain client on
  three separate calls, mislabelling every lead. Small fix, real data quality.
- **Audit the other five crons' real output.** `silence-check` selected a column that never existed
  and failed silently for months, because nobody read its output — only that it ran. Assume
  siblings until proven otherwise.
- **Fix the SaaS Scout badge.** It says DEPLOYING for something that does not exist. Either build
  Scout or tell the truth on the badge; the honest move is the badge.
- **Delete `lib/email-templates.ts`.** All four templates lost their only caller when
  `/api/update-dossier` was removed. Dead code that reads as a live integration.

---

## Track 3 — The dossier

`DOSSIER-DESIGN.md` is written and approved, **design only, nothing built.** Its governing rule is
the one to keep: *the model may write the prose, the model may never invent a number.* Read
`lib/audit-call.ts` first — it already encodes that discipline.

**The urgency dropped today.** Production used to promise prospects a dossier in "2–5 minutes" that
had never existed; today's merge removed that promise. So this is no longer a truthfulness
emergency — but intake submitters still get **silence**, and that is still a leak.

**Steps 0 and 1 are worth doing in the solo window; the rest can wait until after the chamber.**

0. **Persist the intake payload.** `/api/intake` stores six columns; **company, pain point and
   volume are never stored, and average job value is not collected at all.** The route's own
   comments say so. Nothing downstream works without this — it is step 0 for a reason.
1. **Wire the static intake form to the existing `/api/send-roi-report`.** It already emails the
   prospect a personalised report and copies the owner; it is simply wired only to the Next.js ROI
   calculator today. **Closes the silence immediately with no new machinery** — the cheapest real
   win on this roadmap.
2. Intake form changes — checkboxes, average value, disclosure.
3. Website measurement module — a pure function over a fetched page, easy to test.
4. Dossier renderer — six sections, per-vertical config.
5. Dedicated audit agent, then the two-call schedule. **There is no audit agent today** —
   `lib/audit-call-dial.ts` falls back to the shared demo agent, so a prospect who answered would
   be greeted as their own receptionist.
6. Approval queue + send.
7. Delete `lib/email-templates.ts` (also listed in Track 2.4 — do it in whichever arrives first).

**Chris's decisions, already made:** late-evening call, **disclose that we call, never when**; two
calls (business hours + evening); recording attached but **human-reviewed**; approval gate **on**.

---

## Track 4 — Gated on the pilot, the money, or a decision

### 4.1 Nobody can buy today [RECLASSIFIED]

The delivery doc files this under "gated on a real client." **That classification is now wrong: the
chamber event *is* the real client arriving, so this is gated on the calendar.**

Stripe is in **test mode** and its sole webhook (`we_1Trrqk3nqoZlRtPEan18MmjD`) is **disabled**, so
a checkout on the live site provisions **nothing**. That was the right call with zero paying
clients — it was disabled deliberately after a sandbox checkout bought real Retell numbers — but if
someone at the chamber wants to sign up, there is no path.

- **Re-enable the webhook** before any end-to-end run (the one-liner is in CLAUDE.md open item 8).
- **Decide on live mode before mid-September**, not at the event. Note that production's Stripe
  integration is currently wired to *test* mode — that endpoint is `livemode: false` and production
  verifies its signature, so going live is a real change, not a toggle.

### 4.2 The pilot onboarding, in order

Every item here is FK'd to `agent_subscriptions`, so **that row comes first or nothing attaches.**
Onboard through a real Stripe checkout with a 100%-off coupon rather than a hand-inserted row: it
exercises the production path and produces a genuine `stripe_subscription_id`, the billing anchor
Northside can never have.

1. **Pick the vertical she is provisioned under.** `TEMPLATE_AGENT_IDS` has exactly nine keys and
   `vertical` comes from Stripe's `client_reference_id`. A checkout with
   `client_reference_id=entertainment` **throws and provisions nothing.** Deliberate choice, not a
   detail to discover live.
2. Re-enable the webhook → run the 100%-off checkout → `verify-onboarding-result.mjs <domain>`.
3. **Write `client_schedules` explicitly.** `DEFAULT_SCHEDULE` closes **Saturday and Sunday** and
   caps the horizon at **14 days**. A party-rental business is almost entirely weekends and books
   months ahead. On defaults Ava refuses every Saturday and anything past a fortnight — **and it
   reads as a bug in the booking engine rather than as configuration.** Use
   `setup-client-schedule.mjs`.
4. Load real inventory from her spreadsheet — `setup-client-inventory.mjs`. It reports which spoken
   phrases would come back AMBIGUOUS *before* anything is written; read that output.
5. **Then run `set-rental-tools.mjs`** — dry run, then `--apply`. It targets only clients with
   `min_rental_days` set, so today it correctly does nothing; it becomes live the moment her rows
   land.
6. Connect her calendar. Expect the unverified-app warning until Track 1.2 clears, and **check her
   Google Calendar timezone** — Chris's own was UTC, which rendered a correct 9:00 AM Central
   booking as 2pm.
7. A real test call — blocked on Retell.

**Also verify on the first call that connects:** `booking_token` is required on `book_appointment`
with `"none"` as the escape, but **no connected call has ever carried one** — every booking so far
stored `inventory_item_key: null`. Three changes are untested by voice for the same reason.

### 4.3 The chamber leave-behind [not on any engineering list]

A chamber room is **mixed businesses**, which makes a vertical page the wrong artifact there. The
right one already exists: the shared demo line, which classifies the caller's industry live and
discloses that Ava is AI. What is missing is **a card or QR pointing at the demo number**, with
`/api/intake` catching the follow-up.

This is not code and it is cheap, which is exactly why it will get skipped. **It is the capture
path for the event** — without it, every conversation depends on Chris remembering to follow up.

### 4.4 Usage billing

Built and disabled behind three guards. Flip `USAGE_BILLING_ENABLED=true` **only when Stripe is
live**, run `verify-billing.mjs` first, and **move the pricing copy in the same commit** — this
repo has already shipped advertised minutes ahead of a working meter once.

Caveat worth remembering: the overage arithmetic has **never met real data**. The one closed period
reconciled exactly, but it had zero overage.

---

## Track 5 — Not this cycle

- **`PHASE-2-ROADMAP.md`** — Quinn the quoting agent, missed-call text-back, review management,
  repeat-caller memory. All are **paid add-ons on top of a working core**, and `PREMIUM_ADDONS`
  already exists in `lib/tier-config.ts` as the shelf for them. Read it before deciding what comes
  *after* the pilot; build none of it before.
- **Text-to-Quote** — needs SMS underneath it, so it is gated behind Track 1.1. When it comes, v1
  **never auto-sends a price**: draft → owner approves → send. Quoting commits money where booking
  only commits time.
- **Deposits and digital waivers** — standard for bounce houses and equipment. Needs SMS first.
- **Bulk quantities** — "four restrooms" is four separate bookings today. Do this only when a real
  client's chairs actually run out on a Saturday. Identity items are the scarce ones; bulk stock
  usually is not.
- **Phase 2b bulk cold-call runner** — **blocked on a decision only Chris can make.** Cold-calling
  businesses that never made contact is a different legal posture from calling a form submitter.
  **Do not build unprompted.**
- **Vertical pages for the original nine** — the "page follows the customer" rule still holds
  there. The rental reversal was specific to buyers Chris will be in a room with.

---

## Decisions this roadmap is waiting on

Two. The Retell one **resolved itself on 2026-08-20** when the vendor replied — it is now a build
task (switch model, measure, verify the tools) rather than a decision, and it is the first thing to
do on the next working session because everything voice-shaped is queued behind it.

1. **Which of the nine verticals the pilot is provisioned under.** Needed before her checkout;
   `TEMPLATE_AGENT_IDS` has nine keys and no `entertainment`.
2. **Stripe live mode before the chamber event, or not.** If not, the honest position at the event
   is "I'll get you set up next week," and that should be a choice rather than a surprise.

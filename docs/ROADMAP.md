# The Roadmap

**Written 2026-08-21. Updated the same day** — Tracks 2.1, 2.2 and the Retell blocker all closed,
and dossier steps 0 and 1 shipped. Tracks 2.3 (cost half), 2.4, 3 and 4 remain.

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

## What changed on 2026-08-21

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

**Done since:** `WHAT-CAN-I-DELIVER-TODAY.md` was updated the same day — banner removed, rental
section moved from "built" to "deliverable".

---

## The spine: what must be true, and when

Read this backwards from the chamber event.

### For the chamber event (~mid-September)

| # | Must be true | State today |
|---|---|---|
| 1 | **A demo that works on demand** — hand someone the phone, Ava books *them*, the calendar entry and confirmation email land in front of them | ✅ **Working, and better than before.** All 11 agents on `gemini-3.5-flash`: llm p50 **935ms**, max 1363ms, **0 of 23 turns** over Retell's 3000ms cliff. Proven on real calls. |
| 2 | **Something specific to point each buyer at** | ✅ **Done today.** Eleven verticals + three rental pages, all live. |
| 3 | **A capture path in the room** — card or QR → the demo number, `/api/intake` catches the follow-up | 🔴 **Not built, and not on any engineering list.** See Track 4. |
| 4 | **The ability to actually close** | 🔴 **Nobody can buy.** Stripe is in test mode and its only webhook is disabled. See Track 4. |

### For the pilot (before she takes a real booking from a real customer)

| # | Must be true | State today |
|---|---|---|
| 0 | Nova stops describing a bounce-house hire as an **inspection** | ✅ Done 2026-08-21 |
| 1 | Her questionnaire re-submits stop silently destroying her setup | ✅ Done 2026-08-21 |
| 2 | A vertical chosen to provision her under (no `entertainment` template exists) | Decision, Track 4 |
| 3 | Stripe webhook on, 100%-off checkout run → a real `stripe_subscription_id` | Track 4 |
| 4 | `client_schedules` written **explicitly** — defaults close Sat/Sun and cap the horizon at 14 days | Track 4 |
| 5 | Real inventory rows loaded, then `set-rental-tools.mjs --apply` | Track 4 |
| 6 | Calendar connected (she sees the unverified-app warning until Google clears) | Track 1 + Track 4 |
| 7 | A real test call | ✅ Unblocked — several placed 2026-08-21, including a full booking that stored the right `inventory_item_key` for the first time ever |

---

## ✅ The Retell blocker — RESOLVED 2026-08-21

Retell confirmed on 2026-08-20 that the first-token failures were theirs and specific to Anthropic
models **in their routing**, and recommended switching. All 11 agents now run `gemini-3.5-flash`
and the symptom is gone.

**Measured, not assumed** — each on a real call:

| model | llm p50 | max | turns over 3000ms | LLM $/min |
|---|---|---|---|---|
| `claude-4.5-haiku` (old benchmark) | 964ms | 1843ms | — | **$0.0251** |
| `gpt-5` | 1707ms | 3881ms | **3 of 20** | $0.0400 |
| **`gemini-3.5-flash`** | **935ms** | **1363ms** | **0 of 23** | $0.0811 |

GPT-5 also abbreviated "August 24th" to "Aug" — which TTS read aloud — and tacked ", right?" onto
questions. Both vanished on Gemini. Chris's verdict: *"very quick and very fluid."*

**Scope it correctly if this ever recurs: it was Retell's ROUTING, not Anthropic.** The three call
sites that talk to Anthropic **directly** — `nova-templates`, `felix/conflict-check`,
`email-ingest` — were never affected and must not be changed; two run mid-call on live traffic.

**Two things to re-check before going live**, both easy to forget:
1. **Whether Haiku works again.** It is ~3.2x cheaper on the LLM line and sounded right for months.
   Chris's call: *"stick with Gemini Flash for now and review it before we pull the trigger."*
2. **`OVERAGE_RATE_CENTS`.** Set when the cost floor was Haiku at 13.1c/min. At Gemini's 19.7c
   all-in, **Elite overage margin falls from ~12c to ~5c/min.** Do it in the same move as flipping
   `USAGE_BILLING_ENABLED`.

`scripts/retell/set-client-model.mjs` was patched before being trusted: it never targeted the
**shared demo line** (neither a template nor a subscription, so both lookups skipped it — the third
time that gap has bitten), and it had no way to change a single agent. Both fixed; it now prints a
per-agent revert built from what was actually replaced.

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

### 2.1 ✅ DONE 2026-08-21 — the questionnaire assumed it was the only writer

Fixed and verified by `scripts/verify-questionnaire-roundtrip.mjs` — 15 checks against a real
client. **It was worse than diagnosed below:** the form prefilled *nothing*, so hours, horizon and
lead time reverted to hardcoded defaults on **any** re-submit, not just when inventory was typed.
For the pilot that meant Saturdays closing and the horizon dropping to 60 days, after which Ava
refuses every weekend booking.

New `GET /api/questionnaire/current` feeds the form; the submit button is disabled until it loads,
and stays disabled if the load fails. Auth lives in one module so the read cannot drift weaker
than the write. `mergePromptWithContext` preserves trailing content, with seven tests.

*Original diagnosis, kept because the defect class keeps recurring:*

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

### 2.2 ✅ Nova's roofing fallback — DONE 2026-08-21

**The diagnosis below was wrong about the mechanism, and is kept as a caution.** The route already
refused real-but-unsupported verticals (`skipped_unsupported_vertical`, two rows in production).
The live fallback was in `app/api/nova/booking-confirmation/route.ts` — `isSupported ? raw :
'roofing'` — reached only when the vertical is **empty**, which is a third of all `leads` rows and
every booking on the demo line. Fixed with three rental verticals plus a trade-neutral `unknown`
template, verified by generating real emails. Northside's subscription row also still said
`roofing` and was corrected to `event-rentals`.

*Original write-up, preserved because the error is instructive — it was derived from one library
file while the guard that changed everything sat two files away:*

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

### 2.3 ✅ Cut per-turn prefill — the QUALITY half is done, the COST half is not

The model change solved the fluidity problem outright: **llm p50 935ms, max 1363ms, 0 of 23 turns
over 3000ms**, confirmed by ear. What remains is cost — prefill is ~7,900 chars, `capture_lead`
2,148 of it, and Gemini is ~3.2x Haiku on the LLM line. Worth trimming, no longer urgent.

*Original write-up:*

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

---

## Track 3 — The dossier

`DOSSIER-DESIGN.md` is written and approved, **design only, nothing built.** Its governing rule is
the one to keep: *the model may write the prose, the model may never invent a number.* Read
`lib/audit-call.ts` first — it already encodes that discipline.

**The urgency dropped today.** Production used to promise prospects a dossier in "2–5 minutes" that
had never existed; today's merge removed that promise. So this is no longer a truthfulness
emergency — but intake submitters still get **silence**, and that is still a leak.

**Steps 0 and 1 are worth doing in the solo window; the rest can wait until after the chamber.**

0. ✅ **DONE — the intake payload is persisted.** `2026-08-21-intake-payload.sql` is **applied to
   production**; `/api/intake` writes company, pain point, service area and website.
   `monthly_volume` and `avg_job_value` have columns but are not collected yet — that is step 2.
   The route **degrades rather than fails** if a column is missing, because an insert naming one
   fails as a whole and would cost a prospect.
1. ✅ **DONE — the prospect finally gets an email.** **The original plan here did not work.**
   `/api/send-roi-report` is built around `callsPerWeek` / `answerRate` / `jobValue` / `annualLost`
   / `breakEvenDays`, and the intake form collects **none** of them — it would have thrown, or
   needed the numbers invented, which is the exact Gumloop failure the dossier replaces. So
   `acknowledgeProspect()` sends a plain confirmation with **no arithmetic**: what they submitted,
   the 24-hour personal reply the success screen already promises, the demo line and the booking
   link. The ROI report becomes reachable at step 2.
2. ✅ **DONE 2026-08-22 — intake form changes.** **It was not "a form change only".**

   The plan assumed the pages just needed two new fields. What they actually needed was a payload
   contract, because every page posted a single overloaded slot called `industry_specific_field`
   that meant something different on almost every one of them — a service area on roofing, HVAC and
   plumbing, but monthly volume on the four rental/wholesale pages, a book size on insurance, leads
   per month on real estate, an MRR band on SaaS, and the company name again on legal and the
   homepage. **Step 0 then wrote all of it into a column named `service_area`**, so the dossier
   would have reported a prospect's service area as "400". Six of the pages were already asking the
   volume question step 2 wanted; they were posting it under the wrong name.

   All **12** forms (11 leads pages + the homepage modal) now post the same four things under their
   own names: `service_area`, `monthly_volume`, `avg_job_value`, `pain_points[]`. Field ids are
   uniform (`f-area`, `f-volume`, `f-value`, `f-pain`) so the next edit is one pass, not twelve.
   Every page gained a real service-area question — Chris's call, so the dossier has a location for
   a local-business audit.

   Also fixed in the same pass, both found by reading rather than assumed:
   - **`real-estate-leads` posted `369AS_REALESTATE_INTAKE`** while the route mapped
     `369AS_REAL_ESTATE_INTAKE`. The key never matched, so the regex fallback filed those leads
     under a third spelling, `realestate` — the exact "useless for grouping" problem that map
     exists to prevent. Both spellings are now accepted; the page posts the right one.
   - **The homepage modal asked for a business TYPE and stored it as the company NAME**, so
     `client_company` read "Med Spa". It now asks for both, and files the row under the prospect's
     own trade instead of the literal `unlisted`.

   **The disclosure line was deliberately NOT shipped** — see the note under step 5.

   **`monthly_volume` is TOTAL inbound volume, not the missed portion.** Multiplying it by
   `RECOVERY_RATE` would claim 30% of every call a prospect receives is recoverable revenue, which
   is a fabricated number wearing a real one's clothes. The missed rate has to come from the
   measured audit call. This is written into the column comments, the route and the tests, because
   it is the single easiest way for the renderer at step 4 to reintroduce the Gumloop failure.

   **Needs applying:** `supabase/migrations/2026-08-22-intake-pain-points.sql` (adds `pain_points
   TEXT[]`). The route degrades one rung at a time without it and keeps every other field, so code
   and schema can go live in either order.
3. ✅ **DONE 2026-08-22 — the website measurement module.** `lib/website-audit.ts`, the sibling of
   `lib/audit-call.ts`, under the same two rules plus a third this one needs: **absence of evidence
   is not evidence of absence.** We fetch HTML and never run JavaScript, so on a client-rendered
   site every negative degrades to `undetermined` rather than `absent`.

   `analysePage()` is pure over an already-fetched page; `fetchHomepage()` is the only function
   that touches the network. **Two defects were found by running it against real sites, neither
   visible in a fixture** — see `scripts/verify-website-audit.mjs`, committed for that reason:
   - **Northsideroofing.com serves 114 bytes of JavaScript redirect.** The module read that stub
     and produced six confident negatives about a page the prospect has never seen. Now
     `no_content`, with the redirect followed once.
   - **A lone `<input type="email">` matched as a "contact form"** on homedepot.com and
     stripe.com, where it is a newsletter signup. Now needs a message field or a stated purpose.
4. ✅ **DONE 2026-08-22 — the dossier renderer.** `lib/dossier.ts` builds a structured document;
   `lib/dossier-html.ts` renders the email. Split so every truthfulness rule is testable without
   parsing markup, and so a styling change can never quietly alter a claim.

   **The only arithmetic is `avg_job_value × RECOVERY_RATE`** — what one missed call is worth.
   `monthly_volume` is never multiplied by it, and a test asserts the forbidden products appear
   nowhere. The figure carries `RECOVERY_RATE_NOTE` directly beneath it, because a number that
   escapes its caveat is how a conservative estimate becomes a claim. The section then hands the
   frequency back: *"how often it happens is the one number we cannot see from outside — but you
   can."*

   **Sections are omitted, never estimated**, and `omitted[]` records why for the operator. An
   unreportable call or an unreachable site is dropped, never softened into "we could not reach
   you". `lib/dossier-labels.ts` is generated from the twelve pages and guarded by a drift test, so
   the dossier quotes a prospect the words they actually read.

   Verified by rendering against the two real calls placed to Chris's phone, not fixtures.
5. 🟡 **BUILT 2026-08-22, SWITCHED OFF — the audit agent and the two-call schedule.**

   **The agent exists and is proven on real calls.** `369 Audit Caller`
   (`agent_3a2b5f444d24c21f9f3c35470d`) — outbound only, no number bound, `end_call` as its only
   tool, discloses it is an AI in its first sentence, `voice_speed` 1.1 (chosen by ear, the other
   11 agents deliberately stay at 1.0). `lib/audit-schedule.ts` plans the pair, `lib/audit-call-pair.ts`
   decides what two calls may claim, `lib/audit-dispatch.ts` guards the dialling, and
   `/api/cron/audit-calls` places them every 15 minutes.

   **🔴 `AUDIT_CALLS_ENABLED` is unset and must stay unset until the disclosure is on the form.**
   Nothing schedules and nothing dials while it is off. The intake form still does not tell
   submitters we place a test call — **calling someone who was never told is the version that costs
   a customer.** The switch and the disclosure line flip in one change, and that change is what
   completes this step.

   **Real calls found what code review could not:**
   - **The agent had no webhook**, so its first call resolved to nothing — it rang, was answered,
     cost money and established nothing. Cause was a confident comment derived from `agent.list()`,
     which does not return `webhook_url`; `agent.retrieve()` does. *A list endpoint's silence is
     not evidence of absence.* The creation script now retrieves, and aborts if the reference has
     no webhook.
   - **TTS read "369" as "three hundred and sixty-nine."** Caught by Chris on the first call. It
     was hitting the **demo agent** too, in a line it says verbatim before ending every call — the
     demo handed to buyers at a chamber event. Fixed on both;
     `scripts/retell/fix-brand-pronunciation.mjs` is committed and idempotent.

   **Still unproven:** the voicemail path and `describeAuditPair` have never met a real call —
   every test so far was answered.

   **Also still missing before a prospect is called:** an approval/suppression path. Chris's
   decision was an approval gate on the dossier; nothing yet decides whether a given prospect
   should be dialled at all.

   **▶ The intake disclosure ships HERE, not at step 2.** The design puts *"As part of your audit
   we place a test call to your published number"* on the form, and step 2 built everything else on
   that list. It was held back on purpose: **there is no audit agent, so nobody gets called.**
   Shipping the line now would tell every single submitter we are about to call them and then never
   call — advertising a capability that does not exist, which is the one thing this repo has a
   standing rule against and has already got wrong once. The markup is trivial; add it in the same
   change that turns the calls on, and the legal posture is correct from the first real call.
6. ✅ **DONE 2026-08-22 — approval queue + send.** Proven end to end against production by
   `verify-dossier-pipeline.mjs`: 27 checks from submission through build, review page, approval
   and a real email.

   **Approval is a POST, never a link.** Mail scanners fetch every URL in a message, so a one-click
   `?approve=1` would have sent every dossier the moment the nudge arrived, unread. The signed
   token opens the review page; sending needs a button on it. GET on the approve route answers 405.

   The review page shows the **stored HTML** in a sandboxed iframe — what will actually arrive, not
   a re-render — plus what the builder left out and why. The nudge names the count **and the age of
   the oldest**, and sends nothing when the queue is empty, because a daily "nothing to do" trains
   its reader to ignore the one message that must not be ignored.
7. ✅ **DONE 2026-08-22 — `lib/email-templates.ts` deleted.** 469 lines whose four templates
   lost their only caller when `/api/update-dossier` was removed. Every exported symbol was
   checked for references individually before deleting, not just the module path.

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

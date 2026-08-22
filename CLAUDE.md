# 369 Agentic Systems — Claude Code Guide

## ⚠️ Session Handoff — Read This First
**Protocol:** At the end of any session with open items left, update this section before
finishing up. At the start of a new session, read this section first, before anything else.
**Replace it each time** — this is a running "current state" snapshot, not a changelog. Once an
item is actually resolved, delete it from the list instead of marking it done.

**Companion doc — `docs/architecture/WHAT-CAN-I-DELIVER-TODAY.md`. Keep it current.**
This section is *working state* (what is in flight right now). That doc is *delivery state*
(what a paying client actually gets, per vertical, and what each gap still needs). They answer
different questions and both go stale silently.

**Update it whenever real capability changes** — something ships, a switch flips, a gap closes,
or a live-system fact in it turns out to be wrong. Not every session; only when the answer to
"what can we sell today" moves. The goal is that its **"Not deliverable"** and **"What to finish,
in order"** lists shrink over time while the **"Deliverable today"** table grows. If a session
closes an item there, delete it from that doc rather than marking it done — same rule as here.

**Re-derive it from the live system, never from its own previous version.** Every count and
status in it came from the Retell API, production Supabase, the Stripe API, and the code — that
is the only reason it is trustworthy. The three other docs in `docs/architecture/` are bannered
**STALE** on purpose and are historical records; do not update them and do not quote them.

**Last updated:** 2026-08-22 (second session that day).

### Where this session ended — 2026-08-22

**Dossier steps 2, 3 and 5 are done or built.** tsc clean, **338 tests**, production build clean.
Everything is committed and pushed to `master`; the last commit is the voice-speed change.

## ▶ START HERE NEXT SESSION

**Read `docs/ROADMAP.md`** — the sequenced build order against the two dates that govern the work:
the pilot returning **~2026-09-02** and the chamber event **~mid-September**.

**▶ NEXT TASK: dossier step 4 — the renderer.** Every input it needs now exists: the intake payload
(step 2), the website observations (step 3), and the call pair (step 5). Six sections, per-vertical
config, and **a section with no number is omitted rather than estimated**.

**🔴 The one thing that must ship as a single change: the disclosure line + `AUDIT_CALLS_ENABLED`.**
The intake form still does not tell submitters we place a test call to their published line. Until
it does, **nothing may dial** — calling someone who was never told is the version that costs a
customer. The switch is unset, and `lib/audit-dispatch.ts` refuses everything while it is. Adding
the line and flipping the switch in one commit is what completes step 5.

**Still unproven on the audit call:** the **voicemail** path and `describeAuditPair`. Every test
call so far was answered by Chris, so `voicemail_reached` classification and the two-call
comparison have never met real data. Also **nothing decides whether a prospect should be dialled at
all** — there is no suppression or approval path in front of the dialler.

**🔴 DECISION NEEDED before the switch flips: which number do audit calls dial FROM?**
The test calls used the demo line **(817) 635-0220** because it is one of only two numbers we own —
that was a test convenience, not a decision, and `RETELL_AUDIT_FROM_NUMBER` is unset everywhere.
**Do not leave it on the demo line.** Two reasons, in order of cost:
1. **Carrier spam-flagging.** Outbound calls to people who did not dial us are exactly what gets a
   number marked as spam — `marked_as_spam` and `scam_detected` are already in
   `UNREPORTABLE_BY_REASON`. If the demo line gets flagged, the artifact Chris hands to buyers at a
   chamber event degrades or stops connecting. That is the highest-value asset in the room.
2. **Callbacks land in the wrong conversation.** A prospect who rings the number back reaches the
   shared demo agent, which classifies their industry and offers to book them — not "you just
   called me about my audit".
**Whatever number is chosen must answer when called back.** This repo already has this exact bug
filed for the SMS number: *"A customer who saves the texting number and later calls it gets dead
air today."* Do not ship the same shape twice.

**Also queued, smaller:** audit the other five crons' real output (open item 5), the Scout badge,
and deleting `lib/email-templates.ts`.

---

#### ✅ Dossier step 5 — the audit agent, and what three real calls found

**`369 Audit Caller` — `agent_3a2b5f444d24c21f9f3c35470d`.** Outbound only (no number bound,
reachable solely via `override_agent_id`), **`end_call` is its only tool**, discloses it is an AI in
its first sentence, voicemail message configured, `voice_speed` **1.1** — chosen by ear on a real
call. Creating a Retell agent is free and **no number was bought**; the account still holds 2.

`lib/audit-schedule.ts` plans the pair, `lib/audit-call-pair.ts` decides what two calls may claim,
`lib/audit-dispatch.ts` guards the dialling, `/api/cron/audit-calls` places them every 15 minutes.

**Two defects that only real calls could find:**
- **The agent had no webhook, so its first call resolved to nothing.** It rang, was answered, cost
  money and established nothing — `describeAuditCall()` classifies from `call_ended`. The cause was
  a confident comment saying no agent sets `webhook_url`, derived from **`agent.list()`, which does
  not return that field**. `agent.retrieve()` does, and every live agent carries one with a shared
  secret in the query string. **A list endpoint's silence is not evidence of absence.**
- **TTS read "369" as "three hundred and sixty-nine."** Chris caught it. It was hitting the **demo
  agent** too, in a line it says verbatim before ending every call — the demo handed to buyers at a
  chamber event. Both fixed; the brand is now spoken **"three six nine Agentic Systems"**.
  `scripts/retell/fix-brand-pronunciation.mjs` is committed, idempotent, dry-run first.
  Retell's `pronunciation_dictionary` was rejected: it needs IPA/CMU phonemes and the SDK says to
  check which providers support it — a brand name is not the place for a setting that silently
  does nothing on some voices.

**Verified through the phone numbers' view, not the agents'** — a number pinned to an older agent
version would still serve the old text, which is exactly how the demo line once went ten days
recording nothing. Both lines resolve the corrected text; the demo line's v18 pin is still current.

**The `calls` table did not grow across any audit call** (75 before, 75 after). An outbound audit
call must never be filed as a client's inbound call, where it would inflate a dashboard, an ROI
figure and a weekly digest for a business whose agent never took it. The `metadata.purpose` tag
holds.

**`voice_speed` is 1.1 on the audit agent only.** The other 11 stay at 1.0 deliberately — they hold
conversations with real customers, which is a different judgement from a one-way script, and nobody
has listened to them at anything else.

---

#### ✅ Dossier step 3 — website measurement

`lib/website-audit.ts`, the sibling of `lib/audit-call.ts`, under the same two rules plus a third
this one needs: **absence of evidence is not evidence of absence.** We fetch HTML and never run
JavaScript, so on a client-rendered page every negative degrades to `undetermined`, never `absent`.
`analysePage()` is pure; `fetchHomepage()` is the only part that touches the network.

**Both of its defects were found by running it against real sites**, which is why
`scripts/verify-website-audit.mjs` is committed:
- **`Northsideroofing.com` serves 114 bytes of JavaScript redirect to `/lander`.** The module read
  that stub and produced **six confident negatives** about a page the prospect has never seen. Now
  `no_content`, and the redirect is followed once.
- **A lone `<input type="email">` matched as a "contact form"** on homedepot.com and stripe.com,
  where it is a newsletter signup. A form now needs a message field or a stated purpose; an
  unlabelled email box is `undetermined`.

---

---

#### ✅ Dossier step 2 — and it was NOT "a form change only"

The roadmap said add two fields to 11 pages. What the pages actually needed was a **payload
contract**, and the reason is the kind of thing that only shows up when you read all twelve forms
side by side rather than one and assuming the rest match.

**Every page posted a single overloaded slot, `industry_specific_field`, that meant something
different on almost every page** — a service area on roofing/HVAC/plumbing, monthly volume on the
four rental and wholesale pages, a book size on insurance, leads per month on real estate, an MRR
band on SaaS, and the company name again on legal and the homepage. **Step 0 wrote all of it into a
column named `service_area`.** The dossier would have reported a prospect's service area as "400".
And six pages were *already asking* the volume question step 2 wanted — under the wrong name.

All **12** forms now post the same four things under their own names: `service_area`,
`monthly_volume`, `avg_job_value`, `pain_points[]`. Ids are uniform (`f-area`, `f-volume`,
`f-value`, `f-pain`), so the next edit is one pass rather than twelve. Every page gained a real
service-area question — **Chris's call**, so the dossier has a location for a local-business audit.
The bottleneck `<select>` became checkboxes and **"All of the above" is gone**: it was the option
that destroyed the most information, since picking it says nothing about priority.

**Two live data bugs found on the way, both by reading rather than assuming:**
- **`real-estate-leads` posted `369AS_REALESTATE_INTAKE`** while the route mapped
  `369AS_REAL_ESTATE_INTAKE`. The key never matched, so every real-estate lead was filed under a
  third spelling, `realestate` — the exact "useless for grouping" problem that map exists to
  prevent. `getVerticalConfig` tolerates both, so nothing downstream broke and nothing looked
  wrong. Both spellings now map; the page posts the right one.
- **The homepage modal asked for a business TYPE and stored it as the company NAME**, so
  `client_company` read "Med Spa". It now asks for both and files the row under the prospect's own
  trade instead of the literal `unlisted`.

**⚠ `monthly_volume` is TOTAL inbound volume, not the missed portion.** Multiplying it by
`RECOVERY_RATE` claims 30% of every call a prospect receives is recoverable revenue — a fabricated
number wearing a real one's clothes. **The missed rate has to come from the measured audit call.**
This is written into the column comment, the route, `lib/intake-payload.ts` and the tests, because
it is the easiest way for the step-4 renderer to quietly reintroduce the Gumloop failure.

**Step 0's write path had never actually run.** Its "verified against production" meant the
migration was applied; the newest `system_audits` row predated the deploy by a day and every
payload column was null on all 23 rows. Both halves are now proven by script, against the live
route and the live table.

**Verification — two scripts, both committed, because the producer and the consumer are different
questions.** `item` and `sms_consent` were each defined, described and simply never sent, because
every test called the API directly:
- `verify-intake-payload.mjs` — 18 checks through the real route into production Supabase.
  Proves unreadable numbers become **null, never 0**, out-of-range becomes **null, never clamped**,
  the old cached-page shape still submits, and cleans up every row it writes.
- `verify-intake-forms.mjs` — **66 checks in a real browser across all 11 leads pages.** Proves
  each form actually *sends* the contract, and that a submit with no bottleneck checked is blocked.
  Intercepts `/api/intake`, so it writes nothing and sends no mail.

`lib/intake-payload.ts` holds the parsing, with 9 tests — it was briefly duplicated in the route,
which is the two-writers trap this file already warns about; the route imports it now.

**Not blocked on us:** Retell has not fixed the Anthropic routing. Chris asked them to confirm when
they do — see "Model choice" for the two things to re-check before going live.

---

### What shipped this session

**Voice — all 11 agents moved to `gemini-3.5-flash`** after Retell confirmed the Anthropic fault
was theirs. **Best latency this project has measured: llm p50 935ms, max 1363ms, 0 of 23 turns over
3000ms** — better than the Haiku benchmark, and Chris confirmed by ear ("very quick and very
fluid"). Details and the cost trade in "Model choice" below.

**Ava stopped offering things she had not checked.** Two real calls exposed the same defect in two
paths of `/api/available-slots`, both fixed:
- An **unknown** item ("do you have a Unicorn?") returned the *entire catalogue* as options with
  nothing checked against the calendar. She read it out, the caller picked, all four were busy.
- An **ambiguous** name ("you guys rent bounce houses?") did the same with its candidates, then
  answered *"I need to check each specific one to confirm"*.
- A **vague** question on a mixed yard returned intra-day appointment times instead of units.
  Reversed at Chris's direction: any yard that hires things out now answers with units.
All three now return **named units that are genuinely free**. The ambiguity *refusal* is unchanged
and still correct — offering the free ones by name is not guessing between them.

**Four truthfulness fixes, all customer-facing:**
- **Nova no longer confirms a stranger's booking as a roof inspection.** See open item 11 — the
  original write-up named the wrong line, and that error had been copied into two other docs.
- **Nobody promises to send a quote.** Quoting is not built. Two of the three hits were
  **templates**, so every future insurance and wholesale client would have inherited it.
- **Nobody promises a text.** Twilio is unconfigured; she said "we'll text updates to 817-…".
  Asking *"is it alright if we text you updates?"* stays — that is consent capture, not a promise.
- **All 11 agents now state the real post-booking process**: the team verifies shortly and gets in
  touch **by email or phone**. No payment page is mentioned, because none exists.

**`capture_lead` can finally answer "none of the nine".** `vertical` was a required enum of the
nine original verticals, so Northside — an event-rental business — filed **every** lead as
`wholesale`. Added `other` on all 11; the route already maps it to null.

**The questionnaire stopped destroying configuration on re-submit** (was open item 12). It had
**no read path at all**, so every field was a hardcoded default and a client editing one answer
silently overwrote the rest. Full write-up below.

**Dossier steps 0 and 1 shipped.** The intake payload is persisted and the prospect finally gets
an email. See the dossier section.

---

#### ✅ FIXED — the questionnaire had no read path, so every re-submit was destructive
**It was worse than open item 12 described.** The form prefilled *nothing*, so the damage was never
limited to inventory: hours, horizon and lead time reverted to the form's hardcoded defaults on
**any** re-submit, no typing required. For a weekend business that means **Ava refuses every
Saturday**, which reads as a booking-engine bug rather than as configuration.

What changed: a new **`GET /api/questionnaire/current`** returns saved answers, schedule and active
inventory; the form loads it on mount and **the submit button stays disabled until it does** — and
stays disabled if the load *fails*, since defaults on screen is exactly when saving is most
destructive. Auth moved to `lib/security/questionnaire-auth.ts` so the read cannot drift weaker
than the write. `mergePromptWithContext` now **preserves trailing content** instead of slicing to
the end, with seven tests in `lib/prompt-merge.test.ts` — it was silently deleting the Texas TRAIGA
backstop line that `set-ai-disclosure.mjs` appends.

**Deliberately unchanged:** removing an item in the form still retires it. That is the feature.
The bug was retiring items the form had never shown anyone.

Verified by `scripts/verify-questionnaire-roundtrip.mjs` — 15 checks against a real client, refuses
any client with a `retell_agent_id`, cleans up after itself.

**The durable lesson, now paid for four times:** `item`, `sms_consent`, `booking_token`, `vertical`.
**A required value with no truthful option produces a false one.** Reach for the escape
(`not_asked`, `"none"`, `other`, `unknown`) before reaching for firmer wording.

#### Do not re-audit the ROI calculators or the rental page copy
All **twelve** calculators were checked against each page's own slider defaults and `RECOVERY_RATE`
on 2026-08-21 — every one is arithmetically correct, including the two on a monthly rather than
weekly base (real-estate; roofing's $1.2M). Every `getElementById` on all 12 pages was checked for
dangling refs; the only hit is `intake-error`, **correct by design** — `showIntakeFailure()` creates
it if absent. The word-by-word copy pass is done and its six findings are shipped.

**`scripts/mobile-audit.mjs`** — 19 pages × 8 widths, Playwright is a devDependency.
**Do not reason about breakpoints instead of running it.**
#### 🔴 Still in flight — the Operational Dossier
`docs/DOSSIER-DESIGN.md` is written and approved ("get it rolling"). **Steps 0 and 1 are DONE
2026-08-21; steps 2–7 are still design only.**

**✅ `supabase/migrations/2026-08-21-intake-payload.sql` is APPLIED** (Chris, 2026-08-21). Verified
against production: all six columns present, and a real submission persisted company, pain point,
service area and website with **zero** degrade warnings — it took the direct path, not the
fallback. `system_audits` is back to 23 rows; every test row was swept.

**The fallback stays in the route on purpose.** It costs nothing now and it is what makes the next
migration safe to deploy in either order. DDL cannot be run from a script here — no `DATABASE_URL`,
no `pg` package — so schema and code will always go live separately.

- **Step 0 — the intake payload is persisted.** `client_company`, `pain_point`, `service_area`,
  `website_url` are now written; `monthly_volume` and `avg_job_value` have columns but are **not
  collected yet** (that is step 2). Null means "never asked", and a dossier section with no number
  must be omitted rather than estimated.
- **Step 1 — the prospect finally gets an email.** Nobody had ever emailed the person who filled
  the form; every message went to the owner. `acknowledgeProspect()` restates what they submitted,
  promises the same 24-hour personal reply the success screen already promises, and offers the demo
  line and booking link. **No arithmetic in it at all.**
  **The doc's original step 1 was wrong and is corrected in place:** it said to wire the form to
  `/api/send-roi-report`, but that route is built around `callsPerWeek` / `answerRate` / `jobValue`
  / `annualLost` / `breakEvenDays`, none of which the intake form collects. It would have thrown on
  `undefined.toLocaleString()` or needed the numbers invented — the exact Gumloop failure the
  dossier replaces. The ROI report becomes reachable at step 2.

**Still blocking the rest:** there is no audit agent. `lib/audit-call-dial.ts` falls back to the
shared demo agent, so a prospect answering would be greeted as their own receptionist.

**The governing rule:** *the model may write the prose, the model may never invent a number.*
Read `lib/audit-call.ts` before building — it already encodes the discipline.

**Chris's decisions:** late-evening call, **disclose that we call, never when**; **two calls**
(business hours + evening); recording attached but **human-reviewed**; **approval gate on**.
**Build order:** ~~0 persist the intake payload~~ · ~~1 send the prospect a real email~~ · **2 form
changes (next)** · 3 website measurement · 4 dossier renderer · 5 audit agent + two-call schedule ·
6 approval queue · 7 delete `lib/email-templates.ts`.

#### Raised, NOT fixed — Chris's call
`saas-optimization`'s leak-number reads "$0 — the monthly cost of hiring a dedicated SDR", which
says an SDR is free. Not a fabricated stat, so it was left alone, but it is confusing.

#### Doc corrections — six now, across three sessions
Re-deriving from the live system rather than from a doc's previous version has now caught **six**
wrong claims. **Four were in `WHAT-CAN-I-DELIVER-TODAY.md`** — the doc read *before a chamber
event*: "the rental pages have shipped" while they sat unmerged; a row-count contradiction
(55/27/21 in prose vs 72/31/24 in the table; production says **72/31/24**); the `client_inventory`
grep below; and the compliance-script claim below.

- **"`grep -rln client_inventory app components` returns nothing"** — it returns
  `app/api/questionnaire/submit/route.ts`, which *writes* the table. The real gap was that **nothing
  read it back**, which is a different fix from the one the doc implied. Now fixed.
- **"Both compliance scripts append their line to the end"** — `set-ai-disclosure.mjs` writes the
  greeting into `begin_message`, a separate field the prompt-slice never touches. The Texas TRAIGA
  greeting was never at risk; only the in-prompt backstop was.

**Two more this session, and these were in docs written by this project about its own code:**

- **Nova's fallback — the wrong line was blamed, in three docs at once.** CLAUDE.md, the delivery
  doc and `ROADMAP.md` all named `lib/nova-templates.ts`. The route two files away already refused
  unsupported verticals (`skipped_unsupported_vertical`, two rows in production prove it). The live
  fallback was elsewhere and fired only on an **empty** vertical — a third of `leads` rows. Fixing
  the blamed line would have fixed nothing.
- **`DOSSIER-DESIGN.md` step 1 was unbuildable.** It said to wire the intake form to
  `/api/send-roi-report`. That route is built around `callsPerWeek` / `answerRate` / `jobValue` /
  `annualLost` / `breakEvenDays`, and the intake form collects **none** of them — it would have
  thrown, or needed the numbers invented, which is the exact Gumloop failure the dossier replaces.
  Corrected in place; the honest version shipped instead.

**The lesson is not "these docs are unreliable" — it is that a cited command is a claim and a named
line is a hypothesis.** Running the grep takes ten seconds; reading the calling path takes a minute.
Both errors above survived multiple readings because a pasted command and a file:line *look* like
evidence.
### Live production state — re-derived 2026-08-21

- **Retell: 11 agents, 2 numbers.** All 11 run `gemini-3.5-flash`. Nothing was provisioned this
  session; **$23.48 spent all-time across 138 minutes.** Retell exposes no balance endpoint.
- **Supabase:** `agent_subscriptions` **2** (Northside + a leftover `review-sandbox` row with no
  agent — harmless, `review-sandbox-client.mjs --delete` removes it), `client_inventory` **38
  active**, `client_schedules` **1**, `calendar_connections` **0**, `system_audits` **23**.
- **Stripe: test mode**, sole webhook **disabled**. A checkout on the live site provisions nothing.
- **Twilio: unconfigured.** All four env vars missing, A2P brand unregistered. No SMS in either
  direction, and nothing may promise one.

**⚠ Northside is a RENTAL test agent, not a roofing agent.** Converted 2026-08-20 and it will
confuse anyone who does not know: rental prompt, 38 active mock inventory rows, weekend hours,
180-day horizon. Its `agent_subscriptions.vertical` was corrected to **`event-rentals`** this
session — it still said `roofing`, which is why its Nova confirmations described bounce houses in
roofing language. The greeting still said "Northside Roofing Company" until this session too; it
now says "Northside Event Rentals". The original LLM config is backed up as
`northside-llm-backup-2026-08-20.json` in that session's scratchpad.

**Proven on real calls, do not re-verify:** the calendar chain (a caller threaded a single free
hour between two Google Calendar blocks and booked it), owner alerts, per-item inventory by voice,
multi-day hire, ambiguity refusal, SMS consent capture, and — **first observed this session** —
`booking_token` carried end to end, storing the right `inventory_item_key` on a real booking. Every
prior booking stored null.

**Three things still untested by voice** were fixed after the last connected call: the availability
changes above, the post-booking promise, and the `other` vertical escape. Watch for them on the
next call.
### 🔴 Current focus: A2P 10DLC, and a real pilot from a real network
Chris's cousin is a Chamber of Commerce member with a large network, business developer at a
top-ten Texas roofing company, and **owner of an entertainment business** — mobile casino, DJ,
bounce houses — that wants to scale. First chamber event **~mid-September 2026**. She also knows
dumpster-rental and real-estate people; his brother-in-law sells CRM systems but not AI.

**This is distribution finally arriving.** Nine verticals have been live with zero paying clients
and 18 minutes of real traffic in a month — product surface was never the constraint.
**REVERSED 2026-08-19 — the three RENTAL pages are now GREENLIT.** The old rule ("do not add
vertical pages, the page follows the customer") was written when nine pages were live with zero
distribution. Distribution has now arrived, and Chris's reason is the one that overrides it: he
will be **in the room** with these buyers at chamber events, needs something specific to point
each one at, and **cannot explain a product he has no artifact for**. Building ahead of the
customer is correct *here* precisely because the face-time is booked.
**Still do NOT add pages for the original nine** — that rule stands and is unchanged.

**The pilot is her entertainment business**, because she owns it and there is no sale to make.
She has no `agent_subscriptions` row yet, and inventory, schedule and calendar are all FK'd to it —
**that row comes first or nothing attaches.** Onboard her through a real Stripe checkout with a
100%-off coupon rather than a hand-inserted row: it exercises the production path and produces a
genuine `stripe_subscription_id`, the billing anchor Northside can never have.

**Two config defaults will silently break her pilot.** `business_hours` defaults Saturday and
Sunday to **closed** and `booking_horizon_days` to **14**. A party-rental business is almost
entirely weekends and books months ahead. On defaults Ava refuses every Saturday and anything past
a fortnight, and it looks like a bug in the booking engine.

### Multi-day rental windows — APPLIED and VERIFIED against production 2026-08-19
`2026-08-19-rental-windows.sql` is **applied**. `verify-rental-windows.mjs` passed every check
against production, including the one the feature exists for: a real three-night hire was booked,
and a second booking of the same unit **mid-hire was refused** — the unit is held for the whole
span, not just its endpoints. 30 windows generated, none overlapping the live hire. All test rows
cleaned up; `client_inventory` back to 0, `bookings` back to 21.

**Still inert for every existing client, deliberately.** `min_rental_days` is null on every real
row, `isRental()` returns false for null, so everything still books intra-day slots. An item only
switches to windows when someone sets a value.

**The tool contract is BUILT but NOT APPLIED, and that is correct — it has nobody to apply to.**
`scripts/retell/set-rental-tools.mjs` adds `rental_days` to **both** `check_availability` and
`book_appointment` **and** the prompt line, in **one update per LLM**, because they are one
contract. It targets **only clients with a `client_inventory` row that has `min_rental_days`
set** — never the nine templates. A roofer, attorney or plumber has no hires to quote, and a
rental prompt line is noise on a call it can never apply to.

Today that set is **empty**, so the script correctly does nothing. **Run it right after the
pilot's inventory rows are loaded** — dry run first, then `--apply`. It re-reads every LLM
afterwards to verify through the consumer's view rather than trusting the write.

**Also fixed in the same pass: `book-appointment` now holds the unit for the whole hire.**
`endsAt` is still one slot long — correct for the owner's-calendar check and the confirmation
text — but `book_slot` is now passed a `holdEndsAt` spanning the rental. Writing one slot there
was the original bug exactly: `/api/available-slots` reads `bookings.ends_at` to decide whether a
unit is out. The calendar check deliberately stays on the short window, because asking whether
the owner is free for three solid days would refuse almost every hire over an unrelated meeting
on day two. A hire outside the item's stated range is **refused**, not re-priced.

### ✅ RESOLVED — Northside stopped responding after the greeting. It was Retell's, not ours.

Agents answered, played the greeting, and never spoke again; Retell logged `3000ms timeout reached
for first token` across **three independent providers** (Vertex, Anthropic direct, Bedrock) while
the identical prompt and tools sent straight to Anthropic answered at **p50 571ms**.

**Retell confirmed it on 2026-08-20 20:32:** *"There seems to be some issue with Anthropic models
for the moment… I would suggest switch to some other models (e.g. GPT 5) for now."* No ETA. The
fleet moved off Anthropic and the symptom is gone — see "Model choice".

**Scope it correctly: this was Retell's ROUTING, not Anthropic.** The three call sites that talk to
Anthropic **directly** — `nova-templates`, `felix/conflict-check`, `email-ingest` — were never
affected and **must not be changed** (open item 10; two run mid-call on live traffic).

**Two theories were formed and BOTH disproved. Do not re-derive either:** "the first call after a
config write dies" (coincidence — calls kept failing with no config change between) and "our
prefill payload got too big" (trimmed 12,108 → 9,868 chars, calls failed identically). Also ruled
out and not worth re-testing: version pinning, concurrency, tool-schema validity,
`model_high_priority`, and `/api/available-slots` itself.

**Do NOT reach for the obvious levers if anything like this recurs.** `model_high_priority` is 4x
worse by this repo's own measurement, and Sonnet's 2399ms p50 sits on the 3000ms cliff — both make
a first-token timeout MORE likely, not less.

**When a call misbehaves, read `public_log_url` on the call object FIRST.** It named the cause in
one request after five tool calls of circling. `scripts/retell/inspect-call.mjs` prints the tool
calls and their arguments; `scripts/retell/call-latency.mjs` prints the per-stage spread.
### The three rental pages — MERGED and LIVE since 2026-08-21

**Decision:** three separate pages, not one combined — grouped by **who is buying**, so Chris can
point one specific person at one specific page and target ads tightly.

| Page | Covers | Buyer |
|---|---|---|
| **Event & Party Rentals** | bounce houses, mobile casino, DJ, **party bus** | event planner / parent |
| **Dumpster & Portable Restrooms** | roll-off dumpsters, portable toilets | contractor / site manager |
| **Equipment Rental** | skid steer, trailers, small plant | contractor / landscaper |

Party bus sits with **events**, not equipment — the buyer is the same person planning the party.

**Both artifacts exist per niche** — a Next.js intake route and a long-form `-leads` cold-email
page. The `-leads` suffix is **load-bearing**: `public/event-rentals/` would collide with the
Next.js route of the same name, and Next gives the page precedence, leaving the static file
unreachable.

Chris's constraint governed the copy — *"we're not putting anything on the pages that isn't
truthful."* So none of the six claims SMS, quoting, deposits, waivers or bulk quantities, and none
asserts an industry-average job value: each ROI figure is labelled a starting estimate the visitor
moves. **This deliberately differs from the nine**, which do assert an "avg job value".

### Twilio / A2P 10DLC — state as of 2026-08-18
- **Account is upgraded to pay-as-you-go with ISV Reseller identity, and the Primary Compliance
  Profile is APPROVED.** Profile SID `BU2afbc3170beb09be1b43a857121049d2`.
- **The legal entity is `3SIX9 MEDIA MASTERS LLC`** (Fort Worth) — *not* "369 Agentic Systems",
  which is a trading name. This is exactly why `agent_subscriptions.business_name` holds the
  customer-facing name while the legal name lives only on the 10DLC form. **Ava must never say the
  LLC name aloud.**
- **Register brands DIRECTLY with Twilio, never through a reseller.** Twilio's own docs: under the
  reseller model you *lose ownership of those Brands and Campaigns*. Retell's managed SMS is less
  work and costs precisely that. Chris chose ownership on 2026-08-18, knowing it means building the
  Trust Hub automation ourselves.
- **Northside must NOT get a Secondary Profile.** It is a test-only client, not a distinct legal
  entity; TCR vets against real business registries and a rejection attaches to the *Primary*
  Profile's trust score. **Register a brand for 3SIX9 MEDIA MASTERS LLC first** — a real entity
  Chris controls — to walk the whole path once before a client depends on it.
- **Costs per client:** ~**$19 one-time** ($4 low-volume-standard brand + $15 campaign vetting) and
  ~**$8–15/month** (campaign $1.50–10, number $1.15, messages ~$0.011 each). Take **low-volume
  standard**, not standard ($44) — that tier is for senders pushing 6,000+ segments a day.
- Fees scale **linearly per client**: ten clients is ~$100/month before a single message.

### Two numbers per client, deliberately. Do NOT "fix" this.
- **Number A — Retell, voice.** The client forwards their published line to it; Ava answers. They
  flip that forwarding on and off as they like.
- **Number B — Twilio, SMS.** Owned by us, which is *required* rather than preferred: A2P
  registration only works on a number in our own Twilio account.
- **Consolidating to one number was investigated on 2026-08-18 and rejected.** Retell's number
  import **requires `termination_uri`** — it *is* elastic SIP trunking, not a simple account link
  (verified in the SDK types and Retell's own custom-telephony docs; the only alternative, "dial to
  SIP URI", means building the telephony yourself). That would put a SIP trunk between every caller
  and Ava, and Retell's community reports a Twilio trunk "connects about 50% of the time".
  Consolidation saves **$2/month per client**. The voice path is proven, measured at 935ms p50, and
  is the product. Not worth it.
- If ever revisited: buy **one** number, trunk it, point it at a throwaway agent, call it twenty
  times, and decide on data rather than a forum post. **Never migrate a live client's number** — it
  is on their trucks, their yard sign and their Google listing.
- **Number B still needs voice forwarding to Number A.** A customer who saves the texting number
  and later calls it gets dead air today. Cheap to configure at provisioning; not yet done.

### What "SMS is live" actually means — sharpened 2026-08-18
Three things. Shipping the first two without the third is the version that costs a customer.
1. **Inbound texts reach Ava.** She answers, books and captures exactly as she does on a call.
   **Most texts should never reach the owner** — a lead texting "yes, Thursday works" is Ava's job,
   and forwarding it to a roofer on a ladder sells him back the problem he paid to be rid of.
2. **The conversation is stored.** If a Retell chat agent owns it, transcripts arrive in the same
   webhook shape calls already use and the dashboard works for free; building our own inbound route
   means building threading and display too. **This is now the strongest argument for the spike.**
3. **"Can you just call me?" escalates.** A lead asking for a human and getting silence is worse
   than never texting them, and it lands on the best leads — the ones ready to buy. Reuse what
   exists: set `leads.urgency` high and fire the proven owner-alert path. **Ava must not promise a
   call she cannot guarantee** — *"I'll flag this for the team now, what's the best time to reach
   you?"* captures the callback window without writing a cheque a roofer has to cash.

### The Retell spike, still unrun
Retell shipped SMS + chat agents in June 2026. **Chat agents run on the web channel with no A2P
registration**, so conversation design and tool wiring can be proven while the paperwork clears.
The question to answer: can a chat agent call the *existing* custom tools — `/api/available-slots`,
`/api/book-appointment`, `/api/capture-lead`? If yes, Retell owns the conversation, we own the
deterministic tools (exactly how booking already works), and transcripts come free. If no, build
our own inbound route.

**Whichever wins, one client gets one SMS identity.** Do not let it split across vendors.

### Per-item inventory — SHIPPED 2026-08-16
`client_schedules.max_concurrent_per_slot` answers "how many jobs at once" (a roofer with three
crews takes three) and is untouched. `client_inventory` + `bookings.inventory_item_key` answer
*which unit* — the princess castle, this skid steer, that dumpster.

- **The load-bearing property: a booking with no item behaves exactly as before.** Every existing
  client books people-time. `verify-inventory.mjs` asserts it directly, because a regression there
  breaks every roofer, attorney and plumber at once and no item test would notice.
- `book_slot()` was **DROPPED and recreated** with a tenth argument. Appending a defaulted parameter
  creates an *overload*, and every existing 9-arg call would go ambiguous — "function is not
  unique", and every booking fails.
- **`lib/availability.ts` was not touched.** `filterAvailable` is already parameterised on capacity,
  so the route runs one pass per item with that item's busy intervals and quantity.
- Matching **refuses rather than guesses**: "castle" fits both Princess Castle and Castle Combo, and
  picking one sends the wrong van to a child's birthday party. An unknown key **raises** rather than
  returning zero rows, so "full" and "misconfigured" stay distinguishable.

### The five niches are three product shapes
| Niche | What it needs | Status |
|---|---|---|
| **Tree services / stump grinding** | Speed-to-lead + on-site estimate booked to calendar. *Nobody quotes a removal by text.* | **Already shipped** — the fastest pilot available, needs no new code |
| Dumpster, portable restroom | Deterministic rate card | Needs SMS quoting |
| Skid steer, party bus, bounce houses | Quote **+ per-item availability** | Inventory shipped; quoting not |

### Backlog — raised 2026-08-17/18, deliberately not built
Recorded so they are not lost, and so they are not mistaken for current scope. None is started.

**Channel plays — conversations, not code:**
- **The top-ten Texas roofing company** (the cousin is their business developer). Biggest name,
  slowest sale: a company that size already has a call centre, so the wedge is **after-hours and
  storm surge**, not replacement. Storm surge is a *capacity* problem, which
  `max_concurrent_per_slot` already models. Needs no code — only the right framing.
- **Brother-in-law sells CRM systems and does not know AI.** That is a **channel, not a customer**:
  he sells the CRM, we are the AI layer on top. Worth one conversation before any integration is
  imagined — and ask *which* CRM first, because it decides everything downstream.
- **Realtors** through the same network. The real-estate vertical already exists; nothing to build.

**Chamber readiness — mostly not code:**
- A chamber room is **mixed businesses**, which makes a vertical page the wrong artifact. The right
  one already exists: the shared demo line, which classifies the caller's industry live and now
  discloses that Ava is AI.
- **The demo is the pitch.** Hand someone the phone, let Ava book *them*, then show the booking land
  on the calendar and the confirmation email arrive. "Proof, not promises" stops being a slogan the
  moment it happens in front of someone.
- What is actually missing is a **leave-behind and a capture path** — a card or QR pointing at the
  demo number, with the existing `/api/intake` catching the follow-up.

**Deferred builds, in rough order of value:**
- **Text-to-Quote, human-confirmed.** Chris has rough pricing only, so v1 **never auto-sends a
  price**: draft → owner approves by one tap → send. The human in the loop *is* the fail-closed
  mode. Quoting commits money where booking only commits time — a wrong zone lookup texts a
  contractor a firm price with a payment link from the yard's own number, and they will hold the
  yard to it.
- **Deposits + Stripe holds, and digital waivers.** Bounce houses and equipment take damage deposits
  as standard. Needs the SMS layer underneath it first.
- **Multi-day rental slots.** `book_slot()` already handles a multi-day interval via `tstzrange`,
  but `generateSlots` is day-bounded, so nothing *offers* a seven-day dumpster hire. Not needed for
  the entertainment pilot; required for dumpsters.
- **Fleet-level availability beyond per-item counts** — which specific unit, where it is, when it
  comes back. `client_inventory.quantity` covers "two identical bounce houses"; it does not track
  individual assets.
- **Setup fee for the rental verticals.** `SETUP_FEE` is 0, removed 2026-07-17 when auto-provisioning
  shipped. Equipment-yard owners think in assets and often prefer a setup fee with a lower monthly.
  Revisit for those niches only, and only with real pricing.
- ~~An event-rentals vertical page~~ — **PROMOTED OUT OF BACKLOG 2026-08-19.** Now three pages,
  greenlit and scheduled. See "The three rental pages" above.

### Compliance, applied and verified
- **Texas TRAIGA disclosure is LIVE on all 11 agents** (2026-08-15). Greeting is *"Thanks for
  calling {Business} — this is Ava, their AI assistant."* Never "automated system", "virtual agent"
  or "bot": those carry the phone-tree associations that actually cause hang-ups.
- **SMS consent is LIVE on all 11 agents** (2026-08-18). Ava asks once, `capture-lead` stores it
  with a timestamp and the sentence behind it, and `sendSms` refuses without it. `consent` is a
  **required parameter**, so the compiler asks at every call site rather than trusting anyone to
  remember. A `true` with no timestamp is refused — it cannot answer "when did they agree".
- Both were rolled out dry-run-first and **verified through each agent's own `response_engine`**,
  then re-checked for version pinning. No drift either time.

### Usage metering: the gate is MET. Billing is BUILT. The switch is OFF.
- **Phase A reconciled clean on 2026-08-15.** First period closed 2026-08-14; `verify-usage.mjs`
  agreed with Retell **exactly** — 48 call durations, 105 minutes. *Caveat: an easy case — 18
  minutes, zero overage. The overage arithmetic has never met real data.*
- **Phase B is built and disabled.** `lib/billing.ts` holds every decision that could charge someone
  wrong; `/api/cron/usage-bill` (11:30 UTC) is thin. Three guards: **`USAGE_BILLING_ENABLED` must
  be exactly `'true'`**; a Stripe idempotency key plus a metadata lookup on pending invoice items so
  a cron running twice cannot bill twice (and if that lookup *fails* it declines to charge); and a
  **$500 auto-bill ceiling**, because every billed number descends from a duration we *copied* from
  Retell.
- `node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-billing.mjs`
  dry-runs the real `decideBilling` against the real ledger and touches Stripe not at all.
- **Northside can never be billed** — no Stripe anchor, and it will never have one retroactively.
- **`TIER_MINUTES` / `OVERAGE_RATE_CENTS` stay unadvertised until the switch flips.** The copy and
  the switch move together. This file has shipped that mistake once already (2026-07-11).

### The calendar chain is proven. Do NOT re-verify it.
On a real call to **Northside** at 2026-08-06 00:25 UTC, with two blocks on the owner's Google
Calendar (9–10 blocked, 10–11 free, 11–12 blocked), a caller asked for *"Friday between nine and
twelve."* Ava offered **"8:00 AM or 10:00 AM"** and booked 10:00 — she threaded the single free
hour. Nothing in our database knew about either block. Everything downstream was correct on the
same call: event titled `Roof inspection — Victoria Gray` with the job address as its location,
**exactly one** caller confirmation stating the right day, owner alert delivered, lead linked,
`confirmation_sent` true.

**The owner-alert path is CLOSED** — the last unexercised step in the booking chain fired and
arrived. It had never fired before because the demo line has no `agent_subscriptions` row.

### Also proven, unattended
- **The `calendar-sync` cron genuinely fires on Vercel.** At 13:02Z on 2026-08-05 it ran with nobody
  watching, found an expired access token, refreshed it, and recorded success without alerting
  anyone. That proves the OAuth refresh path.
- **⚠ SUPERSEDED 2026-08-21 — all 11 agents now run `gemini-3.5-flash`.** See "Model choice" below.
  The table beneath is the 2026-08-04 Sonnet-vs-Haiku benchmark, kept because it is the reason the
  fleet left Sonnet and because its method is the one to repeat. Like-for-like, same agent and
  number:

  | | p50 | max | opening turns |
  |---|---|---|---|
  | `claude-4.6-sonnet` | 2399ms | 10098ms | 9714, 9676, 9511, 10098, 9962 |
  | **`claude-4.5-haiku`** | **964ms** | **1843ms** | 1274 |

### Model choice — `gemini-3.5-flash` on all 11, decided 2026-08-21 by measurement

Retell confirmed the first-token failures were theirs and Anthropic-specific, and recommended
switching models. GPT-5 fixed the blocker but ran hot and sounded wrong. **Gemini Flash is the best
call this project has measured**, and Chris confirmed it by ear — "very quick and very fluid":

| model | llm p50 | max | turns over 3000ms | LLM $/min |
|---|---|---|---|---|
| `claude-4.5-haiku` (benchmark) | 964ms | 1843ms | — | **$0.0251** |
| `gpt-5` | 1707ms | 3881ms | **3 of 20** | $0.0400 |
| **`gemini-3.5-flash`** | **935ms** | **1363ms** | **0 of 23** | $0.0811 |

GPT-5 also abbreviated "August 24th" to "Aug", which TTS read aloud, and tacked ", right?" onto
questions. Both vanished on Gemini. All-in cost per minute: Haiku **$0.131**, GPT-5 **$0.159**,
Gemini **$0.197** — so the best-sounding model is also the dearest, ~3.2× Haiku on the LLM line.

**🔴 Two things to do BEFORE going live, both easy to forget:**
1. **Re-check whether Haiku works again.** Retell had not fixed it as of 2026-08-21 and Chris asked
   them to confirm when they do. Haiku is 3× cheaper and sounded right; re-measure both then rather
   than assuming either. Chris's call: *"stick with Gemini Flash for now and review it before we
   pull the trigger."*
2. **Re-check `OVERAGE_RATE_CENTS`.** Those rates (35/30/25¢) were set when the cost floor was
   Haiku at 13.1¢/min. At Gemini's 19.7¢ the **Elite overage margin falls from ~12¢ to ~5¢/min**,
   and that file's own comment says the rate is meant to cover "Retell plus the LLM plus margin".
   Do this in the same move as flipping `USAGE_BILLING_ENABLED`.

Spend to date, read from Retell's own per-call cost records: **$23.48 over 138 minutes all-time.**
Retell exposes no balance endpoint — that number is dashboard-only.

Change models with `set-client-model.mjs`. It prints a per-agent revert built from what was
actually replaced, and `--only <agentId>` proves a model on one agent before the fleet moves.

### How the calendar integration is built
- `lib/calendar/` is a provider seam. **`google.ts` is the only file that knows Google exists** —
  Microsoft Graph is meant to be a new file, not a rewrite. Never Apple/CalDAV.
- **`lib/availability.ts` was not touched.** A Google freeBusy response reduces to its existing
  `BusyInterval` shape.
- **Reads fail CLOSED, writes fail OPEN.** Both `/api/available-slots` and `/api/book-appointment`
  refuse rather than offer a time they cannot verify. The event *write* after a successful booking
  is non-fatal and marks `calendar_sync_status='pending'` for the cron to retry.
- **`getProviderForClient()` returning `null` is the normal case** and must stay first-class.
- Tokens are AES-256-GCM encrypted under **`CALENDAR_TOKEN_KEY`**. Lose or rotate it and every
  connected client must reconnect by hand. It is in Vercel; keep a durable copy elsewhere.

### Facts that will waste your time if you don't know them
- **There is exactly ONE `agent_subscriptions` row:** `damozman@yahoo.com` →
  `www.Northsideroofing.com`, business_name "Northside Roofing Company", tier Elite. Connecting a
  calendar resolves the client from that table, so you must be logged in as **damozman@yahoo.com**.
- **Two phone numbers, easily confused.** Northside is **+1 (817) 612-6757**; the shared demo line
  is **+1 (817) 635-0220**. A test on the demo line proves nothing about calendars — the demo line
  has no subscription row and can never hold a calendar connection. One session was lost to this.
- **The shared demo agent (`agent_c29218a34d116e3a2a56ba8827`) is neither a template nor a
  subscription**, so scripts that enumerate those two sources miss it. It takes real prospect calls.
  `set-ai-disclosure.mjs` and `set-sms-consent.mjs` both add it by id.
- **A client's Google Calendar timezone is not necessarily the business timezone.** Chris's was set
  to UTC, which rendered a correct 9:00 AM Central booking as 2pm. Expect this on real onboarding.
- **Google returns `"primary"` verbatim** from freeBusy — it does *not* normalise it to the account
  address, so `account_email` stays null and the dashboard says "Google account". Deliberate.
- **`agent_subscriptions.owner_phone` and `followup_method` are written at onboarding and never
  read.** Deliberately kept — both become live the moment owner SMS notification is built.

### Google OAuth status
Consent screen is **published to Production**. Scopes are exactly `calendar.freebusy` +
`calendar.events`. Domain ownership is verified via a TXT record that sits **alongside** the Private
Email SPF record — do not edit that one. `/privacy` and `/terms` must stay at those exact paths and
outside middleware.

**Verification has NOT been submitted.** Until it clears, anyone connecting sees the "Google hasn't
verified this app" interstitial and must click Advanced → Continue, and there is a 100-user cap.

### Open items
0. **Submit for Google verification.** Everything blocking it now exists. Needs a **demo video
   showing end-to-end OAuth consent and the app using the scopes**. Justification, true of the code:
   *we request `calendar.freebusy` rather than `calendar.readonly` specifically so we never receive
   event titles, attendees or descriptions.* Review takes up to 10 days and gates nothing else.
   **Recording order matters:** disconnect the calendar first so there is a fresh consent to film,
   log in as `damozman@yahoo.com`, and call **Northside** on +1 (817) 612-6757 — a demo-line call
   proves nothing, and one session was already lost to that.
1. **Register the A2P brand + campaign for 3SIX9 MEDIA MASTERS LLC.** Low-volume standard. This is
   the gate on every SMS track and it is pure calendar time.
2. **Onboard the cousin's entertainment business** — Stripe checkout with a 100%-off coupon,
   weekend hours, ~180-day horizon, real inventory rows, calendar connected, then a real test call.
   **She is out of town until roughly 2026-09-02**, so this is prepared rather than imminent; the
   chamber event is still ~mid-September. **Chris intends a MOCK onboarding of his own first**,
   which is worth doing for one specific reason beyond rehearsal: it is the only way to verify the
   **welcome-email** link carries `?t=`. The post-payment page was verified against live
   production on 2026-08-19; the email producer calls the same `questionnaireUrl()` in the same
   deployment, but has never been seen. If it ever renders unsigned, the client simply cannot
   submit the form — nothing breaks on a call. Runbook and costs are under "Mock onboarding" below.
   **A real 100%-off checkout was run end to end on 2026-08-18 and it provisions correctly.**
   Stripe returned `payment_status: 'paid'` with `amount_total: 0` — *not*
   `'no_payment_required'`, which was predicted from the API docs and is wrong for a
   subscription-mode checkout whose first invoice is zero. **The 'paid' gate was never a blocker
   for this flow.** Do not re-derive that theory; it was tested and disproved. (The webhook now
   also accepts `'no_payment_required'` as hardening — that status is real for other shapes,
   such as a trial with no payment method — but nothing about the pilot depended on it.)
   **What the run DID surface, and what actually threatens her onboarding:**
   - **One checkout provisioned THREE agents and THREE phone numbers.** **Fixed 2026-08-18** —
     `provisioning_claims` claims a purchase by `stripe_subscription_id` *before* Retell is
     called, so a duplicate delivery loses the insert and spends nothing. Verified with
     `scripts/verify-provisioning-idempotency.mjs`, which buys nothing: it runs every call under
     a deliberately invalid `RETELL_API_KEY`, so a broken guard fails authentication before
     `phoneNumber.create()` instead of purchasing. **The migration must be applied before the
     code ships** — without the table `provisionClient` refuses every signup, fail-closed by
     choice. Applied to production 2026-08-18.
   - **A test-mode Stripe webhook endpoint is registered against `https://369agenticsystems.com`**,
     so a *test-mode* checkout provisions REAL Retell agents and numbers and writes REAL rows to
     production Supabase. There is no sandbox below the Stripe layer.
   - `business_name` was never written by `provisionClient` — fixed 2026-08-18. Without it
     `lib/client-identity.ts` falls back to a generic phrase and every client-branded message
     goes out unbranded. Northside only had one because it was inserted by hand.
   Re-verify with `scripts/verify-zero-dollar-checkout.mjs`, and always run
   `scripts/cleanup-zero-dollar-test.mjs` afterwards — it sweeps orphaned agents by name, not
   just the one the subscription row records.
   **Her `client_schedules` row must be written explicitly, at onboarding.** There is no row by
   default and `DEFAULT_SCHEDULE` (`lib/client-schedule.ts`) closes Saturday and Sunday and caps
   the horizon at 14 days. A party-rental business is almost entirely weekends and books months
   ahead, so on defaults Ava refuses every Saturday and anything past a fortnight — and it reads as
   a bug in the booking engine, not as configuration.
3. **Trust Hub automation.** Secondary Profile + brand + campaign via API at signup. **Blocked on a
   data gap:** the questionnaire collects pain points and job values, not legal business name, EIN,
   address or authorized rep. Signup has to ask, and clients have to be willing to hand over an EIN.
   Approval is asynchronous, so SMS becomes a *second stage* — voice live in minutes, texting live
   when the campaign clears.
4. **Phase B billing: flip the switch when Stripe is live.** Set `USAGE_BILLING_ENABLED=true` in
   Vercel (needs a redeploy) and **flip the pricing copy in the same move.** Run
   `scripts/verify-billing.mjs` first.
5. **Audit the other five crons' real output.** `silence-check` selected a column that never existed
   and failed silently for months — nobody read its output, only that it ran. Assume siblings.
6. **Phase 2b bulk runner — NOT built, deliberately.** Blocked on a decision only Chris can make:
   cold-calling businesses that never made contact is a different legal posture from calling a form
   submitter. Do not build this unprompted.
7. **`lib/email-templates.ts` is unreferenced dead code.** All four templates lost their only caller
   when `/api/update-dossier` was deleted.
8. **The test-mode Stripe webhook to production is DISABLED — re-enable it for the next full
   E2E.** Endpoint `we_1Trrqk3nqoZlRtPEan18MmjD` → `https://369agenticsystems.com/api/stripe-webhook`,
   `checkout.session.completed`, created 2026-07-11, **disabled 2026-08-18** at Chris's request
   after a sandbox checkout provisioned real Retell agents and bought real numbers.
   **Production's Stripe integration is wired to TEST mode** — that endpoint is `livemode: false`
   and production verified its signature successfully, which is only possible if production's
   `STRIPE_WEBHOOK_SECRET` is this endpoint's. So while it is disabled, **a checkout on the live
   site provisions nothing.** That is safe today (zero paying clients, Stripe live mode never
   started) and it is the point — but it must be re-enabled before any full end-to-end run, and
   before live mode. Re-enable:
   ```
   node --env-file=.env.local -e "import('stripe').then(async({default:S})=>{const s=new S(process.env.STRIPE_SECRET_KEY);const e=await s.webhookEndpoints.update('we_1Trrqk3nqoZlRtPEan18MmjD',{disabled:false});console.log(e.status)})"
   ```
9. **Inventory control is a planning number, not a live stock count — and clients cannot touch it.**
   Raised by Chris on 2026-08-19 after the mock onboarding, in this order of value:
   - **Ava reads inventory and hours LIVE on every call** (`loadInventory` / `loadSchedule`), so a
     row changed at 9:00 is honoured on the 9:01 call. No sync, no redeploy, no agent update.
     Questionnaire *text* is different — it is COPIED into the agent prompt at submit time and is
     stale until re-synced. Do not confuse the two paths.
   - **Nothing READS `client_inventory` back. [CORRECTED 2026-08-21]** This item used to say no UI
     reads *or writes* it and that `grep -rln client_inventory app components` returns nothing. It
     returns `app/api/questionnaire/submit/route.ts`, which **writes** the table — so a client can
     set inventory once, at onboarding, and never see it again. They cannot fix a mistyped quantity
     or take a torn bounce house out of service. The `active` column exists and is read live; it is
     simply unreachable. And once `questionnaireCompleted` is true the dashboard checklist drops its
     link, so there is no route back to the questionnaire either; only the 90-day emailed link.
     **The missing read is also what makes item 12 destructive** — a form that cannot show existing
     rows cannot round-trip them.
   - **The real modelling gap is rental WINDOWS, not damage.** `quantity` is compared against
     bookings that overlap an appointment *slot*. A bounce house booked Saturday 10:00 for 90
     minutes reads as free at noon, while it is physically at a party until Sunday. `book_slot()`
     already takes a `tstzrange`, so the interval can span days; `generateSlots` is day-bounded,
     which is the same root cause as the unbuilt seven-day dumpster hire.
   - Nothing reconciles stock against reality: not returns, not condition, not turnaround.
   **Build order when this is worth building:** rental windows → turnaround buffer → an
   out-of-service toggle in the dashboard → bulk quantities (`bookings.quantity`, `count(*)`
   becomes `sum(quantity)`, which means dropping and recreating `book_slot` and finally editing
   `lib/availability.ts`). Do the last one only when a client's chairs actually run out on a
   Saturday; identity items are the scarce ones, bulk stock usually is not.
10. **Three Anthropic call sites still pin `claude-sonnet-4-6`** (`email-ingest`,
   `felix/conflict-check`, `nova-templates`). Deliberately left alone — the latter two run mid-call
   on live Retell traffic. Measure before changing any of them.
11. ✅ **DONE 2026-08-21 — Nova's roofing fallback.** Kept here only because the original write-up
   **named the wrong line**, and that error was copied into `WHAT-CAN-I-DELIVER-TODAY.md` and
   `ROADMAP.md` before anyone read the route.
   - The blamed line — `lib/nova-templates.ts` `?? VERTICAL_COPY.roofing` — is **not** how it fired.
     `app/api/nova/booking-confirmation/route.ts` already **refuses** a real-but-unsupported
     vertical and logs `skipped_unsupported_vertical`; production has two such rows, so the guard
     demonstrably works.
   - The live fallback was in the **route**: `isSupported ? raw : 'roofing'`, reached only when the
     vertical is **empty**. Not exotic — **a third of `leads` rows have a null vertical**, and the
     shared demo line has no `agent_subscriptions` row to fall back to while taking real prospect
     calls. So a stranger could get a confident email about their upcoming roof inspection.
   - **Northside's own subscription still said `vertical: 'roofing'`** after being converted to a
     rental agent, so its confirmations described bounce houses as roofing. Row corrected to
     `event-rentals`.
   - Fixed: added `event-rentals` / `dumpster-rental` / `equipment-rental` with delivery-shaped
     nouns, plus an **`unknown`** template that names no trade and restates the booking instead of
     advising how to prepare for a visit it cannot know. Both fallbacks now point at `unknown`.
     Verified by generating real emails, not by types: the neutral one names no industry, and the
     rental one talks about clearing the setup area, water and power, and takedown.
   **The lesson, and the reason this entry survives:** the write-up was derived by reading one
   library file, and the guard that changed the whole diagnosis was two files away. *A bug derived
   from reading code is a hypothesis until the calling path is read too.*
12. 🔴 **A partial questionnaire re-submit deactivates inventory the client never typed in.**
   Found 2026-08-21. The form starts from one blank row and never prefills from `client_inventory`
   (`app/onboarding/questionnaire/[domain]/page.tsx:55`); on submit, every item **not** in the
   posted list is set `active: false` (`app/api/questionnaire/submit/route.ts:176-180`), and
   `loadInventory` returns only active rows. **The pilot's ~40 spreadsheet-loaded items are wiped
   the first time she reopens the form to add one new unit.** A fully blank submit is safe (the
   `unique.length > 0` guard); the partial submit is the dangerous one. The deactivation is
   *correct* when the questionnaire is the only writer — it became wrong when a script became a
   second writer. **Same root cause as the compliance-line stripping**; fix them as one pass, see
   `docs/ROADMAP.md` Track 2.1.

### Lessons that each cost real time
- **A command quoted in prose is a claim, and running it takes ten seconds.** Two wrong facts sat in
  `WHAT-CAN-I-DELIVER-TODAY.md` for days because the doc said *"`grep -rln client_inventory app
  components` returns nothing"* and every reader — human and model — believed the quoted output
  instead of running the grep. It returns a file, and that file **writes** the table, which changes
  what the fix is. The doc's own rule already covered this; the gap was that a pasted command
  *looks* like evidence. **Re-run it.** Same failure shape as reconciling a copied value against
  its source.
- **One field name reused across pages will come to mean a different thing on each one, and the
  schema will pick the wrong meaning and look fine.** Twelve intake forms all posted
  `industry_specific_field`. On three pages it was a service area; on the others it was a monthly
  volume, a book size, an MRR band, or the company name repeated. Step 0 gave that slot a column
  called `service_area` — a perfectly reasonable name for what **one page** meant — and from then
  on the database confidently held a prospect's service area as "400". **Nothing errored, nothing
  looked wrong, and reading any single page would have confirmed the schema was right.** The bug
  only exists in the space *between* the pages. When a shared key feeds a shared column, read every
  producer before naming the column, and prefer several honest names over one flexible one.
- **Two writers, one of which thinks it is alone, is a data-loss bug waiting for a date.** The
  questionnaire deactivates inventory it did not see, and `mergePromptWithContext` discards prompt
  text it did not write. Both are *correct* in isolation and both are destructive the moment a
  script writes the same state. When adding a second writer to anything, ask what the first one
  does with rows it does not recognise — and expect the answer to be "deletes them."
- **A page cloned from another page inherits its NUMBERS, and numbers do not look wrong.** The three
  rental pages were built from `wholesale-leads`. Four things came across unnoticed: the primary
  hero CTA still said *"Deploy Distribution Velocity AOS"*, the ROI fallbacks still read
  `$12k / $53k / $640k`, Nova's `alt` text still said "Order Confirmation", and the readout ids
  still said `monthly`/`quarterly`. **The numbers were the hardest to see, because they were
  internally consistent and correct — for wholesale.** 5/wk × $8,200 × 0.30 genuinely is $640k a
  year. Prose gets reread when a vertical changes; a figure in a `<div>` does not. **After cloning a
  page, diff it against its source and read every literal that survived**, and check each one
  against the new page's own inputs rather than against whether it looks plausible.
- **A doc that says "shipped" is making a claim about production, and needs the same proof as code.**
  `WHAT-CAN-I-DELIVER-TODAY.md` — the file whose header says to read it *before a chamber event* —
  described three rental pages as shipped and reachable from the homepage while they sat on an
  unmerged branch. It also disagreed with itself on row counts. `git ls-tree master` and one
  Supabase count settled both in under a minute. Its own rule was already right: **re-derive from
  the live system, never from the doc's previous version.**
- **A bug derived from documentation is a hypothesis, not a finding.** On 2026-08-18 a careful
  reading of the Stripe webhook produced a confident, specific, plausible claim: a 100%-off
  checkout sends `payment_status: 'no_payment_required'`, the gate only accepts `'paid'`, so the
  pilot silently provisions nothing. It survived an independent review. **A real checkout then
  returned `'paid'` with `amount_total: 0` and provisioned fine.** The theory was wrong, and no
  amount of further reading would have shown it — only the run did. Same principle as
  reconciling a copied value against its source: *the system is the authority on its own
  behaviour.* Insisting on the end-to-end run before the fix merged is what caught it.
- **One checkout can provision several times, and nothing stops it.** That same run created
  **three** Retell agents, three phone numbers and three duplicate `agent_configurations` rows
  from a single purchase — the event reached both a local listener and the registered production
  endpoint, and production was retried 37 seconds later. `checkout.session.completed` has **no
  idempotency guard**: no lookup on `stripe_subscription_id`, no dedupe on the event id. The
  `agent_subscriptions` upsert hides it, because `onConflict: 'client_domain'` overwrites only
  the columns present in the payload — so the surviving row was a *mixture of two different
  provisioning runs*, taking `business_name` from one and `retell_agent_id` from another, and
  looked entirely normal. Every duplicate agent and number stays purchased and billing.
- **A webhook that returns 200 is not a webhook that did anything.** The Stripe gate answered
  `{received: true}` for every `payment_status` it did not recognise, so any refusal was
  indistinguishable from success in Stripe's dashboard. The producer's view of a webhook is "did
  it get a 2xx", which is not the same question as "did the work happen" — the same shape as the
  dental funnel money-risk fix. Fixed 2026-08-18: a handler that declines to act now logs and
  sends an owner alert, and the status set has an explicit else-branch rather than a silent
  default.
- **One-sided adoption always leaves a window.** When two things arrive in an order you do not
  control, *each* must adopt the other. The leftover 73ms window between a booking row existing and
  its `calendar_event_id` being written hit on the very first real call and put a phone number on a
  customer's calendar event instead of their name. **Do not "fix" ordering by reordering the
  prompt**: tool-call order is the model's to choose.
- **Verify through the consumer's view, not the producer's.** An LLM that reports the new value
  while the agent still resolves to an older version is what made the demo line answer calls and
  record none for ten days.
- **A bare Postgres `timestamp` has no timezone, and `new Date()` reads it as the server's.** Vercel
  runs UTC. This told a real customer their appointment was Wednesday when it was Thursday.
- **Arming a shared-secret gate silently breaks every producer that did not get the new secret.**
  After arming any gate, enumerate the producers and verify each one still delivers.
- **Measure before recommending.** A four-minute benchmark settled a model-choice question that
  would otherwise have been argued from plausible reasoning.
- **Retell's transcript splits an agent turn whenever ASR hears anything.** Never diagnose call
  quality from a transcript when a human heard the call.
- **A copied value can only be checked against its source.** `calls.duration_seconds` is copied from
  Retell, so when the copy is wrong *nothing inside our own database can tell* — our sums agree with
  our rows and our rows are simply short of the truth. Reconcile against the source, not the mirror.
- **`.limit(5)` is not a count.** Two numbers reported to Chris were wrong because a probe query
  capped at five rows was read as the total.
- **Advertise a promise only when the system can keep it.** Copy and capability ship together.
- **Outside advice is worth verifying, not adopting and not dismissing.** Two external AI reviews
  (2026-08-15) were graded against the repo. The confident, specific claim — *"your primary CTA is a
  dead link"* — was **false**: every flagged `href="#"` carries a `data-audit` handler and the
  reviewer had read the HTML without running the JS. The claim that sounded like boilerplate —
  *"Texas requires AI disclosure"* — was **real, in force, and unmet on a live client's line.**
- **A "leave alone" note can outlive its reason.** `369AgenticSystems.code-workspace` sat dirty for
  a month because every session deferred to a warning nobody had checked. It was three lines of
  editor config. A permanently dirty `git status` is a broken smoke detector.
- **Read the SDK types before promising an integration is simple.** "Import a Twilio number into
  Retell" sounds like an account link; `PhoneNumberImportParams` requires `termination_uri`, so it
  is elastic SIP trunking. That reversed a recommendation made one message earlier.
- **"Just add another vertical" is almost never the answer here.** Nine are live, zero clients have
  ever paid, and the one real subscription logged 18 minutes in a month. Distribution has always
  been the constraint. A warm introduction beats a tenth landing page.

### Mock onboarding — RUN on 2026-08-19, and what it proved
Cost about **$4.26** across two Retell numbers, both released; the account is back to 2 numbers,
11 agents, 1 subscription, 0 claims.

- **The welcome-email link IS signed.** Submitting the questionnaire from that email succeeded
  through the armed gate, which is the only way to observe it. That was the whole point of the run
  and the last unverified producer. Do not re-derive this.
- **A 214 (Dallas) checkout failed with `404 No phone numbers of this area code`.** Everything
  around the failure behaved: orphan cleanup deleted the agent and LLM so nothing leaked, the
  claim was released so Stripe's retry could try again, and the owner alert fired with the real
  error. **817 worked**, so this is per-area-code inventory at Retell, not a broken account. The
  fallback is PR #45.
- **Two separate checkouts provisioned twice**, correctly — different `stripe_subscription_id`,
  so they are genuinely different purchases rather than duplicate deliveries. The orphan sweep
  found the second number because it matches on **agent name**; the subscription row names only
  the last writer.

### Mock onboarding — the runbook, and what it costs
One real Retell number, bought and released. Everything else is free. Stripe stays in test mode,
so no card is charged, but **Retell has no test mode** and the number is a real purchase.

1. **Enable the Stripe webhook** `we_1Trrqk3nqoZlRtPEan18MmjD` (open item 8) — it is disabled,
   so nothing provisions while it is off.
2. `node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-rental-windows.mjs
                                         multi-day hire: schema + a REAL three-night hold, proving
                                         the days in the MIDDLE are blocked. Buys nothing.
                                         **Refuses until 2026-08-19-rental-windows.sql is applied.**
node --env-file=.env.local scripts/verify-zero-dollar-checkout.mjs` — preflight, spends
   nothing. Then `--apply` to print the checkout URL. The `ZERODOLLARTEST` promo code and its
   100%-off coupon `hmfiggoW` already exist and are active.
3. Complete the checkout. Use the throwaway domain the script prints, exactly — the cleanup keys
   on it.
4. `node --env-file=.env.local scripts/verify-onboarding-result.mjs <domain>` — expects exactly
   ONE agent, number, claim and receptionist row. More than one means the idempotency guard
   regressed.
5. **Open the welcome email and check the questionnaire button's URL contains `?t=`.** This is
   the step that cannot be automated and is the whole reason the mock run is worth a number.
6. Fill the questionnaire in. Then `setup-client-inventory.mjs` if testing the spreadsheet path.
7. `node --env-file=.env.local scripts/cleanup-zero-dollar-test.mjs` — dry run, then `--apply`.
   It sweeps orphaned agents **by name**, not just the one the subscription row records.
8. **Disable the webhook again**, and re-check Retell is back to 2 numbers.

### Verification scripts (all committed, all run against live systems)
```
node scripts/mobile-audit.mjs            renders all 19 public pages at 5 widths in Chromium and
                                         reports horizontal overflow, clipped content and
                                         untappable targets. Needs `npm start` first.
                                         --url <origin> to audit a deploy, --shots for PNGs.
                                         DO NOT reason about breakpoints instead of running this:
                                         a July session found 2 real bugs this way, the script was
                                         never committed, and the next session guessed and missed 4.
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
node --import ./scripts/test-resolver.mjs scripts/verify-billing.mjs
                                         dry-runs the REAL decideBilling; touches Stripe not at all
node --import ./scripts/test-resolver.mjs scripts/verify-inventory.mjs
                                         schema + a REAL double-book race against one item
node --env-file=.env.local scripts/verify-zero-dollar-checkout.mjs
                                         preflight for a 100%-off checkout; dry run, --apply to
                                         create the coupon. Completing the checkout BUYS a Retell
                                         number and writes to PRODUCTION Supabase.
node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-provisioning-idempotency.mjs
                                         duplicate-delivery guard; BUYS NOTHING by design
node --env-file=.env.local scripts/cleanup-zero-dollar-test.mjs
                                         releases that number + agent + LLM and deletes the rows;
                                         dry run, --apply to delete. Refuses to touch Northside.
node --env-file=.env.local scripts/verify-onboarding-result.mjs <domain>
                                         asserts a real onboarding produced exactly ONE of
                                         everything. Read-only. Run it again after re-delivering
                                         the Stripe event — unchanged counts is the actual test.
node --env-file=.env.local scripts/review-sandbox-client.mjs --create|--show|--delete
                                         a throwaway client for reviewing onboarding UI by hand.
                                         No retell_agent_id, so submitting the questionnaire
                                         against it cannot reach any live agent's prompt.
                                         USE THIS, never a real client's domain.
ONBOARDING_TOKEN_SECRET=<same as server> node --env-file=.env.local --import ./scripts/test-resolver.mjs   scripts/verify-questionnaire-auth.mjs  proves the ownership gate; reports whether the server is
                                         ENFORCING or reporting-only rather than assuming
node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-questionnaire-roundtrip.mjs
                                         proves a RE-SUBMIT preserves what the form was not shown:
                                         weekend hours, horizon, lead time and inventory all
                                         survive, while an item deliberately removed still
                                         retires. Runs against the review sandbox and REFUSES any
                                         client with a retell_agent_id. Needs the dev server;
                                         BASE_URL to point at another port.
node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-intake-payload.mjs
                                         the intake payload contract, through the REAL route into
                                         production Supabase: every field in its own column,
                                         unreadable numbers NULL rather than 0, out-of-range NULL
                                         rather than clamped, and the old cached-page shape still
                                         accepted. Deletes every row it writes. Needs the dev
                                         server; BASE_URL to point at another port.
node scripts/verify-intake-forms.mjs     the other half — 66 checks in a real BROWSER that all 11
                                         leads pages actually SEND that contract, and that a submit
                                         with no bottleneck checked is blocked. Intercepts
                                         /api/intake, so it writes nothing and mails nobody.
                                         Needs a server running.
node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-questionnaire-inventory.mjs
                                         questionnaire -> schedule + inventory, end to end against
                                         a throwaway client. Buys nothing. Needs the dev server.
node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/setup-client-schedule.mjs <domain>
                                         weekend/horizon profile; proves the effect through the
                                         REAL generateSlots, not by reporting a successful write.
                                         **--gaps-only** writes just booking_horizon_days and
                                         lead_time_hours, so it cannot clobber the hours a client
                                         typed into the questionnaire.
node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/setup-client-inventory.mjs <domain> <file.xlsx|csv>
                                         bulk inventory from the client's own spreadsheet, via the
                                         wholesale ops-brief parser. Reports which spoken phrases
                                         would come back AMBIGUOUS before anything is written.
node --env-file=.env.local scripts/retell/recon.mjs                    every LLM's tool URLs
node --env-file=.env.local scripts/retell/set-client-model.mjs         dry run; --apply to write
node --env-file=.env.local scripts/retell/set-ai-disclosure.mjs        dry run; --apply to write
node --env-file=.env.local scripts/retell/set-sms-consent.mjs          dry run; --apply to write
node --env-file=.env.local scripts/retell/set-rental-tools.mjs         dry run; --apply to write.
                                         Adds rental_days to check_availability AND book_appointment
                                         AND the prompt, in ONE update. Targets ONLY clients with
                                         min_rental_days set — never the templates.
node --env-file=.env.local scripts/retell/update-availability-tool.mjs dry run; --apply to write
node --env-file=.env.local scripts/retell/update-demo-script.mjs       aborts on bad tool names
```

### Environment notes
- Chris runs **PowerShell**. Never hand over bash syntax or angle-bracket placeholders — `<` is a
  reserved operator and the line fails to parse before running. Script it with prompts instead.
- **Retell webhooks always hit production**, never a preview — the URL is on the agent.
- Vercel previews are SSO-protected; `curl` gets `401 "Protected deployment"` without a bypass token.
- Vercel **bakes env vars in at build time** — changing one requires a redeploy.
- `npm test` uses `scripts/test-resolver.mjs` so Node can resolve the `@/` alias. It also means
  **TypeScript parameter properties (`constructor(private readonly x)`) will not run** — write the
  fields out longhand.
- A hook blocks writing to `.env*` files. Pass secrets inline (`VAR=value node ...`) instead.

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

## Launch State (as of 2026-08-18)
- Dental: all agents marked FUTURE (not yet deployed to that vertical)
- Legal: 4 agents (Ava, Rex, Nova, Felix) — all LIVE
- SaaS: 4 agents (Ava, Rex, Nova LIVE; Scout DEPLOYING — not built)
- All other verticals: 3 agents (Ava, Rex, Nova) — all LIVE
- Zero paying clients. No testimonials, logos, or plural-client claims are permissible anywhere.
- **Inbound SMS still does not exist.** `lib/twilio-sms.ts` sends only, called only by Rex
  sequences; there is no inbound route among the API routes. Rex SMS follow-up and Nova review
  requests are NOT shipped — the "coming in phase 2" notes on the agent pages are accurate, leave
  them. `SMS Estimating — COMING SOON` on the homepage is likewise true; leave it until the SMS
  work actually lands. **Twilio is unconfigured**, so nothing can send regardless.
- **Rex's templates are client-branded and consent-gated as of 2026-08-18.** They render
  `{business}` from `agent_subscriptions.business_name`, carry "Reply STOP to opt out" on step 0,
  and `sendSms` refuses without a recorded, timestamped opt-in.
- **Per-item rental inventory IS shipped** (`client_inventory`, `bookings.inventory_item_key`,
  `book_slot()` with a tenth argument). No client has inventory rows yet.
- **Google Calendar booking IS shipped and proven on a real call.** Ava's page and `/privacy`
  describe it in the present tense, corrected 2026-08-10 (PR #31). The Cal.com claims that used
  to sit there are gone, as is "Claude Sonnet" from Ava's tech list — but `/book-demo` still
  embeds a genuine Cal.com widget for Chris's own discovery calls, and that one is correct. Do
  not "clean it up".
- Every client agent runs `gemini-3.5-flash` as of 2026-08-21, chosen by measurement. **Ava's tech
  list on `/agents/ava` names no vendor at all**, corrected the same day: it said "Claude Sonnet"
  while she ran Haiku, then "Claude" while she ran Gemini — wrong twice for the same reason. Her
  voice model has changed three times and is picked by measurement, so any name there is a claim
  that expires unnoticed. **Rex, Nova and Felix still say "Claude" and are correct** — they call
  the Anthropic API directly and are unaffected by Retell's routing.
- **Pricing is still flat: $400 / $600 / $750, no minute limits advertised anywhere.** The meter
  measures and the biller is built, but the switch is off. Do not put minutes or overage on the
  pricing page until `USAGE_BILLING_ENABLED` is `'true'`.
- The `system_audits` invented metrics — `security_score`, `seo_visibility`, `lead_velocity`,
  `roi_multiplier`, `revenue_leakage` — were **nulled across all 22 rows on 2026-08-10** and
  `leak_detected` set false. They were never measured. The admin dashboard's leak counter reading
  0 is the honest number, and `/api/email-ingest` no longer fetches them at all.
- Three homepage `Confirmation Specialist` badges were corrected STANDBY → ACTIVE on 2026-08-15,
  after verifying all 11 live Retell LLMs carry `book_appointment` / `check_availability` /
  `capture_lead` and Nova has templates for all nine verticals.

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

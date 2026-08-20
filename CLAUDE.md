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

**Last updated:** 2026-08-20 (overnight).

### Where this session ended — 2026-08-20 (overnight)

**`master` is clean, nothing is open, everything below is deployed.** PRs #42–#47 merged; the rest
went straight to master. 248 tests pass.

**🔴 The one blocker: Northside stops responding after the greeting.** See the UNRESOLVED section
below — a Retell-side first-token timeout, extensively ruled out on our side, and it is what
stopped testing. **Calls DO get through intermittently** (four worked tonight), so this is a
support ticket, not a code change.

**Northside has been converted into a RENTAL test agent. It is no longer a roofing agent.**
Deliberate and reversible, and it will confuse anyone who does not know:
- `general_prompt` swapped to an event/party-rental receptionist. **The original LLM config —
  greeting, prompt, all tools — is backed up** as `northside-llm-backup-2026-08-20.json` in that
  session's scratchpad. If it is gone, re-clone from the roofing template.
- **40 `client_inventory` rows** loaded from `templates/mock-event-rental-inventory.csv`.
- A `client_schedules` row on the **entertainment profile** — Sat 08:00–20:00, Sun 10:00–18:00,
  180-day horizon, written by `setup-client-schedule.mjs`.
- To undo: delete its `client_inventory` rows and restore the prompt from the backup.

**Production state, verified rather than assumed:**
- Retell: **11 agents**, **2 numbers** — unchanged all night, nothing was provisioned.
- Supabase: **2 `agent_subscriptions`** — Northside plus a **leftover `review-sandbox`** row (no
  `retell_agent_id`, harmless; `review-sandbox-client.mjs --delete` removes it).
- `client_inventory` **40**, `client_schedules` **1**, `bookings` **24**, `leads` **31**,
  `calendar_connections` **0**.
- The test-mode Stripe webhook is still **DISABLED**. Nothing provisions from a checkout.

**What shipped tonight**
- **Multi-day rental windows.** `generateRentalWindows` + `formatRentalWindow`, migration applied,
  `verify-rental-windows.mjs` green against production — including the check that matters: a real
  three-night hire booked, then the same unit refused **mid-hire**.
- **`book-appointment` holds the unit for the whole hire.** `endsAt` stays one slot long (right for
  the owner's-calendar check and the confirmation text); `book_slot` now receives a `holdEndsAt`
  spanning the hire, because `available-slots` reads `bookings.ends_at` to decide if a unit is out.
- **Per-item inventory is reachable by voice at last.** `check_availability` and `book_appointment`
  had **no `item` parameter at all** — shipped 2026-08-16 and unreachable by phone the entire time,
  because every test called the API directly. Verify through the consumer, not the producer.
- **Ambiguous and unknown items are refused** by `available-slots` rather than falling through to
  intra-day slots. "Do you have a bounce house?" used to answer "8:00 AM or 9:00 AM".
- **`sms_consent` is a required enum** (`granted` / `declined` / `not_asked`) on **all 11 agents**,
  and is **proven on a real call** — asked, answered, stored `true`.
- **`booking_token`** — `available-slots` mints a signed handle carrying the item and the exact
  interval; `book_appointment` spends it. Verified against production: tampered and invented
  tokens 409, a valid one books the right unit for the right window with nothing else supplied.
- Docs: `WHAT-CAN-I-DELIVER-TODAY.md` rewritten from live state, the other three
  `docs/architecture/` files bannered STALE, `docs/README.md` corrected.

**⚠ Latency regressed and is NOT fixed.** This agent benchmarked at **964ms p50**; the last working
call measured **llm p50 1438ms, e2e 1821ms, max 3129ms**. Chris called it "not very fluid", and one
turn crossed Retell's 3000ms cliff *during a working call*. Cause is prefill growth — prose written
into tool descriptions and the system prompt, which are re-sent every turn. Trimmed once
(12,108 → 9,868 chars); **more is still warranted**, `capture_lead` alone is 2,571 chars.
**Measuring trap:** a single-turn probe reads ~700ms while a real call averages **6,602
tokens/request**, so measure mid-conversation or the number flatters.

**Next session: do NOT sit waiting on Retell.** `docs/architecture/WHAT-CAN-I-DELIVER-TODAY.md`
now splits its finish list into **Group A** (calendar time — A2P, Google verification, the Retell
ticket), **Group B** (buildable right now, nothing blocks it), and **Group C** (gated on a real
client). Group B is the queue: **the three rental pages first** — greenlit, and the engine they
waited on shipped last night — then cutting per-turn prefill, then an inventory screen.

**Three changes are untested by voice** — they landed after the last connected call:
`booking_token` **required** with `"none"` as the escape, and the trimmed descriptions. On the next
call that connects, watch whether `book_appointment` finally carries a token: the booking has
stored `inventory_item_key: null` on every attempt so far.

**The lesson the night kept teaching: optional means omittable.** `item`, then `sms_consent`, then
`booking_token` were each defined on the tool, described in the prompt, and simply not sent.
Strengthening the wording failed twice. What worked was making the parameter **required with a
truthful escape** — `not_asked`, `"none"` — so the model is never cornered into inventing an
answer. Reach for that shape before reaching for firmer wording.

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

### ⚠ UNRESOLVED: Northside stops responding after the greeting — it is NOT our config
As of 2026-08-20 07:00 the agent answers, plays its greeting, and never speaks again. Retell logs
`3000ms timeout reached for first token`, three attempts, then `Failed to get response from any
LLM provider`. `llm_token_usage` is absent — no request ever completed, nothing billed.

**Two theories were formed and BOTH were disproved. Do not re-derive either.**
1. *"The first call after a config write dies — burn one."* Held 5-for-5 for a while, then broke:
   calls kept failing with **no config change in between**. It was coincidence — config writes and
   test calls were simply interleaved all evening.
2. *"Our prefill payload got too big."* Trimmed 12,108 → 9,868 chars and **calls kept failing
   identically**, so payload does not explain a death on the FIRST turn, where context is small.
   **But do not over-read that retraction:** a later working call measured **llm p50 1438ms
   against a 964ms benchmark, max 3129ms** — so prefill growth is real, costs fluidity, and does
   push the tail across the 3000ms cliff mid-call. The original "~700ms, nothing to see" probe was
   unrepresentative: it measured a **single turn** while a real call averages **6,602
   tokens/request**. Payload is a live fluidity problem; it is just not the first-turn cause.

**DECISIVE EVIDENCE — 2026-08-20 21:11. Retell's own log names three providers:**
```
triedKeys: [ vertex-anthropic-global:claude-4.5-haiku,
             anthropic-default:claude-4.5-haiku,
             bedrock-runtime-claude-global:claude-4.5-haiku ]
errorMsgs: [3000ms timeout, 3000ms timeout, 3000ms timeout]
```
Retell failed to get a first token from **Google Vertex, Anthropic direct, and AWS Bedrock** —
three independent vendors, identical failure. Minutes later, the **exact same `general_prompt` and
tool schemas**, read live off that agent and sent straight to Anthropic: **p50 571ms, max 940ms,
0/6 over 3000ms.**

Three independent providers do not degrade simultaneously and identically, and the payload that
allegedly could not produce a token in 3s answers one of those same providers in half a second.
**The fault is inside Retell's request path. Our configuration is exonerated — stop re-testing it.**

Also ruled out, each checked directly: agent/LLM version pinning (agent v0 resolves LLM v0),
concurrency (1/20), tool schema validity (all three tools verified against production),
`model_high_priority` (false), and `/api/available-slots` itself (200 in ~600ms, minting tokens).

**Do NOT reach for the obvious levers.** `model_high_priority` is 4x worse by this repo's own
measurement and Sonnet's 2399ms p50 sits on the cliff — both make it MORE likely, not less.

**TICKET FILED with Retell on 2026-08-20** carrying the `triedKeys` line and the direct
measurement. Awaiting their reply — **do not re-diagnose this while it is open**, and do not
re-test the configuration to "check": it has been checked four times and exonerated.

**Original note, kept for the evidence list:** Evidence to send: agent
`agent_d39a1b13cfd8fb2e3c9c12f06e`, the `public_log_url` of any dead call, and the point that the
same model, prompt and tools answer in ~700ms when called directly. The 3000ms first-token budget
is Retell's setting and is not exposed to us.

**When a call misbehaves, read `public_log_url` on the call object FIRST.** It named the cause in
one request tonight after five tool calls of circling.

### The three rental pages — GREENLIT 2026-08-19, engine first

**Decision:** three separate pages, not one combined — grouped by **who is buying**, so Chris can
point one specific person at one specific page and target ads tightly.

| Page | Covers | Buyer |
|---|---|---|
| **Event & Party Rentals** | bounce houses, mobile casino, DJ, **party bus** | event planner / parent |
| **Dumpster & Portable Restrooms** | roll-off dumpsters, portable toilets | contractor / site manager |
| **Equipment Rental** | skid steer, trailers, small plant | contractor / landscaper |

Party bus sits with **events**, not equipment — the buyer is the same person planning the party.

**Build order: the multi-day engine FIRST, then all three pages.** Chris's own constraint decides
this — *"we're not putting anything on the pages that isn't truthful."* Today:
- **Event & party** could honestly describe its core service now (per-item inventory shipped).
- **Dumpster / restroom and equipment CANNOT.** Their core service *is* multi-day hire, and
  `generateSlots` cannot offer it. A truthful page today would omit the main thing.

**The blocker, exactly.** `lib/availability.ts` → `generateSlots` builds slots strictly inside one
day: the inner loop requires `start + durationMs <= dayClose`, so **a bookable slot can never
cross a day boundary**. `book_slot()` already takes a `tstzrange`, so the database layer is
already capable — this is a slot-generation problem, not a schema one. `filterAvailable` is
overlap-based and duration-agnostic, so it should not need to change.

**This one build unlocks all three pages AND closes a real pilot risk:** a bounce house booked
Saturday 10:00 for 90 minutes currently reads as *free* at noon while it is physically at a party
until Sunday. Same root cause as the unbuilt seven-day dumpster hire.

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
  Consolidation saves **$2/month per client**. The voice path is proven, measured at 964ms p50, and
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
- **All 9 vertical templates + Northside run `claude-4.5-haiku`.** Like-for-like on the same agent
  and number:

  | | p50 | max | opening turns |
  |---|---|---|---|
  | `claude-4.6-sonnet` | 2399ms | 10098ms | 9714, 9676, 9511, 10098, 9962 |
  | **`claude-4.5-haiku`** | **964ms** | **1843ms** | 1274 |

  Revert: `node --env-file=.env.local scripts/retell/set-client-model.mjs --model claude-4.6-sonnet --apply`

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
   - **No UI reads or writes `client_inventory`.** `grep -rln client_inventory app components`
     returns nothing. A client cannot see their stock, fix a mistyped quantity, or take a torn
     bounce house out of service. The `active` column exists and is read live — it is simply
     unreachable. And once `questionnaireCompleted` is true the dashboard checklist drops its
     link, so there is no route back to the questionnaire either; only the 90-day emailed link.
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

### Lessons that each cost real time
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
- Every client agent runs `claude-4.5-haiku`, chosen by measurement. Ava's tech list says
  "Claude" without a model name on purpose — naming one goes stale the moment it changes.
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

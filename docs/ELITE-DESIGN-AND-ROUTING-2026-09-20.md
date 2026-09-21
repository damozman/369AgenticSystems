# Elite — Design Decisions and Routing Spec

Written 2026-09-20 by Cowork Claude (Opus) with Chris. Decisions are Chris's; the spec is input for VS.
Supersedes Report 4 of `docs/pre-stripe-status-2026-09-18.md`, which was input to this session, not a plan.

---

## 1. What Elite is

**Elite is the tier that scales.** Every feature in it is software that is built once and then costs
nothing per additional client. Nothing in Elite consumes Chris's time per client per month.

**Elite ($750/mo) = everything in Pro, plus:**
- Live Call Transfer with **per-vertical emergency routing** (this spec)
- **VIP pass-through** — the client's named callers go straight to them
- Call recording + searchable transcript archive *(exists)*
- Priority onboarding & dedicated support *(exists)*

### Decisions taken

**The monthly strategy call is OUT of the tier.** Not in `tier-config.ts`, not in the SOW, not on the
pricing page. Chris will do calls with early clients anyway — uncontracted, because at this stage
they are product research he would pay for, not a deliverable. The reasoning: the call is valuable
at 3 clients and ruinous at 30. Once it is written into a $750 tier it is a permanent obligation
that can only be removed by repricing existing clients, and it makes Chris's calendar — not the
infrastructure — the ceiling on the whole business. If demand proves real it becomes a **named
add-on with its own price**, set against data.

**The ops brief stays out** until it has a client-facing view and production tables. Today it is an
admin-only tool on test tables (`2026-07-30-ops-brief-test-tables.sql`); "bundled in" would mean
Chris running a spreadsheet by hand per client per month. Same objection as the call.

**Margin context** (at the post-September floor of ~$0.164/min):

| Tier | Price | Included min | Cost if fully used | Gross margin |
|---|---|---|---|---|
| Starter | $400 | 300 | $49 | 88% |
| Pro | $600 | 600 | $98 | 84% |
| Elite | $750 | 1,000 | $164 | 78% |

Infrastructure is not the constraint. Chris's time is the only input that does not scale, which is
why none of it is sold here.

---

## 2. The core rule: ask, don't pattern-match

**This is the heart of the spec. Read it before writing any prompt text.**

The instinct is to give the agent a keyword list — "burst pipe", "no heat", "gas". **Do not build
that.** A keyword list fails in both directions: a panicked caller says "this is an emergency"
about a slow drain, and a calm caller understates a genuinely burst pipe. Either way the owner's
phone rings wrong, and the failure that kills the feature is the over-ring: an owner who is woken
for routine calls stops answering, and then live transfer is worthless for every client.

Industry practice for after-hours answering services converges on a different mechanism — the
agent **asks two or three disqualifying questions** and decides from the answers:

> *"Is there active flooding occurring right now? Can you turn off the water to that fixture or the
> whole house?"*
> — [Contractor In Charge](https://contractorincharge.com/blog/how-to-handle-after-hours-calls-for-a-plumbing-company)

There is no formal standard — no certifying body, no published spec. The convention that recurs
across vendors is **active, unstoppable, or unsafe right now**, and the stated purpose of screening
is protecting the on-call person, so they are *"only woken up for high-priority, 'code red'
emergencies."* That is the same instinct as "do not over-transfer", arrived at independently.

### The rule, as it should read to the agent

> Before transferring, establish two things:
> 1. **Is it happening right now?** (not last week, not a worry about the future)
> 2. **Can the caller stop or contain it themselves?** (shut-off valve, breaker, moving the car)
>
> Transfer only if it is active **and** they cannot stop it — or if it is an immediate safety risk.
> Otherwise take the details and book. A caller who says "emergency" but describes something that
> can wait until morning gets booked, warmly and without argument.

This works for a vertical nobody wrote rules for, which the per-vertical lists below cannot.

**The lists in section 3 are calibration, not gates.** They exist to tune the judgment, the way
examples tune any prompt. They are not an allow-list to match against.

---

## 3. Per-vertical calibration

Drafted from the existing `lib/verticals/*.ts` prompts, which already carry emergency triage
language for HVAC, plumbing and legal. **Chris to red-line before build.**

Note what changes: today those configs tell the caller to *"call the emergency line directly."*
With transfer live, the agent connects them instead of deflecting. That is the product upgrade.

| Vertical | Transfers | Books instead |
|---|---|---|
| **Roofing** | Water actively entering the home now; open structure after a storm with weather coming; adjuster on the line with a time-sensitive question | Estimates, hail from last month, "is this covered", scheduling |
| **HVAC** | Smell of gas *(see 4.1)*; CO alarm sounding; no heat below ~35°F or no cooling above ~95°F, especially with an elderly, infant or medically vulnerable occupant mentioned; unit leaking into the property | Tune-ups, thermostat questions, quotes, noisy unit, filters |
| **Plumbing** | Burst pipe or uncontrolled water; sewage backing up indoors; no water to the property; water near electrical | Dripping faucet, slow drain, running toilet, remodel quotes |
| **Legal** | A stated deadline inside 72 hours (statute of limitations, filing, response, hearing); someone in custody now; served with papers today | Consultations, fee questions, case status, "thinking about a case" |
| **Real estate** | Offer deadline expiring today; a client under contract with an inspection or financing deadline today or tomorrow | "Is it still available", showings, valuations |
| **Insurance** | Loss happening now (fire, flood, accident just occurred); policy lapsing today; proof of insurance needed this hour for a closing or DMV | Quotes, renewals, coverage questions, billing |
| **SaaS** | Production outage affecting the caller's business; security incident | Trials, demos, pricing, features |
| **Wholesale** | Shipment error on a live order blocking the customer's own job; credit hold stopping a shipment today; must-ship-today deadline | Catalog, pricing, lead times, new accounts |
| **Rentals** (event / dumpster / equipment) | Equipment down on an active rental; delivery missing for an event happening today; blocked container stopping a job | Availability, quotes, bookings, pickup scheduling |

Dental is deliberately absent — it is waitlist-only. See `docs/EMAIL-BAA-DECISION-2026-09-18.md`.

---

## 4. Special cases

### 4.1 A possible gas leak is not a transfer

**Transferring is the wrong primary response.** A warm transfer rings for 30 seconds; a gas leak
does not wait for someone to pick up. The agent must first tell the caller to **leave the building
and call the gas company or 911 from outside**, and only then notify the owner.

This is the one case where connecting the owner is the secondary action. Write it as its own branch,
not as an entry in the emergency list.

### 4.2 "I want to talk to a real person"

The tool description today transfers when the caller *"explicitly asks to speak with a real
person"* or has a situation *"too complex to handle over the phone."* Both are too broad under the
rule above and are the most likely source of over-ringing.

**Recommended (Chris to confirm):** a request for a human is **not by itself** a transfer. The agent
offers to take details and have the owner call back, with a concrete timeframe. If the caller
insists a second time, take a message and state when they will be called — which is what a good
human receptionist does. Transfer only if the two-question test passes or the caller is on the VIP
list.

### 4.3 VIP pass-through

A VIP skips the test entirely — no triage questions, straight through. The point is the client's
best customer never gets screened.

Matching is on caller ID against a per-client list. A withheld or unrecognised number falls through
to the normal rule.

---

## 5. Explicitly out of scope for v1

- **Escalation routing** (a caller trying to cancel, an angry account). A real and probably valuable
  idea — in SaaS it may be the highest-value transfer there is — but it is a different judgment with
  a different failure mode, and bundling it doubles the tuning surface before there is a single
  client. Revisit when a client asks.
- **A business-hours schedule toggle.** During business hours the client's own office answers, so
  the transfer rarely fires; the value is after-hours. Leave transfer always-on and do not build
  schema for a problem nobody has reported.
- **Spanish, custom voice, multi-location** — decided OUT, 2026-09-18.
- **ROI report on Elite** — blocked on job-value capture; do not list until it sends.

---

## 5a. v1.1 — the missed-transfer path (Chris's idea, 2026-09-20, reframed)

**Not part of v1.** Recorded here so it is not lost, and deliberately not folded into a build that
has not started.

The gap it closes is real. Today an unanswered emergency transfer falls back to Ava taking details —
proven on a live call — but **nothing tells the owner it happened.** At 2am that is exactly the
call they would want to know about, and they find out whenever they next check email.

### 5a.1 Alert on the MISS, not on the transfer

Fire when a transfer was attempted, rang its 30 seconds, and nobody answered. **Do not fire on a
successful transfer** — the owner just spoke to the caller; a notification is noise, and noise is
what makes people stop reading alerts.

**Ship it as email first.** The Resend path already exists and costs nothing.
**Upgrade the same trigger to SMS when Twilio lands** — that is gated on A2P 10DLC registration for
`3SIX9 MEDIA MASTERS LLC` (days to weeks, ~$19/client, see `CLAUDE.md`), so it is not a switch that
can be flipped now. Chris's original idea was SMS; email is the same feature available today.

### 5a.2 Re-alert, do not survey

Chris also asked about Ava following up after the scheduled time to check whether the call was
made. **Recommend not building that as a question**, in either direction:

- Asking the **owner** "did you call them back?" builds an AI that nags the paying client.
- Asking the **caller** "did someone reach you?" surfaces a failure to the person most harmed by
  it, at the moment they are deciding whether to call a competitor — with no recovery attached.

**What the instinct is actually reaching for is a second alert**, which is the standard on-call
escalation ladder: missed emergency → wait 10–15 minutes → alert again → optionally a second
number. That fixes the problem rather than asking about it, and the second number is the natural
home for "fall through to the office manager".

### 5a.3 Log the outcome, always

Cheap, and worth doing whenever the build happens: record every emergency transfer with its outcome
— attempted / connected / missed. It gives the client a line in their monthly numbers reading
"4 emergencies, 4 connected", which is the only concrete evidence that Elite earns its $750. There
is no way to show that today.

Counts only. No dollar figure — the same rule that keeps the ROI cron unscheduled.

---

## 6. Build items

### 6.1 Per-vertical tool descriptions — API change

`buildTransferTool(ownerPhone)` in `lib/retell-transfer-tool.ts` takes only a phone today and
returns one hardcoded description. It needs the vertical, and optionally the client's own added
criteria:

`buildTransferTool(ownerPhone, vertical, extraCriteria?)`

Both callers pass it — `lib/retell-provisioning.ts:69` (vertical known at clone time) and
`lib/retell-transfer-sync.ts:103` (read it from the subscription row). Update
`lib/retell-transfer-tool.test.ts` (lines ~128, ~140) accordingly.

Keep the function **pure**. The decision logic is what silently does the wrong thing to a paying
client, and it is provable by unit test only while it stays free of Retell, the database and env.

The description should carry: the two-question rule, that vertical's calibration examples, the
"books instead" list, the gas branch where it applies, and the instruction to tell the caller
before connecting.

### 6.2 Client-added criteria

Defaults are the moat; the override is the pressure valve for a client whose business genuinely
differs. Collected at onboarding, appended to the description — never replacing the defaults.

### 6.3 VIP list

- New table, per client, of phone numbers with an optional label. Migration for Chris to apply.
- An editor in the client dashboard.
- A lookup at call start — an inbound-call webhook returning dynamic variables, so the agent knows
  before the first word whether this caller is a VIP.

### 6.4 Re-sync on change

Editing the VIP list or the criteria must re-push the tool to that client's agent. The mechanism
already exists: `syncTransferToolForClient`, proven against real Retell by
`scripts/verify-transfer-tool-sync.mjs`.

---

## 7. Copy implications

`tier-config.ts` already lists Live Call Transfer without `comingSoon` (2026-09-20). When routing
ships, the Elite line can say what it actually does — urgent calls reach the owner, routine calls
get booked — which is a better sentence than "transfers calls" and is the part competitors cannot
copy quickly.

**Do not publish the routing claim before the routing ships.** Copy and capability ship together.

The SOW (`docs/sales-ops/msa-sow-general.md`) states the standing condition: live transfer needs the
Client's forwarding number, and the feature is inactive until it is on file.

---

## 8. Verification before this is called done

1. Unit tests over the decision, per vertical: an active-and-unstoppable case transfers, a
   "they said emergency but it can wait" case books, a VIP passes through, a gas case takes the
   safety branch first.
2. `scripts/verify-transfer-tool-sync.mjs` extended to prove the per-vertical description actually
   lands on the agent.
3. **A real call per vertical is not required, but at least two are** — one that should transfer and
   one that should not. The over-ring failure only shows up on real calls, and it is the failure
   that kills the feature.

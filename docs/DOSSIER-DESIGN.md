# The Operational Dossier — design

**Status: design only. Nothing here is built.** Written 2026-08-20, revised after Chris's review.

## Why

Chris's goal, in his words: *give the prospect enough real information to make a decision without
a call, and still offer the call as their choice.* That is the right shape. For a $400/mo product,
requiring a 30-minute call before the buyer knows if it's worth 5 minutes is friction out of
proportion to the purchase.

Today the static intake form sends the prospect **nothing**. A real submission from EmpireTrak
(equipment-rental) confirmed it: the owner alert arrived, the prospect got silence.

> That submission is logged `2026-08-21T02:58:25Z`, which is **9:58 PM Central on Thursday
> 2026-08-20** — the evening it actually happened. **Not a typo.** The database stores UTC and
> Chris reads Central. A later session flagged the date as wrong and would have "corrected" it
> into disagreeing with the row. Same trap as the bare-`timestamp` bug that once told a customer
> their appointment was Wednesday when it was Thursday.

---

## 🔴 Blocker found during review: the intake captures almost nothing

`/api/intake` writes exactly six columns to `system_audits`:

```
client_domain · client_email · client_name · client_industry · payload_status · created_at
```

**Company name, pain point and volume are never stored.** They ride in the owner email and are
then gone. The route's own comment says so: *"`system_audits` has no column for company / pain /
service area either, so the full payload rides in this email … until a proper intake table
exists."*

**And average job value is not collected at all** — the ROI calculator asks for it, the intake
form does not.

So a dossier generator reading the database today would have a domain, an email and a name.
Nothing to reflect back, nothing to do arithmetic with. **Persisting the intake payload is step 0**
— everything else in this document depends on it.

---

## What this replaces, and the mistake we are not repeating

The Gumloop Dossier was a genuinely good read. Almost none of it was true.

`docs/reference/gumloop-prompts-archive.md` records the prompt verbatim:

> `security_score`: (integer, 0-100) Based on the business type, industry, and pain points
> provided, **estimate** a digital security posture score.

Nothing was fetched, scanned or measured. The model returned **41 for all 19 rows that had one** —
Delta Dental and a solo dentist scored identically. The email then told the recipient *"Our scan
flagged a security score of 41/100."* Those columns were nulled across all 22 rows on 2026-08-10.

The same document quoted "$144,000–$288,000 recoverable annual revenue" for a business it had never
measured, and described 3six9 Media Masters, a media company, as a roofing contractor.

**An emailed dossier is worse than a bad web page.** It is addressed to a named business, retained,
forwardable, and quotes dollar figures. That is a representation, not marketing copy.

### The governing rule

> **The model may write the prose. The model may never invent a number.**
>
> Every figure comes from one of exactly three places: something the prospect typed, something we
> measured, or arithmetic from `lib/roi.ts` with the assumption printed. If a fact fits none of
> those, it does not appear.

---

## Intake form changes

### Pain points → checkboxes, and drop "All of the above"

Today it is a single-choice `<select>` ending in *"All of the above"*, which is the option that
destroys the most information: someone who picks it has told you nothing about priority. Three of
five tells you what to lead with in their dossier.

**Checkboxes, not a multi-select dropdown** — multi-selects are miserable on a phone, and this form
is mostly read on phones.

Stored as an array. The dossier addresses each one they checked, in the order the form lists them.

### Add: average value

**Required, and the reason section 4 can exist at all.** Without it there is no arithmetic — just
volume, which on its own says nothing about money. The ROI calculator already asks for it; the
intake form should ask the same question in the same words per vertical:

| Vertical | Field label |
|---|---|
| Roofing / HVAC / Plumbing | Average job value ($) |
| Event & party rental | Average rental value ($) |
| Dumpster / restroom | Average hire value ($) |
| Equipment rental | Average rental ticket ($) |
| Real estate | Average commission ($) |
| Insurance | Average annual premium ($) |
| Wholesale | Average order value ($) |
| Legal | Average matter value ($) |

### Add: the disclosure

One line, near the submit button:

> *As part of your audit we place a test call to your published number.*

**It says that we will call. It does not say when.** Chris wants the timing spontaneous, and it can
be — the disclosure exists to remove the "why is this number calling me" problem and to keep the
legal posture clean, not to schedule anything. A form submitter who was told we would call is the
safe case that the bulk cold-call runner is deliberately blocked on; the timing was never the part
that mattered.

---

## What the prospect receives

### 1 · What you told us
Their volume, average value, the pain points they checked, and their website — reflected back.
Requires step 0.

### 2 · We called your line ← *the section that does the work*

`lib/audit-call.ts` is built and verified in production. `describeAuditCall()` turns a real call
into a sentence stating only what happened:

```
We called your main line at 8:41 PM on Tuesday. It went to voicemail.
```

Its two rules are already in the code and govern this section:

- **Only describe what the call establishes.** *"It went to voicemail"* is witnessed. *"They have
  poor call handling"* is an inference from one call at one time — not earned.
- **Our failures are never findings about them.** Retell fails, number undialable, carrier blocks
  it → `reportable: false`, section **omitted entirely**. Never softened into "we couldn't reach
  you."

**Two calls — one in business hours, one late evening.** This is the strongest artifact available,
because it isolates the problem instead of merely asserting it:

> *We called at 10:32 AM — someone picked up. We called again at 8:41 PM — it went to voicemail.*

That is the entire pitch, proven on their own line, with no industry average anywhere near it.

**If they answer both times, the dossier says so.** The document must be able to tell a prospect
they did well; one that only ever finds fault is a sales script and reads like one. The argument
then moves to the hours we did not call, honestly labelled as untested.

### 3 · What happens on the call — Ava speaks

**A dedicated audit agent is required and does not exist yet.** `lib/audit-call-dial.ts` falls back
to `RETELL_AGENT_ID` — the shared demo agent — when `RETELL_AUDIT_AGENT_ID` is unset. That agent
would greet a prospect as *their own* receptionist, which would be bizarre and damaging.

**She must speak when a human answers.** A silent hangup is indistinguishable from a robocall, and
this is someone who just asked us for an audit. Texas TRAIGA also requires the AI disclosure.

Draft script — short, disclosing, and it ends the call rather than selling:

> "Hi — this is Ava, an AI assistant with 369 Agentic Systems. You asked us for a system audit a
> little earlier, and part of that is a quick test call to your published line. Someone answered,
> which is exactly what we were checking — nothing else is needed. Your results are on the way by
> email. Thanks for your time."

**Voicemail:** leave a shortened version. Honest, and it is a second touch at no extra cost.

**Classification never depends on what she heard.** `describeAuditCall()` classifies from Retell's
`disconnection_reason` only — mechanical, not interpretive. The transcript is ASR and this repo
already carries the lesson that call quality must never be diagnosed from a transcript.

### 4 · What we found on your website
Real, automated, verifiable by the reader in ten seconds each: phone published and tap-to-call,
contact form present, hours published, any after-hours affordance, mobile viewport, page weight.
**Observations, never scores.** No 0–100 of anything — a score is what got us here.

### 5 · The arithmetic on your numbers
Their volume × their average value × `RECOVERY_RATE` from [lib/roi.ts](../lib/roi.ts), with the
assumption printed exactly as the on-page calculators do. No industry averages.

### 6 · What the system does, and their choice
Truthful capability only. Then three next steps in the order that respects their time: **call the
demo line** (817) 635-0220 · **deploy now** · **book a 30-min call**.

---

## Scheduling — the two-part send

Chris asked the right question: if it arrives at 10 AM and the persuasive call is at 8 PM, does the
dossier wait? **No.** A prospect who hears nothing for ten hours has already moved on.

**Submitted in the morning:**

| Time | Event |
|---|---|
| 10:00 | Form submitted |
| ~10:30 | Business-hours call |
| ~11:00 | **Dossier sent** — their numbers, website findings, arithmetic, call #1, CTAs |
| ~20:40 | Late-evening call |
| next 08:00 | **Short follow-up** — the comparison, and the recording if approved |

**Submitted in the evening:** the order flips — late-evening call first, dossier that night,
business-hours call next morning, follow-up after it. The sequence adapts; the shape does not.

The follow-up is not padding. It is a legitimate second touch carrying the single most persuasive
line in the whole process, and it arrives the morning after they read the first one.

---

## Where every number comes from

| Field | Source | Invented? |
|---|---|---|
| Company, contact, website, volume, average value, pain points | Their form (requires step 0) | No |
| "We called at X, it did Y" — both calls | Real Retell calls via `lib/audit-call.ts` | No |
| Website observations | Live fetch at generation time | No |
| Monthly / annual recoverable | Their numbers × `RECOVERY_RATE`, assumption shown | No |
| Recommended tier | `lib/tier-config.ts` against their volume | No |
| Scores, benchmarks, projections | — | **Cut** |

---

## Decisions made (Chris, 2026-08-20)

1. **Timing — late evening, spontaneous.** Disclose *that* we call, never *when*.
2. **Two calls** — business hours and late evening. The comparison is the point.
3. **Attach the recording — but only after human review.** Chris asked whether AI could verify what
   it heard instead. **It cannot.** `disconnection_reason` is mechanical and reliable, which is why
   classification uses it; a recording's *content* is not something to vouch for automatically.
   Review stands.
4. **Owner approval gate on, for now.** Chris approves each dossier until confident.
   ⚠️ **An approval queue nobody clears is where this dies.** It needs a daily nudge and a visible
   count, and a revisit once twenty have gone out clean.

---

## Deliberately not included

Any score · industry benchmarks, including true-but-unsourced ones · revenue projections beyond
their own inputs · claims about competitors · anything SMS until A2P clears · **dental and SaaS**,
until there is something to sell.

---

---

## 🔴 Separate product gap, logged here 2026-08-20: Nova has no rental verticals

Found during the copy pass on `feat/rental-vertical-pages`. **This is not a copy problem and it is
not fixed on that branch** — the copy was softened, the product gap stands.

`lib/nova-templates.ts:13` defines `NovaVertical` as exactly the original nine. Line 78 is:

```ts
const vc = VERTICAL_COPY[input.vertical] ?? VERTICAL_COPY.roofing
```

A vertical outside the nine **silently falls back to roofing**, and roofing's `visitNoun` is
`'inspection'`. So a party-rental client's booking confirmation would tell their customer to
prepare for an **inspection**, and Nova's system prompt would introduce her as writing "for a
roofing company."

**Why this is urgent rather than theoretical:** the pilot is the cousin's **entertainment
business** — an event-rental company — and the chamber event is ~mid-September 2026. She cannot be
provisioned under `event-rentals` (no template agent) so she will be provisioned under one of the
nine, which means she hits this fallback on her first confirmed booking. The failure is silent and
customer-facing: nothing errors, the email simply describes the wrong business.

**The fix is not just adding three keys.** The `?? VERTICAL_COPY.roofing` fallback is the actual
defect — it converts an unknown vertical into a confidently wrong email instead of a refusal. Same
shape as the inventory-matching rule this repo already settled: *refuse rather than guess.* An
unknown vertical should raise, exactly as an unknown inventory key does.

Do this before the pilot takes a real booking, not as part of the dossier.

---

## Build order

0. **Persist the intake payload.** Company, pain points, volume, average value. Nothing works
   without it.
1. **Wire the static intake form to the existing `/api/send-roi-report`.** It already emails the
   prospect a personalised report and copies the owner — it is simply wired only to the Next.js ROI
   calculator today. Closes the silence immediately, no new machinery.
2. Intake form changes — checkboxes, average value, disclosure.
3. Website measurement module — pure function over a fetched page, easy to test.
4. Dossier renderer, six sections, per-vertical config.
5. **Dedicated audit agent** with the script above, then the two-call schedule.
6. Approval queue + send.
7. Delete `lib/email-templates.ts` — its `dossierHtml` is the Gumloop template being replaced.

---

## Per-vertical content plan

Structure is identical everywhere; four things change. Lift the noun and scenario from each
`-leads` page rather than rewriting, so the dossier and the landing page agree.

| Vertical | Unit lost | Scenario the call proves | Capability that matters most |
|---|---|---|---|
| Roofing | a job | Storm surge, crews on roofs | Capacity via `max_concurrent_per_slot` |
| HVAC | a job | 2 a.m. no-heat call | 24/7 answering |
| Plumbing | a job | Burst pipe at midnight | 24/7 answering |
| Event & party rental | a booking | Saturday call mid-setup | Per-item availability, multi-day hire |
| Dumpster / restroom | a hire | Site manager needs one tomorrow | Multi-day hire held end to end |
| Equipment rental | a rental | Contractor calling before the yard opens | Per-machine availability |
| Real estate | a client | Buyer contacts three agents | Speed to lead |
| Insurance | a policy | Quote shopper calls the next agency | Speed to lead |
| Wholesale | an order | Reorder call at 6 p.m. | Order intake + ops-brief import |
| Legal | a case | Enquiry while in court | Felix conflict check |
| Dental / SaaS | — | — | **Excluded** |

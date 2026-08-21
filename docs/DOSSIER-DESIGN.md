# The Operational Dossier — design

**Status: design only. Nothing here is built.** Written 2026-08-20 for Chris to read and edit
before any code exists.

## Why

Chris's goal, in his words: *give the prospect enough real information to make a decision without
a call, and still offer the call as their choice.* That is the right shape. For a $400/mo product,
requiring a 30-minute call before the buyer knows if it's worth 5 minutes is friction out of
proportion to the purchase.

Today the static intake form sends the prospect **nothing**. `/api/intake` writes a
`system_audits` row and emails the owner. A real submission on 2026-08-21 (EmpireTrak,
equipment-rental) confirmed it: the owner alert arrived, the prospect got silence.

## What this replaces, and the mistake we are not repeating

The Gumloop Dossier was a genuinely good read. Almost none of it was true.

`docs/reference/gumloop-prompts-archive.md` records the prompt verbatim:

> `security_score`: (integer, 0-100) Based on the business type, industry, and pain points
> provided, **estimate** a digital security posture score.

Nothing was fetched, scanned or measured. The model returned **41 for all 19 rows that had one** —
Delta Dental and a solo dentist scored identically, so the number said nothing about anyone. The
email then told the recipient *"Our scan flagged a security score of 41/100."* Those columns were
nulled across all 22 rows on 2026-08-10.

The same document asserted "$12,000 average job value", "$96,000 monthly pipeline erosion" and
"$144,000–$288,000 recoverable annual revenue" for a business it had never measured — and
described 3six9 Media Masters, a media company, as a roofing contractor.

**An emailed dossier is worse than a bad web page.** It is addressed to a named business,
retained, forwardable, and quotes dollar figures. That is a representation, not marketing copy.

### The governing rule

> **The model may write the prose. The model may never invent a number.**
>
> Every figure in the document comes from one of exactly three places: something the prospect
> typed, something we measured, or arithmetic from `lib/roi.ts` with the assumption printed on the
> page. If a fact fits none of those, it does not appear.

`lib/audit-call.ts` already encodes this discipline and should be read before building anything
here — it is the model for the whole document.

---

## What the prospect receives

Six sections. Every one is either their own data, a measurement, or stated arithmetic.

### 1 · What you told us

Their volume, pain point, current setup and website, reflected back. Zero cost, entirely true, and
it signals a human read the form.

### 2 · We called your line ← *the section that does the work*

`lib/audit-call.ts` is built and verified in production. It places a real call to their published
number and turns the result into a sentence stating only what happened:

```
We called your main line at 7:42 PM on Tuesday. It went to voicemail.
```

`describeAuditCall()` produces that sentence. Its two rules are already in the code and govern
this section:

- **Only describe what the call establishes.** "It rang out to voicemail" is witnessed. "They have
  poor call handling" is an inference from one call at one time — not earned.
- **Our failures are never findings about them.** If Retell fails, the number is undialable, or the
  carrier blocks it, the result is `reportable: false` and the section is **omitted entirely**. It
  is never softened into "we couldn't reach you."

**If they answer, we say so.** `answered_human` produces *"Someone picked up."* The dossier must be
able to tell a prospect they did well — a document that only ever finds fault is a sales script,
and buyers can smell it. When the line is answered, this section becomes the honest observation
that they are covered during the hours we happened to call, and the argument moves to the hours we
did not.

**Consent:** the intake form must say we will call the published number as part of the audit. It
removes the surprise and makes the call something they asked for. This is also what separates it
from the bulk cold-call runner, which is unbuilt on purpose for exactly that reason.

### 3 · What we found on your website

Automated, real, and verifiable by the reader in ten seconds each:

| Check | Why it matters |
|---|---|
| Phone number published, tap-to-call on mobile | A number that isn't tappable loses mobile callers |
| Contact form present | The only path when the phone isn't answered |
| Business hours published | Tells a visitor whether calling now is pointless |
| Any after-hours affordance | Chat, callback request, anything at all |
| Page weight / mobile viewport | A slow site on a phone loses the click before the call |

**Reported as observations, never as scores.** No 0–100, no grades, no "posture". A score is what
got us here.

### 4 · The arithmetic on your numbers

Their inputs through `RECOVERY_RATE` from [lib/roi.ts](../lib/roi.ts), with the assumption printed
exactly as the on-page calculators do: *"Assumes 30% of missed calls convert once answered — a
conservative rate."* No industry averages. Every input is a number they typed.

### 5 · What the system does about it

Truthful capability only — 24/7 answering, qualification, calendar-checked booking that cannot
double-book, confirmations, email follow-up. Per-item availability where the vertical uses it.
**No SMS, quoting, deposits or waivers** until those exist.

### 6 · Their choice of next step

Three, in the order that respects their time:

1. **Call the demo line** — (817) 635-0220. Strongest CTA on the site: hear the product answer.
2. **Deploy now** — straight to the vertical's pricing.
3. **Book a 30-min call** — offered, never required.

---

## Where every number comes from

The table that keeps this honest. If a field cannot be traced to a row here, it is cut.

| Field | Source | Invented? |
|---|---|---|
| Company, contact, website, volume, pain point | Their form submission | No |
| "We called your line at X, it did Y" | Real Retell call via `lib/audit-call.ts` | No |
| Website observations | Live fetch of their URL at generation time | No |
| Monthly / annual recoverable | Their numbers × `RECOVERY_RATE`, assumption shown | No |
| Recommended tier | `lib/tier-config.ts` against their volume | No |
| Everything the old Dossier called a "score" | — | **Cut** |
| Industry averages, benchmarks, "21x more likely" | — | **Cut** |
| 90-day and annual projections | — | **Cut** |

---

## The pipeline

```
Prospect submits intake  →  /api/intake  (writes system_audits, alerts owner)   [exists]
                              ↓
                         queue dossier job                                       [new]
                              ↓
   ┌──────────────────────────┼──────────────────────────┐
   ↓                          ↓                          ↓
fetch their website     place audit call            ROI arithmetic
  [new, ~1s]            [exists: /api/audit/call]   [exists: lib/roi.ts]
   ↓                          ↓                          ↓
   └──────────────────────────┼──────────────────────────┘
                              ↓
              render per-vertical dossier HTML                                   [new]
                              ↓
                  send to prospect + copy to owner                               [pattern exists]
```

**Most of the hard parts exist.** `/api/send-roi-report` already emails a personalised report to
the prospect and copies the owner — it is simply wired only to the Next.js ROI calculator, not to
the static `-leads` intake form that the ads point at. That is the fastest available win and
should ship first, ahead of everything else here.

**Do not start from `lib/email-templates.ts`.** Its `dossierHtml` is the Gumloop template — dead
code, and the thing being replaced. Delete it in the same pass.

### Timing

The audit call is the reason to wait. Sending instantly means no call result; waiting for
after-hours means the strongest section. Proposal: **send within 15 minutes** with the sections we
have, and only delay when the submission arrives close enough to after-hours that the call is worth
waiting for. A prospect who hears nothing for six hours has already moved on.

---

## Per-vertical content plan

The structure is identical everywhere. Four things change per vertical:

| Vertical | Unit lost | The scenario the call proves | Capability that matters most |
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
| Dental | — | — | **Excluded — waitlist only, no live agent** |
| SaaS | — | — | **Excluded — Scout not built** |

The noun and scenario already exist as copy on each `-leads` page and should be lifted from there
rather than rewritten, so the dossier and the landing page say the same thing.

---

## Deliberately not included

- **Any score.** Security, SEO, "posture", 0–100 of anything.
- **Industry benchmarks**, including true-but-unsourced ones. If we cannot cite it, it is out.
- **Revenue projections** beyond their own inputs through a stated rate.
- **Claims about their competitors.**
- **SMS anything** until A2P clears.
- **Dental and SaaS**, until there is something to sell.

---

## Open decisions

1. **Time of day for the audit call.** After-hours is the most persuasive and the most likely to be
   read as intrusive. Business hours is safer and often proves nothing. My recommendation:
   after-hours, disclosed on the form.
2. **One call or two?** One after-hours call proves the gap. A second during business hours proves
   it is specifically an after-hours problem — twice the cost, considerably stronger.
3. **Attach the recording?** A link is more persuasive than a sentence. It is also their own
   voicemail greeting being sent back to them, which some will find confronting.
4. **Owner review gate.** Fully automatic, or does Chris approve each dossier before it sends?
   Recommendation: **auto-send for the first version**, because a human gate makes the whole thing
   worthless at volume — but log every send and read the first twenty.

## Build order

1. **Wire the static intake form to the existing `/api/send-roi-report`.** Ships today, closes the
   silence, no new machinery.
2. Website measurement module — pure function over a fetched page, easy to test.
3. Dossier renderer with the six sections, per-vertical config.
4. Audit call into the flow, behind the disclosure on the form.
5. Delete `lib/email-templates.ts`.

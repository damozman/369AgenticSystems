# 369 AGENTIC SYSTEMS — PHASE 2 ROADMAP
## Planning Reference Only — Not a Build-Now List
**v2 — 2026-07-16. Revised after VS Claude review + Chris's clarification on framing.**

> Nothing here should be built before the current launch (Starter/Pro/Elite, 8 promoted verticals, automated provisioning) has run against real clients long enough to tell us which of these actually matters. Real client questions should re-rank this list, not competitor-watching.

> **Framing correction from v1:** Everything below is either a **standalone paid add-on**, a **quiet value-add folded into an existing tier**, or a **genuinely new service line** — not a change to the core Ava/Rex/Nova product that's already live and working. The core product doesn't change. These are things clients pay more for, on top of what exists.

---

## THE SHELF ALREADY EXISTS

`lib/tier-config.ts` already defines `PREMIUM_ADDONS` — Live Call Transfer, Branded Caller ID, Spanish Support, Custom Voice, HIPAA Pack. This is dead code today (defined, never rendered in the pricing UI). This is the natural home for most of what's below. The business model — core product + a la carte add-ons — is already architected. It just isn't stocked or turned on yet.

---

## CATEGORY 1 — STANDALONE PAID ADD-ONS
*Sold on top of Starter/Pro/Elite. Client opts in and pays more. Core product unaffected if they don't.*

### Quinn — Quoting Agent
**What it is:** Takes job details Ava already captures and generates a preliminary quote/estimate using the client's own pricing data (labor rates, material costs, markup rules).

**Why an add-on, not a tier feature:** Quoting agents are validated in the market as something businesses will pay a premium for specifically — it's a distinct, demoable capability, not a quality improvement to something they already have. Sell it as its own line item.

**Sequencing note:** Requires its own, separate onboarding step for pricing data — see "Progressive setup" note below. Don't expand the core 5-minute setup form to capture this.

**Best fit:** Roofing, HVAC, plumbing (job-based pricing).

---

### Missed-Call Text-Back
**What it is:** If a call goes unanswered even briefly, an automatic SMS fires: "Sorry we missed you, someone will call you right back."

**Why an add-on candidate:** Small, cheap, easy to demo as its own thing once Twilio exists. Could also be folded free into Pro/Elite as a value-add — Chris's call once Twilio is live and the actual build cost is known.

**Blocked on:** Twilio (see Category 3).

---

### Review & Reputation Management
**What it is:** Automatic review request (text/email) after a completed job, plus AI-drafted responses to incoming reviews for the owner to approve.

**Why this is the strongest new-service candidate on the list:** This is genuinely sellable as its own thing, potentially even to businesses who never buy the receptionist product at all. Worth considering as a distinct product line down the road ("369 Reputation"), not just an add-on to the AOS.

**Blocked on:** Twilio, for the request step.

**Best fit:** Home services, dental (once launched), legal.

---

## CATEGORY 2 — QUIET TIER VALUE-ADDS
*Improve an existing tier without a new SKU or new charge. Retention/differentiation plays, not new revenue lines.*

### Repeat-Caller Memory
**What it is:** Cross-reference caller ID against `calls`/`leads`. If it's a repeat caller, Ava has prior context.

**Why a value-add, not a paid add-on:** This is a quality improvement to the core Ava experience, not a distinct sellable capability. Folds into existing tiers.

**UX note (from VS Claude review):** Don't have Ava state remembered context as a confident fact ("I see you called about the leak last month") — a different person in the same household might answer. Have her ask a light confirming question instead ("Is this about the plumbing issue from last month, or something new?"). Same data, graceful failure mode instead of an awkward one.

---

### Knowledge Base Depth
**What it is:** Deeper business data beyond the current onboarding basics — pricing structure, service area boundaries, travel fees, expanded FAQ library.

**Why a value-add, not itself sellable:** This is enabling infrastructure for Quinn and a deepening of the existing Elite "Custom Business Intelligence" feature — not something a client would buy on its own.

**Critical sequencing flag (from VS Claude review):** Do NOT expand the core onboarding form to capture this. The current 5-minute setup promise is real, measured funnel copy (it's the CTA on the post-payment page) and does real work getting a nervous first-time buyer through setup without second-guessing the purchase. Build this as **progressive capture** — an optional second step pitched after core setup is done: *"Want Ava to quote jobs automatically? Add your pricing — 10 minutes, optional, anytime."* Framed as an upgrade path into Quinn, not a bigger version of the required setup.

---

### Client-Facing ROI Reporting
**What it is:** A monthly one-pager — calls answered, leads captured, revenue protected — something a client can forward to a business partner.

**Why a value-add:** Pure retention lever, reuses existing weekly digest infrastructure. Not something a client pays extra for; something that makes them less likely to cancel.

---

## CATEGORY 3 — INFRASTRUCTURE UNLOCK (Do This Before Anything Blocked On It)

### Twilio
**Not a feature — a standalone priority.** Currently blocking three separately-valuable items: Missed-Call Text-Back, Review Requests, and the already-promised Pro-tier SMS follow-up. One infrastructure decision unlocks all three. Treat as its own line item, not something that rides along with any single feature above it.

---

## CATEGORY 4 — INTERNAL OPS (Not Customer-Facing, Serves the "Runs Without the Founder" Goal)

### Founder-Facing Real-Time Alerts
**What it is:** Clients already get pinged instantly when a lead or booking comes in. There's no equivalent for Chris — churn risk and new signups currently only surface by manually opening `/admin`.

**Why it matters:** Cheap (same infrastructure as the weekly digest and existing admin dashboard queries), and directly supports the Part B goal of a business that doesn't require constant manual checking.

---

## CATEGORY 5 — NOT PURSUING

### Outbound Speed-to-Lead — Tabled
**Original idea:** AI calls a web-form lead within seconds of submission, instead of waiting for the lead to call in.

**Why it's off the list, not just deprioritized:** Outbound AI calling to a consumer is a fundamentally different legal risk category than everything else here — TCPA violations carry statutory damages per call, not per incident. Everything else in this document is "build it, ship it, learn from feedback." This one would require legal review of the actual calling/texting flow *before* a single line of code, as its own gate — not a checklist item alongside a feature build. Chris's call: not worth the risk right now. If ever revisited, it needs dedicated legal counsel first, not an engineering sprint.

### Native CRM / Calendar Push — Wait for a Named Request
Don't build speculatively. If a real client names their specific CRM (Jobber, ServiceTitan, Follow Up Boss), scope it then — possibly as a billed custom integration for that client rather than a general product feature.

---

## Suggested Re-Prioritization Trigger

Don't execute this list in the order written. After 2-3 weeks of real clients running live, let their actual questions and complaints re-rank it. That said — per VS Claude's review — hold this loosely in one direction only: these items were chosen because they're logical extensions of infrastructure already built and verified (Quinn extends Nova's existing Claude-generation pattern; repeat-caller memory extends existing tables), not because a competitor has them. The competitor research confirmed the direction was sound; it wasn't the reason for the direction. Some of these are worth having *ready* before a client asks, not built reactively after every single request.

---

## PART B — BUSINESS STRUCTURE & EXIT STRATEGY

### Two different businesses, don't build both at once

| | **What's being built now** | **A future "platform" pivot** |
|---|---|---|
| What it is | A managed service — Chris personally sells, onboards, and supports each end-business client | A self-serve platform other agency operators would license to run their own version of 369 |
| Revenue | MRR from roofers, HVAC companies, dental practices, etc. | Licensing/subscription revenue from other operators |
| Typical buyer at exit | Agency roll-up buyers, private equity acquiring service businesses | Software acquirers, PE software platforms, strategic acquirers |
| Typical multiple | Service/agency multiples (lower, but real and provable today) | SaaS multiples — wide range, see below |

### The real numbers on SaaS multiples (July 2026 data)

- Micro-SaaS under $1M ARR: 2.5-4x ARR
- Bootstrapped $1-5M ARR: 4-6x ARR
- Public SaaS median: 3.4x revenue
- AI-native platforms (AI as the core product, not a feature): 25-30x — this tier applies to infrastructure/foundation-model-adjacent companies, not managed AI services businesses. Be skeptical of anyone implying 369 is on this trajectory without an actual product pivot.
- **Vertical SaaS commands a premium over horizontal SaaS at the same ARR** due to higher retention and lower competitive intensity — this is the one data point that's a genuine asset for 369's 9-vertical structure, if the platform is ever productized.

### What determines the eventual multiple, regardless of which path is chosen

1. **Net revenue retention.** Sub-95% NRR caps valuation badly; 110%+ is considered the "platform threshold" by buyers. Churn is the whole game. Track it from client #1.
2. **Clean, provable financials.** MRR, churn, CAC, LTV — start tracking these numbers from day one, even informally in a spreadsheet.
3. **A business that runs without the founder.** Document the sales script, onboarding checklist, and support playbook as they're built, not retroactively. The founder-facing alert system (Category 4 above) is a small, concrete step toward this.

### A future moat worth tracking now, building later

**Aggregate benchmarking.** Once there are real transcripts and outcomes across many roofing clients specifically, "roofing companies on 369 book at X% vs. industry average" becomes a genuinely defensible, hard-to-replicate asset — exactly the kind of data moat that supports a vertical-SaaS premium if a platform pivot is ever pursued. This is a data-accumulation strategy that starts the moment clients go live, not a build — worth being deliberate about capturing clean, comparable data across clients from day one so the option exists later, even if it's never acted on.

### What to actually do now (near-term, doesn't cost build time)

- Track MRR, churn, and per-client acquisition cost in a simple spreadsheet starting with client #1.
- Keep client configuration (prompts, pricing, vertical templates) as clean, portable data rather than hardcoded logic — already mostly true given the questionnaire-driven personalization and Claude-generated Nova templates. Worth protecting as a default going forward.
- Write down the sales call script and onboarding steps as living documents.

### The platform-licensing option, if ever pursued (12-24 month decision, not now)

Would require: self-serve signup with zero human intervention (partially true already — the Stripe → Retell automated provisioning is a real head start), a partner/operator admin layer distinct from the current client dashboard, sub-account billing, documentation and support tooling built for operators who aren't Chris, and formal compliance work (SOC 2 is commonly expected by buyers of this kind of platform).

**Explicitly not a near-term priority.** The fastest way to learn what a platform version would need is to keep running the service business and let real operational friction reveal it.

---

## Summary

Everything in Part A is additive — new add-ons, new service lines, or quiet quality improvements to a core product that isn't changing. Outbound calling is off the table for legal risk. Nothing here should be built before real client data exists to re-rank it, except Twilio, which unlocks three other items and is worth doing on its own timeline whenever convenient.

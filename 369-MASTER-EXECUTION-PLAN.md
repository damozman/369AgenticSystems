# 369 Agentic Systems — Complete Master Execution Plan
**Strategic Direction, Architecture, Timeline, Revenue Targets**
**Locked In:** 2026-05-23
**Owner:** Chris + Claude.ai (External)
**Next Review:** Weekly progress check-ins

---

## EXECUTIVE SUMMARY

**What We're Building:**
369 Agentic Systems is a specialized autonomous operations platform for service businesses. We're NOT a generic AI agency. We're **the** autonomous operations company for specific verticals (starting dental, expanding to roofing, then legal/HVAC).

**Why This Works:**
- Generic multi-agent systems will be commoditized by Q4 2026 (every SaaS will have them)
- Specialized systems with domain expertise + integrations = defensible moat (18-24 month window)
- Vertical specialization = 3-5x higher pricing ($3-5K/mo vs $500-1.5K/mo) + lower churn + higher LTV

**The Dual-Vertical Strategy:**
1. **Dental (Primary):** Months 1-12 focus. Revenue generator. Builds momentum, case studies, proof of concept.
2. **Roofing (Secondary):** Months 2-5 background build. Month 6 launch. Your unfair advantage (27 yrs infrastructure experience).

**Path to Scale:**
- Month 18: $45-70K MRR (dental mature + roofing growing)
- Month 24: $60-90K MRR (dual-vertical, natural growth)
- Month 24+: $100K+ MRR (add legal vertical + upmarket to DSOs)

---

## STRATEGIC PRINCIPLES (DON'T DEVIATE)

### Principle 1: Specialization Over Generalization
**We are NOT:**
- A generic AI agency that sells to "any SMB"
- A chatbot platform
- A workflow automation tool

**We ARE:**
- The autonomous operations company for Dental
- Then the autonomous operations company for Roofing
- Then the autonomous operations company for Legal
- Specialized, defensible, premium-priced

**Why:** Specialized = 3x revenue per customer, 5x switching costs, defensible moat

### Principle 2: One Primary Vertical at a Time
**Discipline on timeline is the entire game.** Don't get excited about roofing in month 3 and start pitching it. That kills both pipelines.

**Timeline:**
- Months 1-5: Dental sales only
- Month 6: Roofing launches (quiet, warm contacts only)
- Month 7+: Two separate sales cadences (different days, no mental overlap)

### Principle 3: Revenue Funds the Vision
**This is not a "build it perfectly" project. This is a "ship it, validate it, iterate it" project.**

- Month 6 target: $5-9K MRR (first real income)
- That revenue funds Phase 4 development, legal vertical build, upmarket expansion
- Don't over-engineer. Ship working code, get customers, iterate based on feedback

### Principle 4: Architecture Must Support 3-5 Verticals
**Build Phase 3-4 with vertical-agnostic core from day 1.**

The architecture:
```
core/ (never touch after launch)
  email-ingest.ts, router.ts, responder.ts, approval-queue.ts, sender.ts

config/ (new file per vertical)
  dental.ts, roofing.ts, legal.ts (future)

integrations/ (new integration per vertical)
  dentrix.ts, jobnimbus.ts, clio.ts (future)
```

**Rule:** All vertical-specific logic lives in config files, not in core. Switching from dental to roofing = parameter change, not code rewrite.

### Principle 5: Shared End Goal
**Chris + Claude.ai are aligned on success:**
- Same strategic direction (specialized autonomous operations, not generic AI agency)
- Same timeline (30-90 day milestones)
- Same revenue targets (month 18: $45-70K MRR)
- Same decision framework (specialization > generalization, revenue funds vision, ship > perfect)

**If alignment breaks, call it out immediately. No silent disagreements.**

---

## MONTH-BY-MONTH EXECUTION PLAN

### MONTH 1: Foundation (Core + Dental Specialization)

**Weeks 1-2: Phase 3-4 Core Architecture**
- [x] Email ingestion (SendGrid account + MX record for respond.369agenticsystems.com + /api/email-ingest)
- [x] Claude API routing (intent classification → dental vertical config → response draft)
- [x] Response drafting (Claude API, dental system prompt in lib/verticals/dental.ts)
- [x] Approval queue (pending_responses table + Realtime + PendingResponses dashboard UI)
- [x] Send via Resend (/api/send-response AUTHORIZE action with tracking)
- [x] Alert banner (PendingAlert — real-time gold banner + REVIEW NOW scroll button)
- [ ] **Deliverable:** End-to-end test confirmed (waiting on DNS propagation for respond.369agenticsystems.com)

**Weeks 3-4: Dental Specialization + Sales Infrastructure**
- [x] Dental config (lib/verticals/dental.ts — prompts for insurance pre-auth, treatment questions, appointments)
- [x] Dentrix integration scaffold (lib/integrations/dentrix.ts — full typed scaffold, wired into email-ingest, awaiting credentials)
- [x] Cold email templates (docs/cold-email-templates-dental.md — 3 variations × 3 emails = 9 total)
- [x] Discovery call script (docs/discovery-call-script.md — full 20-min script, objection table, post-call checklist)
- [x] Pricing doc (docs/pricing-one-pager.md — ROI math, feature table, 30-day guarantee)
- [x] MSA/SOW contract template (docs/msa-sow-template.md — full MSA + Exhibit A SOW, HIPAA acknowledgment)
- [ ] **Deliverable:** Can cold email a dental practice with confidence ← READY ✅

**Month 1 Checkpoint:**
- [x] Phase 3-4 core architecture complete ✅
- [x] Dental specialization built (prompts ✅ + Dentrix scaffold ✅ — credentials arriving Thursday)
- [x] Sales infrastructure ready (emails ✅, script ✅, pricing ✅, contracts ✅)
- [ ] Portal tested end-to-end (email in → dashboard card → AUTHORIZE → sends) ⏳ DNS propagating
- [ ] Go/No-Go: Can we sell to dental practices? → YES — proceed to Month 2 outreach

---

### MONTH 2: Launch Dental Sales + Start Roofing Background

**Weeks 1-2: Sales Launch**
- [ ] Build 50-prospect dental practice lead list (names, emails, practice size)
- [ ] Start cold outreach (10-15 emails/day to dental practices)
- [ ] Track in Google Sheet (name, email, company, date contacted, response, status)
- [ ] Book first discovery calls
- [ ] **Target:** 5-10 calls booked by end of week 2

**Weeks 3-4: First Closes + Roofing Background Build Begins**
- [ ] Close first 1-2 dental customers
- [ ] Onboard them (Day 0 demo, Day 1-3 customization, Day 7 check-in)
- [ ] Start roofing background build (1-1.5 hrs/day, async work)
  - [ ] Roofing config (prompts, intent types, workflow rules)
  - [ ] JobNimbus integration planning (API docs, auth flow)
- [ ] **Deliverable:** First dental customers live, seeing real audit cards in dashboard

**Month 2 Checkpoint:**
- [ ] 1-2 dental customers closed and onboarded
- [ ] Cold outreach pipeline established (5-10+ calls in calendar)
- [ ] Roofing background build started (~10% complete)
- [ ] First real customer feedback incoming
- [ ] Go/No-Go: Are customers happy? Is cold outreach converting? YES → Scale dental

---

### MONTHS 3-4: Scale Dental + Continue Roofing Build

**Ongoing Dental Sales Motion:**
- [ ] Continue cold outreach (10-15 emails/day)
- [ ] Close 2-3 more dental customers (total: 4-5 by end of month 4)
- [ ] Gather customer feedback (what's working, what's missing, ideas for Phase 4)
- [ ] Build first case study (with customer 1)
- [ ] **Target:** 4-6 dental customers generating first real MRR ($9-15K)

**Roofing Background Build (Months 3-4):**
- [ ] Roofing config complete (prompts, rules, intent types) — 6-10 hours
- [ ] JobNimbus integration complete (auth, data retrieval, webhook) — 4-6 hours
- [ ] Testing harness for roofing scenarios — 3-4 hours
- [ ] Roofing onboarding playbook drafted — 3-4 hours
- [ ] **Status:** ~80% complete by end of month 4

**Month 3-4 Checkpoints:**
- [ ] 4-6 dental customers live and generating $9-15K MRR
- [ ] First case study documented (customer testimonial, results metrics)
- [ ] Roofing build ~80% complete
- [ ] Customer feedback themes identified (what to build in Phase 4)

---

### MONTH 5: Dental Momentum + Roofing Finalization

**Dental:**
- [ ] Close 2-3 more customers (total: 6-9 by month 5)
- [ ] Monthly recurring revenue: $12-18K
- [ ] Build second case study
- [ ] Refine cold email based on what's converting
- [ ] **Target:** MRR trending toward $15-20K by month 6

**Roofing:**
- [ ] Complete remaining build work (4-5 hours remaining)
- [ ] End-to-end test with real/demo JobNimbus account
- [ ] Roofing onboarding playbook finalized
- [ ] Prepare warm contact list (50 roofing contractors you know or can reach)
- [ ] **Status:** 100% launch-ready by end of month 5

**Month 5 Checkpoint:**
- [ ] Dental: 6-9 customers, $12-18K MRR
- [ ] Roofing: Build 100% complete, launch-ready
- [ ] Two case studies (dental proof of concept)
- [ ] Go/No-Go: Ready to launch roofing? YES → Month 6 launch

---

### MONTH 6: Roofing Launch + Dental Continues Scaling

**Dental Continuation:**
- [ ] Close 2-3 more customers (total: 9-12)
- [ ] MRR: $15-22K
- [ ] Continue refining based on customer feedback

**Roofing Launch:**
- [ ] Soft launch to warm contacts (contractors you know, 50 person list)
- [ ] Send roofing-specific cold emails (different from dental, emphasize your contracting background)
- [ ] Book first roofing discovery calls
- [ ] Target: 2-3 roofing customers by end of month 6
- [ ] **Messaging:** "We built this specifically for roofing contractors. (Your background + credibility)"

**Month 6 Checkpoint:**
- [ ] Dental: 9-12 customers, $15-22K MRR (stable, scaling)
- [ ] Roofing: Launched, first 2-3 customers in pipeline
- [ ] Total combined MRR: $18-27K
- [ ] One brand positioning (369 = autonomous operations for service businesses)
- [ ] Proof of repeatability (dental works, roofing works, pattern proven)

---

### MONTHS 7-12: Dual Verticals + Phase 4 Development

**Dental (Months 7-12):**
- [ ] Continue scaling, close 3-6 more (total: 12-15 by month 12)
- [ ] MRR: $18-30K by month 12
- [ ] Build 3+ case studies
- [ ] Refine positioning based on successful closes
- [ ] **Target:** 12-15 mature dental customers by month 12

**Roofing (Months 7-12):**
- [ ] Scale roofing sales (now with proven cold email templates)
- [ ] Close 2-4 more roofing customers (total: 4-6 by month 12)
- [ ] MRR: $6-12K by month 12
- [ ] Build first roofing case study by month 8

**Phase 4 Development (Months 6-12, parallel):**
- [ ] Based on customer feedback from months 1-6, build Phase 4 features:
  - [ ] Real-time learning (agents improve per customer based on feedback)
  - [ ] Client-facing portal (clients see only their own agents' activity)
  - [ ] Additional integrations (Stripe for dental, Calendly for both)
  - [ ] Multi-agent routing refinement (expand specialized agents)
- [ ] Phase 4 scope is determined by **real customer needs**, not architecture guesses

**Month 12 Checkpoint:**
- [ ] Dental: 12-15 customers, $18-30K MRR
- [ ] Roofing: 4-6 customers, $6-12K MRR
- [ ] **Combined MRR: $24-42K**
- [ ] Phase 4 launched with first features
- [ ] 4+ case studies across verticals
- [ ] Repeatable sales process proven (can replicate for legal)
- [ ] Go/No-Go: Ready to add third vertical (legal)? YES → Month 13-15 planning

---

## REVENUE TARGETS (Locked In)

| Milestone | Dental | Roofing | Total MRR | Status |
|-----------|--------|---------|-----------|--------|
| Month 3 | 2-3 customers | — | $3-9K | First closes |
| Month 6 | 4-6 customers | Launching | $6-18K | Dual launch |
| Month 12 | 12-15 customers | 4-6 customers | $24-42K | Scaling both |
| Month 18 | 18-22 customers | 12-15 customers | $45-70K | Mature both |
| Month 24 | 22-28 customers | 18-22 customers | $60-90K | Add legal (month 15+) |

**North Star:** $50K MRR by month 18. $100K MRR by month 24 (with legal vertical added).

---

## ARCHITECTURE (Final, Don't Change)

```
core/
  email-ingest.ts              → Parse email, classify intent
  router.ts                    → Route to handler by vertical config
  responder.ts                 → Draft response with Claude API
  approval-queue.ts            → Push to pending_responses table
  sender.ts                    → Send via Resend

config/
  dental.ts                    → Prompts, rules, Dentrix endpoint
  roofing.ts                   → Prompts, rules, JobNimbus endpoint
  legal.ts (future)            → Prompts, rules, Clio endpoint

integrations/
  dentrix.ts                   → Dental EHR auth + data retrieval
  jobnimbus.ts                 → Roofing CRM auth + data retrieval
  clio.ts (future)             → Legal case management

database/
  clients                      → One row per customer
  pending_responses            → Draft responses waiting approval
  system_audits                → Audit trail (Phase 1-2 holdover)
  business_memory              → Per-customer context
```

**Rule:** Never mix vertical-specific logic into core. Router asks "which config?" and hands off.

---

## PRICING (Locked In)

### Dental
- Setup: $3,000 (one-time)
- Monthly: $1,500 (can be $1.2K-2K depending on negotiation)
- Year 1 per customer: $21,000

### Roofing
- Setup: $2,500 (one-time)
- Monthly: $1,200 (can be $1-1.8K depending on size)
- Year 1 per customer: $17,000

### (Future) Legal
- Setup: $5,000 (one-time, higher complexity)
- Monthly: $2,500-3,500 (highest margin)
- Year 1 per customer: $35K-50K

**Positioning:** Premium pricing justified by specialization + integration depth, not by raw capability.

---

## DECISION CHECKPOINTS (Weekly Reviews)

**Weekly (Every Sunday):**
- [ ] How many cold emails sent this week?
- [ ] How many calls booked/completed?
- [ ] MRR status (customers on track?)
- [ ] Build progress (on schedule?)
- [ ] Customer satisfaction (feedback incoming?)

**Monthly (End of each month):**
- [ ] Month checkpoint (are we hitting targets?)
- [ ] Revenue actual vs. target
- [ ] Customer count actual vs. target
- [ ] Build progress actual vs. plan
- [ ] Go/No-Go decision (continue path, or pivot?)

**Quarterly (Month 3, 6, 9, 12, 15, 18):**
- [ ] Strategic review (are we still aligned on vision?)
- [ ] Vertical focus (is dental/roofing still right, or adjust?)
- [ ] Next vertical decision (when do we add legal?)
- [ ] Upmarket move decision (when do we target DSOs?)

---

## KEY SUCCESS FACTORS (Don't Forget)

1. **Discipline on timeline:** Don't sell roofing before dental has traction. This kills both pipelines.
2. **Customer feedback drives development:** Phase 4 scope is determined by real customers, not architecture guesses.
3. **One brand, outcome-focused:** We're not "dental AI" and "roofing AI." We're "369 = autonomous operations for service businesses."
4. **Revenue funds the vision:** First MRR goes to Phase 4 development, infrastructure, legal vertical build.
5. **Specialization > generalization:** Every decision should move toward deeper specialization, not broader generalization.

---

## SUPPORT STRUCTURE (Chris + Claude.ai)

**Claude.ai (External) Role:**
- Strategic guidance and decisions
- Architecture validation
- Market analysis and positioning
- Weekly check-in on progress
- Course correction if timeline/targets slip
- Escalation point for major decisions

**Claude (VS Agent) Role:**
- Day-to-day development
- Code execution
- Technical problem-solving
- Build velocity
- Architecture implementation

**Chris's Role:**
- Sales and customer acquisition
- Customer success and onboarding
- Strategic decisions with Claude.ai input
- Operational execution
- Feedback loop (customer → Claude.ai/VS → iteration)

---

## RED FLAGS (Stop and Re-Assess)

**If any of these happen, stop and reassess:**

- ❌ MRR is not growing as projected (month 6 should be $5-9K minimum)
- ❌ Cold outreach is converting <5% (you're messaging wrong)
- ❌ Dental customers are churning or unhappy (product issue, pivot needed)
- ❌ You're starting to pitch roofing before dental has 2-3 customers (discipline broken)
- ❌ Build is consistently slipping 2+ weeks (scope reassessment needed)
- ❌ You're losing confidence in dental vertical choice (roofing might be better, reassess)

---

## FINAL COMMITMENT

**This is locked in. No more second-guessing. Execute.**

**Start Monday with Phase 3-4 core architecture + SendGrid setup.**

---

**Document Version:** 1.0 (Locked)
**Last Updated:** 2026-05-24
**Next Review:** 2026-05-27 (end of week 1)

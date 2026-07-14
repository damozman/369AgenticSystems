# Roadmap to Real Agency
**Strategic prioritization: what to build (and in what order) to move from "home office project" to "actual agency business."**
Date: 2026-07-11 · Updated: 2026-07-13
Context: Current offering is Ava (receptionist) + Rex/Nova (follow-up/confirmation) but incomplete in business automation, vertical coverage, and tier differentiation.

> **2026-07-13 correction:** Item #1 below ("Per-client provisioning automation") was marked DONE on 2026-07-11 and claimed "verified end-to-end." That was false — the claim predated the production database schema even having the columns the code wrote to. A real Stripe signup on 2026-07-12/13 found the whole pipeline broken (3 separate bugs: schema drift, wrong Retell API endpoints, a version-field rejection) and it has now been genuinely fixed and verified for the first time. Full detail: `retell_provisioning_gaps_2026-07-13.md` (memory) and Era 7 of `docs/reference/changelog-recent-sessions.html`. Lesson for this doc going forward: a "DONE" mark here means the code was written, not that it was checked against the live system — don't take past "DONE"s at face value without re-verifying if launch is imminent.

---

## The Gap

Claude Web's original direction pitched a full digital workforce (5+ agents, document drafting, claims triage, inventory tracking). What got built: a receptionist (Ava) plus two generic email sequences (Rex, Nova) that aren't even live everywhere yet.

**The real gap isn't features. It's business infrastructure.** You have the core receptionist (the hard part). What's missing is the operational backbone that makes this feel like an agency service, not a DIY tool with a markup.

---

## Tier Fixes First
(These are the tiers you're selling right now. Fix these before building anything new.)

| Tier | Core | What's included | Real differentiator | Why this matters |
|---|---|---|---|---|
| **Starter ($400/mo)** | Ava 24/7 receptionist | Dashboard, daily email summary, HD voice quality | Entry point — "never lose a call again" | Proven ROI: 1 saved job/month covers the fee. Simplest sell. |
| **Pro ($600/mo)** | Everything in Starter | + Rex follow-up (day 0/3/7) + Nova confirmation email | Nurture automation, not just capture | Differentiates by outcome ("we convert, not just capture") |
| **Elite ($750/mo)** | Everything in Pro | + Live call transfer + call recording + searchable transcript archive | Operational intelligence | "Your team has a second brain" — search past calls, see patterns, train on language |

**Current problem:** Pro and Elite don't have real differentiators outside roofing/HVAC/plumbing. Pro is Starter at a higher price. Elite is Pro at a higher price. This is a lie you're currently selling.

**Action:** Rewrite tier copy around what's actually different. Don't launch new features yet — first, be honest about what each tier includes.

---

## Build Priority: Immediate → Impact (do in this order)

### 1. **Per-client provisioning automation** — BLOCKING SCALE ✅ ACTUALLY DONE (2026-07-13)
**Effort:** 2–3 days · **Impact:** 10x · **Do first.**

**The problem:** Every new client is a manual checklist — create Retell number, wire it up, Supabase row, test calls, train on vertical copy. Works for 2–3 clients. At 10 clients it's a part-time job.

**What needs to happen:**
- Stripe webhook on `checkout.session.completed` → fire provisioning job
- Job: (a) call Retell API to create per-client phone number, (b) insert `agent_subscriptions` row with that number + tier + vertical, (c) email client + Chris with setup packet (number, how to configure, test call instructions)
- Test end-to-end: complete a Stripe payment → 5 minutes later, number is live and testable

**Why this is #1:** Without this, every client is an hour of manual work. That kills margins and your ability to scale. This is the difference between "indie project" and "company."

**Current state:** ✅ Genuinely done and verified 2026-07-13/14, after being marked done-but-broken on 2026-07-11 (see correction note at top of this doc). A real Stripe test signup (leakfree.com) confirmed the full chain: creates a real Retell agent with a personalized greeting on its own LLM ("Thank you for calling Leakfree Roofing Company"), allocates and binds a real phone number, writes a correct `agent_subscriptions` row, attributes inbound calls to the right customer, and — the last open piece — **the questionnaire's business context actually shapes live call behavior**, not just the stored prompt. Confirmed on a real call: caller mentioned price-shopping and asked about warranty; agent responded with the exact 25-year warranty, "we work around your schedule," and "$10,000 and up" language straight from the questionnaire, and handled the price objection smoothly per the questionnaire's guidance. Found and fixed one more bug getting here — `/api/questionnaire/submit` fired the prompt-merge sync without awaiting it, so it silently never completed on Vercel's serverless runtime (same bug class as the historical Nova fire-and-forget issue). Nothing outstanding on this item.

---

### 1b. **Client dashboard essentials** — FIRST-DAY EXPERIENCE GAP ✅ DONE (2026-07-13/14)
**Effort:** ~1–2 days · **Impact:** High — this is the first thing a real customer sees after paying.

**The problem:** Found by actually testing a real signup end-to-end (Watertown Roofing) rather than reading the code. Four real gaps:
1. The customer's own phone number was nowhere on their dashboard — no way to reference it, copy it, or give it to their team.
2. The status banner said "Setup In Progress — finishing your call forwarding setup" for a brand-new customer with zero calls, directly contradicting "Your AI receptionist is active and ready to answer" elsewhere on the same page. Leftover language from an old manual-provisioning assumption that no longer applies now that provisioning is instant.
3. No visibility into whether the customer completed the onboarding questionnaire — if they skip the email link, there's no way to know their agent is still running on generic (not personalized) defaults.
4. No billing/subscription management link anywhere — every payment-method or invoice question becomes a manual email to Chris.

**What's done (2026-07-13):**
- ✅ Phone number now shown prominently in the dashboard header with a copy button (`PhoneNumberCard` in `ClientDashboardView.tsx`)
- ✅ Status banner fixed — new customers now see a neutral "Receptionist Live — waiting for your first call" instead of the contradictory forwarding message
- ✅ Welcome email had no way back to the dashboard at all if you didn't click the questionnaire CTA — found live, mid-test. Added a secondary "Access your dashboard" link to `/login`.
- ✅ Questionnaire completion folded into the existing "Getting Started" checklist as its own step — sourced from real `client_questionnaires.completed_at`, with a "Complete now →" link when not done (the one step in that checklist a customer can actually act on directly)
- ✅ "Call your number now to hear it live" nudge — tap-to-call phone number, nudge shown only until the first real call lands
- ✅ Preferred area code at checkout — Chris asked if customers could already do this; they couldn't, the webhook read a custom field that no live Payment Link actually had configured (Stripe caps custom fields at 3, all 3 slots were taken by business name/domain/phone). Fixed by moving phone collection to Stripe's native `phone_number_collection` setting, freeing the 3rd slot for `preferred_area_code`.
- ✅ Billing/subscription management link — `agent_subscriptions.stripe_customer_id` now captured from the checkout webhook, new `GET /api/billing-portal` route creates a real Stripe Billing Portal session and redirects. Link added to the dashboard footer.
- ✅ Customer's own name was never actually captured — Chris caught this live, mid-checkout. `session.customer_details.name` only populates when `billing_address_collection` is `"required"`; all 3 Payment Links had it at Stripe's default `"auto"`. Real impact: fed Chris's own internal new-customer notification email (`Owner: ${ownerName}`) and the ROI report contact line — both would have shown "Unknown" for every real signup. Set to `"required"` on all 3 live Payment Links.

**FULL RE-VERIFICATION 2026-07-14 (Northside Roofing, real signup, no manual intervention):** every item above confirmed together in one continuous real signup — area code `817` requested → phone `+18176126757` allocated (actually honored, not just captured); Stripe customer "Jackson Bolton" with real billing address; `stripe_customer_id` captured, real billing portal session created against it; greeting personalization + full questionnaire-driven prompt merge both fired automatically (`kb_uploaded_at` set 0.7s after `completed_at`, no manual sync needed this time); a real call confirmed the agent quoting the exact warranty details from the questionnaire; welcome email, owner notification, and Rex follow-up email all delivered. This is the first time every piece from this session worked together end-to-end with zero manual patching.

All four original gaps closed, plus three more found along the way (missing dashboard link in the welcome email, preferred area code never actually reachable, customer name never actually captured). Nothing outstanding on this item.

---

### 1c. **Agent never confirms email/phone accuracy back to the caller** — found reviewing the Northside Roofing transcript ✅ FIXED (2026-07-14)

Chris caught it manually reviewing a real transcript: the caller spelled their email letter-by-letter ("D a m o z m a n at gmail dot com"), but the agent confirmed it back as a natural-sounding word ("damosman@gmail.com" — note the S where a Z should be) instead of spelling it back. Letters that sound alike over the phone (B/D, M/N, S/Z) are exactly the kind of error a caller can't catch unless the agent spells it back — and a wrong email means the customer silently never gets their quote, with nobody noticing the lead died.

Checked all 9 vertical templates directly — none had any instruction to confirm email or phone accuracy at all, just "ask for an email address." Added an explicit accuracy-check instruction to all 9 templates' `general_prompt`: spell email back letter-by-letter and confirm, read phone digits back grouped and confirm. Verified via re-fetch that the instruction saved correctly.

**Caveat:** this only affects the templates, so it applies automatically to every *future* signup (cloning pulls the current template), but doesn't retroactively update any already-cloned customer agent. Not an active concern since no real customers are live yet, but worth knowing if this ever needs to be pushed to an existing customer's agent later — would need a direct `client.llm.update()` per customer, not just a template edit.

**Not yet verified on a real call** — do that on the next test signup to confirm the agent actually spells things back rather than just having the instruction sitting in the prompt unused.

**Why this matters:** these are things a real, paying customer needs on day one, not nice-to-haves. Found the same way everything else this week was found — by actually using the product, not reading the code.

---

### 2. **Real ROI dashboard per client** — RETENTION BLOCKER ✅ DONE (2026-07-11)
**Effort:** 3–5 days · **Impact:** 8x (prevents churn) · **Do second.**

**The problem:** Clients see a dashboard with generic numbers. Real value is invisible. They can't justify the fee to themselves. Churn happens.

**What needs to happen:**
- Real per-client metrics (pull from `calls` table, aggregate by `client_domain`):
  - Calls answered this week vs. last week (trending)
  - Leads captured (with phone numbers, names, ready to dial back)
  - **Estimated revenue protected:** `calls_answered × vertical_job_value × 0.30 close_rate`
  - Peak hours (when they miss the most calls)
  - Top repeat callers (who keeps trying to reach you)
- **Monthly one-pager email** (auto-generated, send on the 1st):
  - "You took 42 calls this month. We estimate that's $12,600 in jobs you'd have lost. Your fee was $400. ROI: 31x."
  - Include a chart: daily call count for the past 30 days
  - Include top caller by frequency (relationship building)

**Why this is #2:** A client seeing "$12K+ revenue protected" does not cancel a $400 bill. A client seeing generic numbers might. This is the #1 churn lever.

**Current state:** ✅ DONE. Monthly ROI email function built (`sendMonthlyROIReport`). Cron endpoint (`/api/cron/send-monthly-roi-reports`) queries real 30-day call/booking data for each client, calculates revenue protected (calls × job value × 30% close rate), computes ROI multiplier (e.g., 31x), sends beautiful HTML email on 1st of each month. Dashboard already shows real numbers (`revenueProtected` metric). Email drives retention by proving value.

---

### 3. **Rex/Nova parity across all 9 verticals** — PRODUCT CONSISTENCY ✅ DONE (2026-07-11)
**Effort:** 4–6 days · **Impact:** 6x (lets you sell Pro everywhere) · **Do third.**

**The problem:** Rex/Nova follow-up is only live for roofing/HVAC/plumbing. If someone in legal, SaaS, insurance pays for Pro, they get nothing different from Starter. That's a pricing lie.

**What was built:**
- ✅ Rex follow-up templates for all 9 verticals with vertical-specific urgency messaging:
  - **Legal:** Statute of limitations / case deadlines
  - **Real Estate:** Market timing / buyer pool competition
  - **Insurance:** Protection gaps / rate locking window
  - **SaaS:** Time-to-value / ROI timeline
  - **Wholesale:** Inventory levels / stock availability
  - **Dental:** Dental health consequences / treatment cost escalation
- ✅ 3-step email + SMS template for each vertical
- ✅ Updated `FOLLOWUP_LIVE_VERTICALS` to include all 9
- ✅ Pro tier now delivers real follow-up for all verticals

**Why this was #3:** Without this, you're selling a tier you can't deliver. Now Pro has real differentiation across every vertical.

---

## Then: Build Real Tier Features (in this order)

### 4. **Elite: Live call transfer** — CODE WAS BROKEN, NOT JUST UNTESTED ✅ FIXED (2026-07-14)
**Effort:** 2 days · **Impact:** 5x on Elite conversion

Owner gets an incoming call. Ava qualifies them, then routes the call live to owner's phone right now (with fallback voicemail after 30s).

**What actually happened:** Chris tried this on a real Elite call (Northside Roofing) expecting a live transfer — instead the agent just recited the owner's phone number as text. Confirmed directly against the live agent: `transfer_phone_number` was `undefined` even though `provisionRetellAgent()` was setting it, and there was no `transfer_call` tool registered at all. Grepped the real retell-sdk Agent type — `transfer_phone_number` isn't a field anywhere in it. Same root pattern as the other Retell integration bugs this session (wrong phone endpoint, fake KB endpoint): a plausible field name that was never checked against the real SDK.

**Real mechanism:** a `TransferCallTool` entry in the LLM's `general_tools` array (same place as `capture_lead`/`book_appointment`), not an agent-level field. Fixed in `lib/retell-provisioning.ts` — `cloneAgentLlm()` now adds a `transfer_call` tool (cold transfer, 30s ring) when provisioning an Elite client with an owner phone. Verified by running the real provisioning function against the live API and confirming the tool registered correctly via re-fetch. **Not yet verified with an actual live phone transfer** — needs a real call from a fresh Elite signup to confirm the transfer itself connects, not just that the tool exists.

**Why:** This is the feature that justifies Elite's $750/mo price. It's the jump from "AI handles simple calls" to "AI gets expert help for complex calls." It had never worked for any Elite signup until this fix.

---

### 5. **Elite: Call recording + transcript search**
**Effort:** 3–4 days · **Impact:** 4x on Elite perceived value

Store call recordings in Supabase. Build a search UI: owner searches for keyword (e.g., "roof replacement"), sees all calls with that phrase, filters by outcome (booked vs. no-answer).

Use case: owner trains their team on what language closed deals, what language lost them.

**Why:** This is the "second brain" feature. Most agencies don't have this. It's a real differentiator.

---

### 6. **Pro: SMS follow-up option**
**Effort:** 3–5 days · **Impact:** 3x (increases follow-up conversion)

Email open rates: 20–30%. SMS open rates: 98%+.

Give Pro clients a choice: email sequence (current), SMS sequence (new), or SMS+Email combo.

Day 0: SMS "Hi [Name], thanks for calling. Here's what's next..."
Day 3: SMS + Email combo
Day 7: Final SMS reminder

**Why:** Table stakes in 2026. Agencies that only email are losing to agencies that text.

---

### 7. **Admin dashboard: multi-client view**
**Effort:** 2–3 days · **Impact:** 3x (gives you business visibility)

You log in, see:
- Total calls this month across ALL clients
- Total estimated revenue protected
- Revenue by vertical (which vertical is hot?)
- Top performers (which clients are making the most calls?)
- Churn risk (which clients had a quiet month?)

**Why:** Without this, you're blind to trends. This is how you know if the business is working.

---

## Competitive Positioning

**Who you're competing against:**
- DIY tools ($25–$50/mo): Retell, Twilio standalone. You lose on price, win on done-for-you.
- Generalist agencies: "We'll set up your AI receptionist." Usually one-time fee, no proof of ROI.
- Vertical specialists: Some roofing agencies already running their own Retell numbers. You compete on service level + ROI transparency.

**How you win:**
1. **Speed to setup** (provisioning automation — most agencies take 2–4 weeks, you do 5 min)
2. **Proof of ROI** (real dashboard — most agencies send a PDF once/month, you show it live)
3. **Vertical specialization** (copy that resonates with roofing vs. legal, not generic)
4. **Service level tiers that mean something** (Pro/Elite aren't just price bumps)

---

## NOT IN THIS WAVE (Parking Lot)

These were floated in early planning. True value, but not core to feeling like an agency:

- **Document drafting** (legal) — AI-generated legal docs are liability-heavy; skip
- **Claims triage** (insurance) — integrating with carrier systems is deep; do this in phase 2
- **Inventory tracking** (wholesale) — requires POS/warehouse API integrations; skip
- **Competitor monitoring** (SaaS) — Scout agent; low urgency vs. core receptionist
- **Dentrix integration** (dental) — dental is waitlist-only; do this when you launch dental

---

## Implementation Timeline (recommended)

**Week 1–2 (before cold emails):**
- [x] Fix tier copy (make it honest) ✅ DONE 2026-07-11
- [x] Per-client provisioning automation — code written 2026-07-11, but **not actually verified until 2026-07-13** (see correction note at top). Genuinely done now.
- [x] Real ROI dashboard — code written 2026-07-11; depends on `calls.client_domain` being correct, which it wasn't until 2026-07-13's domain fix. Any real numbers shown before that date would have been wrong.
- [x] Rex/Nova parity (all 9 verticals) ✅ DONE 2026-07-11
- [x] Test Stripe → Retell → Supabase end-to-end — the 2026-07-11 "verified multiple times" claim was false. Actually verified 2026-07-13 with a real signup, real call, and direct inspection of both Retell's and Supabase's state (not just reading logs).
- [x] Schema drift, hardcoded demo-domain, and 3 provisioning bugs found + fixed ✅ DONE 2026-07-13 (not originally on this list — found via real testing, not planned work)
- [x] Real per-client personalization (LLM cloning + questionnaire-to-prompt merge) ✅ built + function-verified 2026-07-13 — **not yet verified via a real signup + live call**, do that first next session
- [x] Deploy-time messaging standardized to 24 hours across the whole site ✅ DONE 2026-07-13

**Week 3–4 (first 3 clients live):**
- [x] Client dashboard: phone number display + fixed contradictory status banner ✅ DONE 2026-07-13
- [x] Client dashboard: questionnaire completion CTA (folded into Getting Started checklist) ✅ DONE 2026-07-13
- [x] Welcome email: missing dashboard-access link ✅ DONE 2026-07-13 (found live, mid-test)
- [x] Client dashboard: billing/subscription management link ✅ DONE 2026-07-14 (Stripe Billing Portal, needs one real signup to fully verify the click-through)
- [x] Client dashboard: "call your number now" nudge for new customers ✅ DONE 2026-07-14
- [x] Checkout: preferred area code actually reachable ✅ DONE 2026-07-14 (found via Chris asking — was never wired to a real Payment Link field)
- [x] Live call transfer (Elite) ✅ FIXED 2026-07-14 — was actually broken, not just untested (agent-level field that doesn't exist in the real SDK, no transfer_call tool ever registered). Fixed, verified via re-fetch. Not yet verified with an actual live phone transfer.
- [ ] Call recording + search (Elite) — code exists (Session 3), untested per the standing testing runbook
- [x] Verify personalization end-to-end with a real signup ✅ DONE 2026-07-14 — confirmed on a real call, agent used the exact questionnaire content (warranty, scheduling, pricing) when handling a real objection. Found + fixed one more bug in the process (unawaited KB sync).

**Month 2 (after validating core):**
- [ ] SMS follow-up (Pro) — code exists (Session 3), untested; Twilio not confirmed configured
- [ ] Admin multi-client dashboard — code exists (Session 3), untested

---

## The Bottom Line

You don't need more agents. You need **business automation** + **proof of value** + **tier differentiation that's real**.

Do these 7 things in this order, and you're not a home-office project anymore. You're a company selling a recurring, outcome-based, done-for-you service.

That's the difference between "$400/client/month, maybe 5 clients" and "$600/client/month, 20+ clients, real margins."

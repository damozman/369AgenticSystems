# Handoff Brief for VS Claude: Pre-Stripe Tier Fixes + Elite Redesign

**From:** Chris (planned in a Cowork session)
**Rule for this whole effort:** every tier claims only what the product delivers today. Nothing gets charged through Stripe until this brief is done.
**How to work:** show a diff before each commit. For anything marked SCOPE ONLY, report back with effort, approach, and risks, and don't build yet.

---

## 1. Pricing page copy fixes (decided, do now)

1. **Live Call Transfer (Elite):** mark "Coming soon." Don't present it as a live feature.
2. **Voice quality:** remove the tier labels (Crystal Clear / Enhanced / Premium). Put one line on ALL tiers: "Premium natural voice (featured upgrade)."
   - First, report which voice and provider every agent actually uses, so the claim matches what callers hear.
   - Remove the unused per-tier voice-quality setting from the pricing config, or flag it if removing it is risky.
3. **Custom Business Intelligence:** remove the Elite bullet and its "$49/mo retail value" badge. Add to ALL tiers: "Analytics dashboard: caller sentiment, call volume, peak hours, performance benchmarks."
4. **Retail value badges:** audit every other badge and report which ones aren't backed by something real.
5. **Starter email:** change "Daily email summaries" to "Weekly summary."
6. **Starter ROI report:** remove "monthly ROI report" for now (see section 3).
7. **Keep as-is:** "Call recording + searchable transcript archive" on Elite (correctly tier-locked).

## 2. Sales materials sweep (same claims, same fixes)

Find every place the claims above appear outside the pricing page and list them with suggested edits:
- Pricing one-pager
- Cold email templates
- Discovery call script
- MSA / SOW, including the HIPAA BAA wording (flag it only; Chris will take it to a lawyer)

## 3. Small fixes that make features honest

1. **Follow-up sequence bug (fix):** for phone-only leads, the SMS step fails every time (Twilio isn't configured) and retries forever with no alert. Skip the SMS step for those leads and log or alert instead.
2. **Daily summary email (SCOPE ONLY):** how much work is a daily version that reuses the Monday weekly digest (same template, one-day window, daily schedule)? If it's small, Chris will likely build it and switch the copy back to "Daily."
3. **ROI report (SCOPE ONLY):** add "What's your average job value?" to the onboarding questionnaire, then turn the report back on using the client's own number. No invented figures.
4. **Twilio SMS (note):** if texting is wanted, carrier registration (A2P 10DLC) can take days to weeks. Tell Chris what's needed to start it.

## 4. Elite redesign (Chris approved all of these ideas; SCOPE ONLY)

Elite is $750/mo. Goal: Elite should mean "we actively run your front desk with you," not "Pro with more features." For each item, report whether it's code, configuration or service-only, plus effort and dependencies.

**Leading direction (three pillars):**
1. **Live Call Transfer with routing rules:** emergencies go to the owner's cell, VIP or known callers go straight through, everyone else gets booked. Retell has built-in call transfer; confirm how it fits the current agent setup across all 11 live agents.
2. **Monthly strategy call with Chris:** service, not code. It may need a dashboard view or export that summarizes the month for the call.
3. **Ops brief reporting bundled in:** Chris's ops-brief reporting product (second 369 offering). Pro shows what happened on calls; Elite tells the owner what to do about it. Scope what exists and what it would take to deliver per client.

**Also approved for Elite:**
4. **Spanish support included** (currently an add-on). Confirm what actually works today.
5. **Custom voice included** (currently an add-on). Confirm what actually works today.
6. **Multiple locations or phone numbers** under one account.
7. **Priority changes:** script and knowledge updates within 24 hours (service commitment; note any tooling that would help).
8. **Transcript search:** already real, stays.
9. **ROI report** once section 3.3 is done.

**Later (not for launch):**
10. **Review requests after a job** (reputation management is on the agent roster). Note: automated texts need consent and registration.
11. **Performance guarantee** (e.g., "X leads in 60 days"). A business and legal decision; only note what tracking would be needed to measure it.

**Open questions for Chris (don't guess):**
- Pro's current price and features, so Elite can be clearly different
- How many Elite clients to accept, given the monthly call

## 5. HIPAA (don't build anything)

Dental is the primary vertical, and Ava collects patient details on calls. Before any dental client signs:
- Report which vendors (Retell, Supabase, Vercel, Resend) offer a BAA, and on which plan, from their official docs
- The HIPAA Compliance Pack add-on stays off
- Chris will get legal review

## 6. Then: connect Stripe

Only after sections 1–3 are done and the Elite copy is rewritten to match whatever is actually built.

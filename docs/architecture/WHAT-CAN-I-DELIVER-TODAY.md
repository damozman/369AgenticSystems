# What Can I Actually Deliver Today
**Ground truth as of 2026-07-16. Read this before a sales call, before flipping Stripe to live, before quoting a feature.**

> Companion to `369-SYSTEM-BLUEPRINT.md` in this folder — that one explains the architecture, this one answers "if someone pays right now, what do they actually get."

> **2026-07-16 update:** investigating the untested admin multi-client dashboard (Month 2 item, checklist below) surfaced a real, live production bug — `/admin` was missing from `middleware.ts`'s admin-only route gate entirely, so any real logged-in client could have navigated straight to it and seen every other client's revenue, MRR, and churn-risk data. Fixed and verified with real Supabase sessions (the real admin still gets in cleanly, a real client session now correctly bounces to `/client-dashboard`), and the dashboard's actual numbers were cross-checked against raw Supabase data and matched exactly. Not customer-facing, so it doesn't change what you can sell — but it was a real exposure until today.

> **2026-07-14 update (full day):** as of a real signup (Northside Roofing) run end-to-end with no manual intervention, the whole core pipeline is genuinely verified together: provisioning, questionnaire-driven personalization (confirmed on a real call — agent quoted exact warranty/pricing/scheduling language from the questionnaire), Elite live call transfer (previously completely broken — `transfer_phone_number` isn't a real Retell field — now fixed, upgraded to a warm transfer with a private handoff briefing, confirmed on real calls), Elite transcript search (confirmed against real data), and client dashboard essentials (phone number display, billing portal, questionnaire tracking). Later the same day: real-time email alerts to the client the moment a lead or booking happens (with a calendar `.ics` attachment on bookings), **Rex/Nova follow-up extended from 3 verticals to all 9** (the single largest gap in the launch plan — closed), and a real post-payment page replacing Stripe's generic confirmation screen. Retell's account balance was also checked and topped up directly on their dashboard. Full detail: Era 8 of `docs/reference/changelog-recent-sessions.html` and items 1e/1f/1g of `docs/architecture/ROADMAP-TO-REAL-AGENCY.md`.

> **2026-07-13 update:** the "manual provisioning" section below was accurate as of 2026-07-11 but is now wrong — real per-client automated provisioning was tested and confirmed working the same night this note was added, after a real Stripe signup uncovered it had never actually worked (schema drift, wrong Retell API endpoints, a version-field rejection). See the corrected section below and `retell_provisioning_gaps_2026-07-13.md` (memory) for the full story.

---

## The short version

You can sell and deliver **Starter, Pro, and Elite honestly, today, across 8 actively-promoted verticals** (roofing, HVAC, plumbing, legal, real estate, insurance, wholesale, plus SaaS which is technically live but deliberately pulled from promotion — see below). 24/7 call answering, real per-client personalization, live call transfer and transcript search (Elite), and real-time lead/booking alerts to the client, all confirmed against the real system. Nova's booking confirmation is genuinely a Starter feature; Rex's automated 3-step follow-up is genuinely Pro/Elite-exclusive as of 2026-07-16 (it fired on every tier by mistake until then — fixed). The one deliberate, known exception is dental (waitlist-only by design, not part of this launch). Stripe is still in test mode — that's the one remaining gate before real money moves, and it's a decision, not a bug.

---

## ✅ Fixed 2026-07-11 — the pricing page overclaim

`lib/tier-config.ts` used to list Pro/Elite features that didn't exist anywhere in the codebase ("Lead scoring & prioritization," "Conversion tracking," "Advanced reporting" on Pro; "Review request automation," "AI review response drafting," "Reputation score monitoring," "Referral tracking" on Elite). Rewritten to only list what's real: Pro now shows the actual follow-up sequence plus Enhanced Voice Quality (real Retell feature) and priority email support; Elite shows Premium Voice Quality + Custom Business Intelligence (both real Retell features) plus priority onboarding/support. Full before/after logged in `docs/reference/removed-agent-abilities-reference.html` (Round 3) and `pricing_tier_overclaim_2026-07-11.md` in memory.

`PREMIUM_ADDONS` in the same file (Live Call Transfer, Branded Caller ID, Spanish Support, Custom Voice, HIPAA Pack) is still dead code — defined but never rendered anywhere in the pricing UI. Left alone since it's not currently sellable either way; flag before ever wiring it up.

---

## What's real, right now, per tier

| Tier | Price | What's actually included |
|---|---|---|
| **Starter** | $400/mo + $1,500 setup | Ava answers calls 24/7, qualifies, books, personalized to the business via the onboarding questionnaire. **Nova sends the caller a booking confirmation email** (genuinely a Starter feature, not Pro-gated). Real-time dashboard with phone number, billing portal, questionnaire tracking. Real-time email alert to the client on every new lead/booking (with calendar invite on bookings). HD call quality (real Retell feature). Daily email summary. **Does not include Rex follow-up** (gated 2026-07-16 — previously fired on every tier by mistake). |
| **Pro** | $600/mo | Everything in Starter, **plus Rex's automated 3-step lead-nurture follow-up** — now genuinely gated to Pro/Elite only (fixed 2026-07-16; previously fired for Starter too, for free) and live in all 9 verticals (closed 2026-07-14). Plus real Enhanced Voice Quality. |
| **Elite** | $750/mo | Everything in Pro, plus **live call transfer** (warm transfer with a private handoff briefing to the owner — confirmed on real calls), **call recording + searchable transcript archive** (confirmed against real data), Premium Voice Quality and Retell's Custom Business Intelligence (real, bundled Retell features), and priority onboarding/support. Both headline Elite features were completely broken until 2026-07-14 — confirm this note is still current before quoting Elite. |

---

## What's live, per vertical

| Vertical | Ava (receptionist) | Rex (follow-up) | Nova (confirmation) | Felix / Scout |
|---|---|---|---|---|
| Roofing, HVAC, Plumbing | ✅ Live | ✅ Live | ✅ Live | — |
| Legal | ✅ Live | ✅ Live | ✅ Live | Felix ✅ live (conflict check) |
| Real Estate, Insurance, Wholesale | ✅ Live | ✅ Live | ✅ Live | — |
| SaaS | ✅ Live (technically) | ✅ Live | ✅ Live | Scout planned |
| Dental | Waitlist — nothing live | Content exists, agent doesn't | Content exists, agent doesn't | — |

**SaaS deprioritized from active promotion, 2026-07-16** — don't lead a sales call with it. The underlying product still works, but Chris's call: phone answering is a weak fit for SaaS since phone isn't their primary lead channel. Removed from every public vertical selector (homepage, `/founding`, SEO/structured data) — the page itself and the `/saas` funnel stay live and reachable, just not promoted. Revisit Month 3-4 with a webhook-triggered trial/demo follow-up repositioning instead of call-answering. Full note: `pending_items.md` (memory).

**Closed 2026-07-14:** Rex/Nova now live in all 9 verticals — verified live for real-estate and saas specifically, mechanically identical for the rest since Nova generates its confirmation copy live via Claude rather than per-vertical hand-written templates. A Pro/Elite sale in any launched vertical now delivers what it promises. Dental is the one deliberate exception — content is ready, but its template agent doesn't exist on Retell yet and it's staying waitlist-only by design.

---

## Funnels — status

Both funnels are wired to real endpoints, not placeholders (checked directly, no `GUMLOOP_WEBHOOK_URL_HERE` or dead links remain anywhere in `/public`):

- **Cold-email funnel** (static pages → Gumloop → 3-email sequence): live, real webhook, differentiated by `source_tag` per vertical.
- **Warm funnel** (ROI calculator → pricing → Stripe checkout → real post-payment page → client dashboard → real Retell agent + phone number): genuinely verified end-to-end **in Stripe test mode**, most recently 2026-07-14 — a real test purchase creates a real Retell agent (with a personalized greeting, not a shared template), allocates and binds a real phone number, writes a correct `agent_subscriptions` row, correctly attributes that customer's inbound calls, lands on a real confirmation page (not Stripe's generic one) with a direct link into the questionnaire, and the deeper questionnaire-driven personalization is confirmed live on a real call too. Not yet tested with real money.

**Funnels are ready to execute on** — nothing is broken or placeholder, and as of 2026-07-14 the tier/vertical promises the funnel sells actually match what's built. The one remaining gate before real money moves is Stripe test mode itself, which is Chris's call, not a technical blocker.

---

## Per-client provisioning: automated, now genuinely verified (2026-07-14)

As of 2026-07-13, a Stripe payment automatically provisions a real, dedicated Retell agent and phone number — no manual step required. This was previously believed done (marked DONE 2026-07-11) but that claim was never actually true: the production database didn't even have the columns the provisioning code wrote to until this fix, so every real attempt would have thrown after already creating a billable Retell agent. Three separate bugs (schema drift, two wrong Retell API endpoints, a version-field rejection) were found and fixed the same night by testing a real signup, not by reading the code. Full detail: `retell_provisioning_gaps_2026-07-13.md` (memory), Era 7 of `docs/reference/changelog-recent-sessions.html`.

**Standing gap closed 2026-07-14:** the questionnaire-driven deeper personalization (business services, hours, emergency rules, FAQs merged into the agent's prompt) was only verified at the function level as of 2026-07-13. A real signup (Northside Roofing) plus a real live call has now confirmed it works — the caller price-shopped and asked about warranty; the agent answered with the exact 25-year warranty and pricing language straight from the questionnaire. You can now tell a customer their agent "knows their business" from the questionnaire.

**New standing item:** the agent doesn't yet confirm email/phone spelling accuracy back to the caller in a verified way — the instruction was added to all 9 vertical templates 2026-07-14 after a real transcript showed a misheard email address, but hasn't been confirmed working on an actual call yet. Confirm before relying on it for a real customer's contact info.

---

## Before you take real money — the actual checklist

1. ~~Fix the Pro/Elite feature list on the pricing page~~ — done 2026-07-11.
2. ~~Decide Rex/Nova rollout for the 6 verticals where they're still "planned"~~ — done 2026-07-14: Rex already had content for all 9, just needed switching on; Nova extended to all 9 via its Claude-generated (not hand-written) template system. Verified live for real-estate and saas.
3. Flip Stripe to live mode when ready (see `stripe_live_mode_prep` notes — direct-curl signature testing technique, Vercel env var masking behavior). **Deliberately still test-mode — Chris's call, "soon but not yet" as of 2026-07-14.**
4. ~~Confirm the `/onboarding-complete` Payment Link redirect~~ — done 2026-07-14: turned out nothing was redirecting there at all (page didn't exist, links used Stripe's generic confirmation). Built a real page and wired up all 3 live links; verified against a real completed session.
5. ~~Have your manual provisioning steps written down~~ — superseded 2026-07-13: provisioning is now automated and verified, no manual checklist needed for the core flow.
6. ~~Run one real signup all the way through the questionnaire to confirm personalization actually works~~ — done 2026-07-14, confirmed on a real call.
7. Fix the typo'd `RETELL_TEMPLATE_AGENT_DENTAL` env var before dental ever launches — currently points at a nonexistent agent ID. **Deliberately deferred — Chris confirmed dental stays waitlist-only for now, 2026-07-14.**
8. ~~Check Retell account credit balance~~ — done 2026-07-14: Chris checked directly on Retell's dashboard, topped up the balance, and cross-verified the day's usage against the numbers reported mid-session — matched.
9. Confirm the email/phone spelling-accuracy instruction (added 2026-07-14) actually changes agent behavior on a real call, not just sitting unused in the prompt. **Still open — needs a real test call.**
10. Twilio still isn't configured — Pro-tier SMS follow-up and any future SMS-based client alerts are blocked on this, not on code. **Still open, not urgent.**
11. ~~Rex was firing on every tier, not just Pro/Elite~~ — fixed 2026-07-16, verified live with a temporary Starter-tier test subscription (correctly skipped) and a regression check against a real Elite subscription (still fires normally).
12. ~~Admin dashboard reachable by any logged-in client~~ — fixed 2026-07-16, verified with real Supabase sessions. Not customer-facing, doesn't change what's sellable, but was a real exposure until fixed.

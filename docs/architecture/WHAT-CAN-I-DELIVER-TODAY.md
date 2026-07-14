# What Can I Actually Deliver Today
**Ground truth as of 2026-07-14. Read this before a sales call, before flipping Stripe to live, before quoting a feature.**

> Companion to `369-SYSTEM-BLUEPRINT.md` in this folder — that one explains the architecture, this one answers "if someone pays right now, what do they actually get."

> **2026-07-14 update:** as of a real signup (Northside Roofing) run end-to-end with no manual intervention, the whole core pipeline is now genuinely verified together: provisioning, questionnaire-driven personalization (confirmed on a real call — agent quoted the exact warranty/pricing/scheduling language from the questionnaire), Elite live call transfer (previously completely broken — `transfer_phone_number` isn't a real Retell field — now fixed and confirmed on real calls, upgraded to a warm transfer with a private handoff briefing), Elite transcript search (confirmed against real data, recording URLs confirmed actually playable), and client dashboard essentials (phone number display, billing portal, questionnaire completion tracking). New this session: real-time email alerts to the client the moment a lead or booking happens (not just a dashboard stat), with a calendar `.ics` attachment on bookings. Full detail: Era 8 of `docs/reference/changelog-recent-sessions.html` and item 1e of `docs/architecture/ROADMAP-TO-REAL-AGENCY.md`.

> **2026-07-13 update:** the "manual provisioning" section below was accurate as of 2026-07-11 but is now wrong — real per-client automated provisioning was tested and confirmed working the same night this note was added, after a real Stripe signup uncovered it had never actually worked (schema drift, wrong Retell API endpoints, a version-field rejection). See the corrected section below and `retell_provisioning_gaps_2026-07-13.md` (memory) for the full story.

---

## The short version

You can sell and deliver **Starter and Pro tiers honestly, today, for roofing/HVAC/plumbing** — 24/7 call answering, real per-client personalization, follow-up and confirmation emails, and now real-time lead/booking alerts, all confirmed on real calls with a real signup. **Elite is now real too** — live call transfer and transcript search were both completely broken as of two days ago (not just untested) and are now fixed and confirmed on real calls. The remaining gap is the same as before: every other vertical's follow-up/confirmation layer (Rex/Nova) is still "planned," not built — a Pro/Elite sale in legal, SaaS, insurance, etc. is still paying for something that doesn't exist yet. **Fix that before Stripe goes live**, not after.

---

## ✅ Fixed 2026-07-11 — the pricing page overclaim

`lib/tier-config.ts` used to list Pro/Elite features that didn't exist anywhere in the codebase ("Lead scoring & prioritization," "Conversion tracking," "Advanced reporting" on Pro; "Review request automation," "AI review response drafting," "Reputation score monitoring," "Referral tracking" on Elite). Rewritten to only list what's real: Pro now shows the actual follow-up sequence plus Enhanced Voice Quality (real Retell feature) and priority email support; Elite shows Premium Voice Quality + Custom Business Intelligence (both real Retell features) plus priority onboarding/support. Full before/after logged in `docs/reference/removed-agent-abilities-reference.html` (Round 3) and `pricing_tier_overclaim_2026-07-11.md` in memory.

`PREMIUM_ADDONS` in the same file (Live Call Transfer, Branded Caller ID, Spanish Support, Custom Voice, HIPAA Pack) is still dead code — defined but never rendered anywhere in the pricing UI. Left alone since it's not currently sellable either way; flag before ever wiring it up.

---

## What's real, right now, per tier

| Tier | Price | What's actually included |
|---|---|---|
| **Starter** | $400/mo + $1,500 setup | Ava answers calls 24/7, qualifies, books, personalized to the business via the onboarding questionnaire. Real-time dashboard with phone number, billing portal, questionnaire tracking. Real-time email alert to the client on every new lead/booking (with calendar invite on bookings). HD call quality (real Retell feature). Daily email summary. |
| **Pro** | $600/mo | Everything in Starter, **plus Rex/Nova follow-up + confirmation email — but only for roofing, HVAC, plumbing.** For every other vertical, Pro is currently identical to Starter with a higher price tag beyond the real Enhanced Voice Quality bump. |
| **Elite** | $750/mo | Everything in Pro, plus **live call transfer** (warm transfer with a private handoff briefing to the owner — confirmed on real calls), **call recording + searchable transcript archive** (confirmed against real data), Premium Voice Quality and Retell's Custom Business Intelligence (real, bundled Retell features), and priority onboarding/support. Both headline Elite features were completely broken until 2026-07-14 — confirm this note is still current before quoting Elite. |

---

## What's live, per vertical

| Vertical | Ava (receptionist) | Rex (follow-up) | Nova (confirmation) | Felix / Scout |
|---|---|---|---|---|
| Roofing, HVAC, Plumbing | ✅ Live | ✅ Live | ✅ Live | — |
| Legal | ✅ Live | Planned | Planned | Felix ✅ live (conflict check) |
| Real Estate, Insurance, SaaS, Wholesale | ✅ Live | Planned | Planned | Scout planned, SaaS only |
| Dental | Waitlist — nothing live | — | — | — |

If someone signs up for Pro/Elite in a vertical other than roofing/HVAC/plumbing today, they're paying for follow-up/confirmation that doesn't exist yet. This is the same underlying gap the pricing-page finding above is describing, just viewed from the vertical angle instead of the tier angle.

---

## Funnels — status

Both funnels are wired to real endpoints, not placeholders (checked directly, no `GUMLOOP_WEBHOOK_URL_HERE` or dead links remain anywhere in `/public`):

- **Cold-email funnel** (static pages → Gumloop → 3-email sequence): live, real webhook, differentiated by `source_tag` per vertical.
- **Warm funnel** (ROI calculator → pricing → Stripe checkout → client dashboard → real Retell agent + phone number): genuinely verified end-to-end **in Stripe test mode**, most recently 2026-07-14 — a real test purchase creates a real Retell agent (with a personalized greeting, not a shared template), allocates and binds a real phone number, writes a correct `agent_subscriptions` row, correctly attributes that customer's inbound calls, and the deeper questionnaire-driven personalization now confirmed live on a real call too (not just function-tested). Not yet tested with real money.

**Funnels are ready to execute on** in the sense that nothing is broken or placeholder — the gap isn't the funnel, it's what the funnel is currently allowed to sell (see pricing finding above).

---

## Per-client provisioning: automated, now genuinely verified (2026-07-14)

As of 2026-07-13, a Stripe payment automatically provisions a real, dedicated Retell agent and phone number — no manual step required. This was previously believed done (marked DONE 2026-07-11) but that claim was never actually true: the production database didn't even have the columns the provisioning code wrote to until this fix, so every real attempt would have thrown after already creating a billable Retell agent. Three separate bugs (schema drift, two wrong Retell API endpoints, a version-field rejection) were found and fixed the same night by testing a real signup, not by reading the code. Full detail: `retell_provisioning_gaps_2026-07-13.md` (memory), Era 7 of `docs/reference/changelog-recent-sessions.html`.

**Standing gap closed 2026-07-14:** the questionnaire-driven deeper personalization (business services, hours, emergency rules, FAQs merged into the agent's prompt) was only verified at the function level as of 2026-07-13. A real signup (Northside Roofing) plus a real live call has now confirmed it works — the caller price-shopped and asked about warranty; the agent answered with the exact 25-year warranty and pricing language straight from the questionnaire. You can now tell a customer their agent "knows their business" from the questionnaire.

**New standing item:** the agent doesn't yet confirm email/phone spelling accuracy back to the caller in a verified way — the instruction was added to all 9 vertical templates 2026-07-14 after a real transcript showed a misheard email address, but hasn't been confirmed working on an actual call yet. Confirm before relying on it for a real customer's contact info.

---

## Before you take real money — the actual checklist

1. ~~Fix the Pro/Elite feature list on the pricing page~~ — done 2026-07-11.
2. Decide Rex/Nova rollout for the 6 verticals where they're still "planned" — either build them out or make sure Pro-tier pricing for those verticals doesn't promise something Starter already includes. **Still open — the largest remaining gap between pricing and reality.**
3. Flip Stripe to live mode when ready (see `stripe_live_mode_prep` notes — direct-curl signature testing technique, Vercel env var masking behavior). **Still test-mode only.**
4. Confirm the `/onboarding-complete` Payment Link redirect (still unresolved as of the last check).
5. ~~Have your manual provisioning steps written down~~ — superseded 2026-07-13: provisioning is now automated and verified, no manual checklist needed for the core flow.
6. ~~Run one real signup all the way through the questionnaire to confirm personalization actually works~~ — done 2026-07-14, confirmed on a real call.
7. Fix the typo'd `RETELL_TEMPLATE_AGENT_DENTAL` env var before dental ever launches — currently points at a nonexistent agent ID. **Still open** — confirmed again 2026-07-14 while patching the other 8 vertical templates.
8. Check Retell account credit balance — showed a low-credits warning as of 2026-07-13, unrelated to any code issue but will stop everything if it runs out. **Recheck — not verified again since.**
9. Confirm the email/phone spelling-accuracy instruction (added 2026-07-14) actually changes agent behavior on a real call, not just sitting unused in the prompt.
10. Twilio still isn't configured — Pro-tier SMS follow-up and any future SMS-based client alerts are blocked on this, not on code.

# What Can I Actually Deliver Today
**Ground truth as of 2026-07-13. Read this before a sales call, before flipping Stripe to live, before quoting a feature.**

> Companion to `369-SYSTEM-BLUEPRINT.md` in this folder — that one explains the architecture, this one answers "if someone pays right now, what do they actually get."

> **2026-07-13 update:** the "manual provisioning" section below was accurate as of 2026-07-11 but is now wrong — real per-client automated provisioning was tested and confirmed working the same night this note was added, after a real Stripe signup uncovered it had never actually worked (schema drift, wrong Retell API endpoints, a version-field rejection). See the corrected section below and `retell_provisioning_gaps_2026-07-13.md` (memory) for the full story. This doc's earlier "verified end-to-end" claims for the warm funnel predate that fix and should not be trusted at face value — this update is the first genuinely re-verified state.

---

## The short version

You can sell and deliver the **Starter tier ($400/mo + $1,500 setup) honestly, today, for roofing/HVAC/plumbing** — 24/7 call answering plus follow-up and confirmation emails, fully live and verified on real calls. Everything past that — Pro, Elite, and every other vertical's follow-up/confirmation layer — has a real gap between what the pricing page promises and what's built. **Fix that before Stripe goes live**, not after.

---

## ✅ Fixed 2026-07-11 — the pricing page overclaim

`lib/tier-config.ts` used to list Pro/Elite features that didn't exist anywhere in the codebase ("Lead scoring & prioritization," "Conversion tracking," "Advanced reporting" on Pro; "Review request automation," "AI review response drafting," "Reputation score monitoring," "Referral tracking" on Elite). Rewritten to only list what's real: Pro now shows the actual follow-up sequence plus Enhanced Voice Quality (real Retell feature) and priority email support; Elite shows Premium Voice Quality + Custom Business Intelligence (both real Retell features) plus priority onboarding/support. Full before/after logged in `docs/reference/removed-agent-abilities-reference.html` (Round 3) and `pricing_tier_overclaim_2026-07-11.md` in memory.

`PREMIUM_ADDONS` in the same file (Live Call Transfer, Branded Caller ID, Spanish Support, Custom Voice, HIPAA Pack) is still dead code — defined but never rendered anywhere in the pricing UI. Left alone since it's not currently sellable either way; flag before ever wiring it up.

---

## What's real, right now, per tier

| Tier | Price | What's actually included |
|---|---|---|
| **Starter** | $400/mo + $1,500 setup | Ava answers calls 24/7, qualifies, books. Real-time dashboard. HD call quality (real Retell feature). Daily email summary. |
| **Pro** | $600/mo | Everything in Starter, **plus Rex/Nova follow-up + confirmation email — but only for roofing, HVAC, plumbing.** For every other vertical, Pro is currently identical to Starter with a higher price tag beyond the real Enhanced Voice Quality bump. |
| **Elite** | $750/mo | Everything in Pro, plus Premium Voice Quality and Retell's Custom Business Intelligence (both real, bundled Retell features) and priority onboarding/support. |

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
- **Warm funnel** (ROI calculator → pricing → Stripe checkout → client dashboard → real Retell agent + phone number): genuinely verified end-to-end **in Stripe test mode** on 2026-07-13 — a real test purchase now correctly creates a real Retell agent (with a personalized greeting, not a shared template), allocates and binds a real phone number, writes a correct `agent_subscriptions` row, and correctly attributes that customer's inbound calls (not the shared demo account). Not yet tested with real money. The deeper questionnaire-driven personalization is built and function-tested but not yet confirmed through this same real-signup path — do that before calling it fully verified.

**Funnels are ready to execute on** in the sense that nothing is broken or placeholder — the gap isn't the funnel, it's what the funnel is currently allowed to sell (see pricing finding above).

---

## Per-client provisioning: automated, now genuinely verified (2026-07-13)

As of 2026-07-13, a Stripe payment automatically provisions a real, dedicated Retell agent and phone number — no manual step required. This was previously believed done (marked DONE 2026-07-11) but that claim was never actually true: the production database didn't even have the columns the provisioning code wrote to until this fix, so every real attempt would have thrown after already creating a billable Retell agent. Three separate bugs (schema drift, two wrong Retell API endpoints, a version-field rejection) were found and fixed the same night by testing a real signup, not by reading the code. Full detail: `retell_provisioning_gaps_2026-07-13.md` (memory), Era 7 of `docs/reference/changelog-recent-sessions.html`.

**Standing gap:** the questionnaire-driven deeper personalization (business services, hours, emergency rules, FAQs merged into the agent's prompt) is built and verified at the function level but has not been run through an actual customer signup + live phone call. Don't tell a customer their agent "knows their business" from the questionnaire until that's confirmed.

---

## Before you take real money — the actual checklist

1. ~~Fix the Pro/Elite feature list on the pricing page~~ — done 2026-07-11.
2. Decide Rex/Nova rollout for the 6 verticals where they're still "planned" — either build them out or make sure Pro-tier pricing for those verticals doesn't promise something Starter already includes.
3. Flip Stripe to live mode when ready (see `stripe_live_mode_prep` notes — direct-curl signature testing technique, Vercel env var masking behavior).
4. Confirm the `/onboarding-complete` Payment Link redirect (still unresolved as of the last check).
5. ~~Have your manual provisioning steps written down~~ — superseded 2026-07-13: provisioning is now automated and verified, no manual checklist needed for the core flow.
6. Run one real signup all the way through the questionnaire (fill it out, place a call) to confirm the deeper personalization actually works before telling a customer it does.
7. Fix the typo'd `RETELL_TEMPLATE_AGENT_DENTAL` env var before dental ever launches — currently points at a nonexistent agent ID.
8. Check Retell account credit balance — showed a low-credits warning as of 2026-07-13, unrelated to any code issue but will stop everything if it runs out.

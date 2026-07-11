# What Can I Actually Deliver Today
**Ground truth as of 2026-07-11. Read this before a sales call, before flipping Stripe to live, before quoting a feature.**

> Companion to `369-SYSTEM-BLUEPRINT.md` in this folder — that one explains the architecture, this one answers "if someone pays right now, what do they actually get."

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
- **Warm funnel** (ROI calculator → pricing → Stripe checkout → client dashboard): code-complete and verified end-to-end **in Stripe test mode** — real subscription + agent config rows created in Supabase on a test purchase. Not yet tested with real money.

**Funnels are ready to execute on** in the sense that nothing is broken or placeholder — the gap isn't the funnel, it's what the funnel is currently allowed to sell (see pricing finding above) and what happens after checkout (see provisioning gap below).

---

## The thing that doesn't change no matter what tier or vertical: manual provisioning

There is still no automation connecting a Stripe payment to a real per-client Retell phone number and agent config. Every client — Starter, Pro, or Elite, any vertical — is provisioned by you, by hand, after they pay. This has been the most-repeated finding across every audit this project has had. Budget real setup time per client until this gets built (see `docs/possibilities/later-phase-ideas.md`).

---

## Before you take real money — the actual checklist

1. ~~Fix the Pro/Elite feature list on the pricing page~~ — done 2026-07-11.
2. Decide Rex/Nova rollout for the 6 verticals where they're still "planned" — either build them out or make sure Pro-tier pricing for those verticals doesn't promise something Starter already includes.
3. Flip Stripe to live mode when ready (see `stripe_live_mode_prep` notes — direct-curl signature testing technique, Vercel env var masking behavior).
4. Confirm the `/onboarding-complete` Payment Link redirect (still unresolved as of the last check).
5. Have your manual provisioning steps written down somewhere repeatable — even a checklist in `docs/sop/` — before the first real client, since there's no automation for it yet.

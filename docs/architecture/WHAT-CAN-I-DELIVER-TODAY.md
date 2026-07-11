# What Can I Actually Deliver Today
**Ground truth as of 2026-07-11. Read this before a sales call, before flipping Stripe to live, before quoting a feature.**

> Companion to `369-SYSTEM-BLUEPRINT.md` in this folder — that one explains the architecture, this one answers "if someone pays right now, what do they actually get."

---

## The short version

You can sell and deliver the **Starter tier ($400/mo + $1,500 setup) honestly, today, for roofing/HVAC/plumbing** — 24/7 call answering plus follow-up and confirmation emails, fully live and verified on real calls. Everything past that — Pro, Elite, and every other vertical's follow-up/confirmation layer — has a real gap between what the pricing page promises and what's built. **Fix that before Stripe goes live**, not after.

---

## 🔴 New finding — the pricing page itself overclaims (found while writing this doc)

`lib/tier-config.ts` — the file that literally drives the checkout page and Stripe line items — lists these as included features:

- **Pro ($600/mo):** "Lead scoring & prioritization," "Conversion tracking," "Advanced reporting"
- **Elite ($750/mo):** "Review request automation," "AI review response drafting," "Reputation score monitoring," "Referral tracking"

None of these exist anywhere in the codebase. No lead-scoring logic, no conversion-tracking system, no review-platform integration, no reputation monitoring, no referral tracking. This isn't a marketing-copy issue on a landing page — it's the actual paid tier definition rendered on the real pricing page (`components/verticals/VerticalPricing.tsx` reads `tier.features` directly).

**Why it hasn't bitten you yet:** Stripe is still in test mode — confirmed via `.env.local` (`sk_test_...`), matching your own choice to stay in test mode. No real customer has paid for a tier that overpromises. But the moment Stripe goes live, someone can pay $750/mo for Elite and get Starter-plus-a-generic-follow-up-email, not review automation or reputation monitoring.

Separately: `PREMIUM_ADDONS` in the same file (Live Call Transfer $49, Branded Caller ID $29, Spanish Support $79, Custom Voice $99, HIPAA Pack $99) is dead code — defined but never rendered on the actual pricing page, so it's not currently sellable. Lower priority, but same root problem if it ever gets wired up before being built.

**Recommendation:** Before live-mode Stripe, either (a) strip the unbuilt bullets from Pro/Elite and reprice around what's actually different — right now Pro's only real differentiator is Rex/Nova being live instead of "planned," and Elite has no real differentiator at all — or (b) actually scope and build the smallest honest version of one of these (review-request automation is probably the most learnable/buildable of the four). Your call which; I'd lean (a) first since it's a copy fix, not a build, and keeps you sellable immediately.

---

## What's real, right now, per tier

| Tier | Price | What's actually included |
|---|---|---|
| **Starter** | $400/mo + $1,500 setup | Ava answers calls 24/7, qualifies, books. Real-time dashboard. HD call quality (real Retell feature). Daily email summary. |
| **Pro** | $600/mo | Everything in Starter, **plus Rex/Nova follow-up + confirmation email — but only for roofing, HVAC, plumbing.** For every other vertical, Pro is currently identical to Starter with a higher price tag. Lead scoring / conversion tracking / advanced reporting: not real. |
| **Elite** | $750/mo | Everything in Pro, plus premium voice quality and Retell's built-in caller analytics (real). Review automation / reputation monitoring / referral tracking: not real. |

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

1. Fix the Pro/Elite feature list on the pricing page (the finding at the top of this doc) — highest priority, this is the literal thing customers pay against.
2. Decide Rex/Nova rollout for the 6 verticals where they're still "planned" — either build them out or make sure Pro-tier pricing for those verticals doesn't promise something Starter already includes.
3. Flip Stripe to live mode when ready (see `stripe_live_mode_prep` notes — direct-curl signature testing technique, Vercel env var masking behavior).
4. Confirm the `/onboarding-complete` Payment Link redirect (still unresolved as of the last check).
5. Have your manual provisioning steps written down somewhere repeatable — even a checklist in `docs/sop/` — before the first real client, since there's no automation for it yet.

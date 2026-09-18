# Pre-Stripe Tier Fixes — Status & Priorities (updated 2026-09-18)

Companion to `docs/vs-claude-handoff-tier-fixes.md`. That brief is the spec; this is where things stand.
Work is on branch **`fix/pre-stripe-tier-claims`** (not merged, not deployed). Nothing charges via Stripe until this is done.

## Done and committed on the branch
- Voice quality: one line on all tiers; unused `retellConfig` removed; retail-value fields/helpers removed from `tier-config.ts`
- Custom BI bullet + $49 badge + the "bundled Retell features" callout removed; analytics line on all tiers
- Starter: "Weekly summary email"; monthly ROI report removed from Starter, FAQ, agent pages, homepage, 12 landing pages
- Live Call Transfer rendered **COMING SOON** — **copy not final, see Priority 0**
- Rex follow-up: phone-only leads no longer retry forever — check is now "no email AND SMS can't go out (unconfigured OR no consent)", pure + tested (`lib/rex-channel.ts`), and the step advances only once the owner alert is actually sent
- `VerticalROICalculator.tsx`: dead retail-value total removed, **plus two false claims next to the Buy buttons**: "2 spots remaining this month" (invented scarcity, shown on all 12 verticals) and "One-time setup: $1,500" (`SETUP_FEE` is 0)
- Welcome email feature list now derived from `tier-config` (it promised a Review Request Agent, daily summaries, "$25/$49 value, included free")
- Removed the `auto-activation` "Upgrade to Elite: Reviews Agent" upsell — no such agent exists
- FAQ: follow-up is email only for now
- `/api/auto-activation` now requires `Authorization: Bearer $CRON_SECRET` on GET and POST and **fails closed** when the secret is unset (verified locally: no header, wrong secret and `Bearer undefined` all 401; the authorised path was not run because it writes notification rows to production)
- "Full HIPAA compliance" removed from `AgentTeamGrid.tsx` (2 places) and `public/dental-leads`; no HIPAA claim remains in the code. HIPAA stays off until legal review.
- `PREMIUM_ADDONS` / `PremiumAddon` **deleted** from `lib/tier-config.ts` (zero importers, no Stripe price, no UI path). The old definitions — including the $49 Live Call Transfer, $79 Spanish and $99 Custom Voice/HIPAA prices — are recoverable from git at `0c358b7`. **For Cowork:** `docs/ROADMAP.md` (lines 15, 512) and `docs/PHASE-2-ROADMAP.md` (line 13) still describe it as the home for future add-ons; those references are now stale.

## Priority 0 — Live Call Transfer (findings, decision is Chris's)
Live probe (`scripts/retell/probe-transfer.mjs`, read-only, through each agent's own `response_engine`):
- **1 of 12 agents has a `transfer_call` tool: Northside (the only Elite subscription).** `transfer_to_owner`, warm transfer, 30s ring, private handoff prompt, destination = its `owner_phone`.
- The 9 vertical templates, the demo agent and the audit caller have none — by design: provisioning adds it at clone time, only when the purchase is Elite and a phone was given.
- Real evidence: exactly **one** of Northside's 26 calls ended `call_transfer` (2026-07-14). Nothing since.
- **Unproven since:** the fleet moved to `gemini-3.5-flash` (2026-08-21) and Northside became a rental agent. The tool is still present, but no call has exercised it on the current model/prompt.
- So the changelog is right that it worked, and the first audit was wrong that it doesn't exist. The honest gap is: works per-client at provisioning, once verified, not re-verified, no routing rules (emergency / VIP / everyone-else), no path to add it to an existing client who upgrades.

## Still to do
- Decide the Live Call Transfer copy. Options: keep COMING SOON; or "Live Call Transfer" after one re-verification call on Northside.
- Re-verify: one real call to Northside +1 (817) 612-6757, ask for a person, confirm the owner's phone rings.

## Known, for later
- **`send-monthly-roi-reports` is deliberately unscheduled, not forgotten.** Its banner explains: it uses invented per-vertical `JOB_VALUE` numbers and would email clients a dollar figure nobody measured. Adding it to `vercel.json` is the *last* step, after (1) the client's own average job value is read from their record, (2) every figure states its assumption, (3) the rental verticals exist in it.
- **"Dentrix integration"** is still claimed on `AgentTeamGrid.tsx` and `public/dental-leads`. `lib/integrations/dentrix.ts` exists but needs `DENTRIX_API_URL`/`DENTRIX_API_KEY`, which are not configured, and it is only read by `email-ingest`. Not touched — Chris's call whether the claim stays while dental is FUTURE.
- Twilio A2P 10DLC registration takes days to weeks; start early if SMS is wanted.

## Still owed as written reports (not code)
- Which voice and provider each agent actually uses
- Daily summary email — effort estimate (reuse the Monday digest)
- ROI report scoping, including the cron and the onboarding "average job value" question
- Elite scoping — section 4 of the brief, all items, with code vs. config vs. service-only
- Vendor BAA findings — section 5

## Off-limits until then
Stripe. Nothing charges until the copy matches the product.

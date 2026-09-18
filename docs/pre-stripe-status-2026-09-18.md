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
- ~~Which voice and provider each agent actually uses~~ — done, see Reports
- ~~Daily summary email — effort estimate~~ — done, see Reports
- ~~ROI report scoping~~ — done, see Reports
- Elite scoping — section 4 of the brief, all items, with code vs. config vs. service-only
- Vendor BAA findings — section 5

## Off-limits until then
Stripe. Nothing charges until the copy matches the product.

## Reports

*Written by Claude Code (Sonnet 5). Facts below were re-derived from live systems on 2026-09-18, not from earlier docs; each names the probe that produced it.*

### 1. Voice and provider — what a caller actually hears
Probe: `scripts/retell/probe-voices.mjs` (read-only; `agent.retrieve` per agent plus `voice.retrieve`).

- **All 12 agents use the same voice: `retell-Marissa`.** Provider `platform` (Retell's own voice, not ElevenLabs/Cartesia/OpenAI), `voice_type: standard`, `voice_model` left at Retell's default, `language: en-US`, temperature 1. Speed is 1.0 everywhere except the audit caller (1.1, chosen by ear).
- It is identical on every tier, every vertical, the demo line and Northside. **Nothing distinguishes a Starter caller's voice from an Elite caller's.**
- **What this does to the pricing line "Premium natural voice (featured upgrade)":** the voice is real and Chris judged it natural by ear, but Retell itself labels it `standard`, and there is no lower voice for it to be an "upgrade" over. "Premium" and "featured upgrade" are not backed by anything in the system.
- **Recommendation (Cowork/Chris to decide):** say "Natural-sounding voice" and drop "premium" and "featured upgrade". The claim then matches what every caller hears on every tier. It also stops the line implying tiers differ when they don't.
- Consequences for Elite scoping (report 4): Spanish and Custom Voice are both unbuilt — every agent is en-US on one shared platform voice.

### 2. Daily summary email — effort, and what it must not inherit
Source read: `app/api/cron/weekly-digest/route.ts` (scheduled Mondays 13:00 UTC in `vercel.json`).

**Mechanics are small: about half a day.** Parametrise the 7-day window, add a daily `vercel.json` entry (daily is allowed on Hobby), retitle the email, add tests. Reusing the template is easy. **The work is what the template does today, which a daily send would repeat 7x as often:**

1. **The weekly digest is already emailing an invented dollar figure.** "Estimated revenue protected" = (booked + captured) × a hardcoded `JOB_VALUE` table (roofing 2500, hvac 350, …) × 30%. It is the same table whose use keeps the monthly ROI cron deliberately unscheduled. **It is live today.** Only Northside has been sent it (the only activated subscription with an email — verified 2026-09-18), so no real client has received it yet, but the first one will. The pricing page now advertises this email as the "Weekly summary". **Recommend removing that tile until report 3 lands** (Cowork/Chris to decide; I did not change it).
2. **The nag copy breaks on a one-day window.** "No calls received last week" would fire every quiet day and every weekend; "low call volume" is `< 5`, meaningless per day. Needs day-appropriate rules, or a send-only-when-there-is-activity decision.
3. **Existing timezone bug:** "after-hours" uses `getHours()` on the server (UTC on Vercel) against a hardcoded 8–18, not the business's timezone. Wrong today for the weekly send too; the same bug class as the bare-timestamp lesson in `CLAUDE.md`.
4. **No idempotency, and a drifting window.** A cron that runs twice sends twice, and `now − 24h` overlaps or gaps by however late Hobby fires it ("within the hour"). Anchor to the previous full local day and stamp a sent marker per client per day (a small table or column — a migration Chris applies).
5. **No per-client cadence.** Starter is now "weekly"; a daily tier needs a preference column (migration) or a tier check.
6. **Footer promise:** "Chris responds within 2 hours." A service commitment nobody has agreed to; flag for Cowork.
7. **Resend volume** at one email per client per day — plan limits not verified here.

**Recommendation:** do not switch any copy back to "Daily" until 1–4 are done. Realistic total with tests and a migration: 1 day, gated on Cowork's calls on items 1, 2 and 5.

### 3. ROI report — scoping (including the cron and the job-value question)
There are **three** different "ROI" surfaces and only the first is sound:
- **Prospect calculators** (12 pages + `/api/send-roi-report`) — driven by the visitor's own slider numbers, assumption stated on screen, verified 2026-08-21. Fine.
- **Weekly digest tile** — invented `JOB_VALUE`, live. See report 2.
- **`send-monthly-roi-reports`** — invented `JOB_VALUE`, unscheduled on purpose, 9 vertical keys (no rental verticals), hardcoded `MONTHLY_COST` 400/600/750 (duplicates `tier-config`).

**The brief says "add 'What's your average job value?' to the questionnaire". It is already there** — `client_questionnaires.avg_job_value` (TEXT), a dropdown on `app/onboarding/questionnaire/[domain]/page.tsx`. **It is not usable as-is, for three reasons:**
1. **It is a preselected default.** The form starts on `'$2,000–$5,000'`, so a client who never touches it stores a value they did not choose, indistinguishable from a real answer. This is the recurring lesson: *a required value with no truthful option produces a false one.* Needs no default and a "not sure" escape.
2. **It is a band string** (`'$500–$2,000'`, `'$10,000+'`), not a number. A report cannot multiply a band, and `$10,000+` has no upper bound.
3. **Real data is thin:** 2 rows in production — Northside `'$500–$2,000'` (a roofing-form answer on a rental test agent) and a sandbox `null`. Nothing to migrate that is worth trusting.

**Proposed build:**
- Questionnaire: numeric input, no default, blank = "not asked" (null). Parse with the same rules as `lib/intake-payload.ts` (unreadable → null never 0; out-of-range → null never clamped), with tests. Keep the TEXT column for the knowledge-base prompt text.
- New numeric column on `client_questionnaires` — **a migration Chris applies** (no `DATABASE_URL` here).
- Report: read the client's own number. **If null, omit the revenue section entirely** and send counts only. Delete `JOB_VALUE`.
- **Define the 30% once.** The digest calls it `RECOVERY_RATE` (share of *missed* calls recoverable); the monthly report calls it a "30% close rate" on answered leads. Same number, two meanings. Neither is measured. Any figure must state its assumption on screen.
- Source of truth for counts: the `bookings` table (26 rows) rather than `calls.call_outcome`, which only ever holds `booked` / `captured_lead` (76 calls, verified).
- Cron: last step. Add to `vercel.json` (`0 14 1 * *`) only after the three preconditions in the route's own banner, plus rental verticals and `MONTHLY_COST` read from `tier-config`.

**Effort:** questionnaire + parsing + tests ~0.5–1 day; report rewrite + tests ~1 day; cron + verification ~0.25 day. **Only one activated client exists (Northside, a rental test agent),** so the first real verification would be against a demo, not a customer.

**Decisions for Cowork/Chris:** does a client-facing report show a dollar figure at all, or counts only? My recommendation: counts by default, plus one clearly-labelled line "at your stated average job of $X" only when they gave one.

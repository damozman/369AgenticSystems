# Pre-Stripe Tier Fixes — Status & Priorities (updated 2026-09-18, end of session)

Companion to `docs/vs-claude-handoff-tier-fixes.md`. That brief is the spec; this is where things stand.
**MERGED (PR #51, master `3c3b715`) and LIVE as of 2026-09-18.** Nothing charges via Stripe until this is done.

## ✅ LIVE — 2026-09-18
PR #51 merged to `master` (`3c3b715`) and is serving on 369agenticsystems.com. Verified against the live site, not the deploy log: the homepage carries "Weekly summary email and a live dashboard" (old monthly-ROI line absent); the pricing bundle carries "Natural-sounding voice" and COMING SOON, "featured upgrade" absent; `/api/auto-activation` returns 401 on GET and POST; zero 5xx/error log lines in the following hour. **The invented "Estimated revenue protected" tile is out of production**, ahead of the next digest send (Mondays 13:00 UTC, next 2026-09-21).
- **Deploy path:** Vercel's Git integration deployed the merge automatically (`vercel[bot]`, ~2 min after the merge). CLAUDE.md's old "no Git integration" note was wrong and is corrected. A manual `vercel --prod` also ran and was redundant.
- **`/api/auto-activation` fail-closed:** no caller in the repo, `vercel.json` or any migration; the signup path does not touch it; logs (about an hour retained) show only our own probes. A hand-configured external caller can't be ruled out from here — it would appear as 401s (`npx vercel logs --environment production -q auto-activation`).

## Decisions (Chris, 2026-09-18)
1. Weekly digest: counts only, no revenue tile. **Done on branch.**
2. Voice copy: "Natural-sounding voice" on all tiers, no "premium" / "featured upgrade". **Done in code.** (Docs `vs-claude-handoff-tier-fixes.md` and the report below still quote the old line as history.)
3. Daily summary email: **not building.** Starter stays "Weekly summary."
4. ROI report: counts by default; a dollar line **only** when the client gave their own number, labelled as theirs. **Not started — waiting for the go-ahead.** Scope is in Report 3.
5. Elite: **Spanish, custom voice and multi-location are OUT.** No further scoping. Elite design goes to a separate session with Chris.
6. "Within one business day" replaces "within 2 hours". **Done in code.**
7. `/api/auto-activation` authentication and the HIPAA copy removal stand as committed.
- **The Resend/HIPAA problem also goes to that separate session** (Report 5). Nothing is being built for it here.

## Done and committed on the branch
- Voice: every tier says **"Natural-sounding voice"** (no "premium", no "featured upgrade" — every agent uses one standard platform voice); unused `retellConfig` removed; retail-value fields/helpers removed from `tier-config.ts`
- Custom BI bullet + $49 badge + the "bundled Retell features" callout removed; analytics line on all tiers
- Starter: "Weekly summary email" (stays weekly — daily is not being built); monthly ROI report removed from Starter, FAQ, agent pages, homepage, 12 landing pages
- Live Call Transfer rendered **COMING SOON** — **HELD: copy stays as is until Chris's own test call, see Priority 0**
- Rex follow-up: phone-only leads no longer retry forever — check is now "no email AND SMS can't go out (unconfigured OR no consent)", pure + tested (`lib/rex-channel.ts`), and the step advances only once the owner alert is actually sent
- `VerticalROICalculator.tsx`: dead retail-value total removed, **plus two false claims next to the Buy buttons**: "2 spots remaining this month" (invented scarcity, shown on all 12 verticals) and "One-time setup: $1,500" (`SETUP_FEE` is 0)
- Welcome email feature list now derived from `tier-config` (it promised a Review Request Agent, daily summaries, "$25/$49 value, included free")
- Removed the `auto-activation` "Upgrade to Elite: Reviews Agent" upsell — no such agent exists
- FAQ: follow-up is email only for now
- `/api/auto-activation` now requires `Authorization: Bearer $CRON_SECRET` on GET and POST and **fails closed** when the secret is unset (verified locally: no header, wrong secret and `Bearer undefined` all 401; the authorised path was not run because it writes notification rows to production)
- "Full HIPAA compliance" removed from `AgentTeamGrid.tsx` (2 places) and `public/dental-leads`; no HIPAA claim remains in the code. HIPAA stays off until legal review.
- `PREMIUM_ADDONS` / `PremiumAddon` **deleted** from `lib/tier-config.ts` (zero importers, no Stripe price, no UI path). The old definitions — including the $49 Live Call Transfer, $79 Spanish and $99 Custom Voice/HIPAA prices — are recoverable from git at `0c358b7`. **For Cowork:** `docs/ROADMAP.md` (lines 15, 512) and `docs/PHASE-2-ROADMAP.md` (line 13) still describe it as the home for future add-ons; those references are now stale.
- **Weekly digest: "Estimated revenue protected" tile removed** (it multiplied leads by an invented per-vertical `JOB_VALUE` table and a 30% rate). Counts only. `JOB_VALUE` and the `RECOVERY_RATE` import are gone from that route.
- **"Chris responds within 2 hours" → "within one business day"** in the weekly digest and the `send-roi-report` prospect email (the only two places in code).

## Priority 0 — Live Call Transfer (HELD — Chris is making the test call himself)
Live probe (`scripts/retell/probe-transfer.mjs`, read-only, through each agent's own `response_engine`):
- **1 of 12 agents has a `transfer_call` tool: Northside (the only Elite subscription).** `transfer_to_owner`, warm transfer, 30s ring, private handoff prompt, destination = its `owner_phone`.
- The 9 vertical templates, the demo agent and the audit caller have none — by design: provisioning adds it at clone time, only when the purchase is Elite and a phone was given.
- Real evidence: exactly **one** of Northside's 26 calls ended `call_transfer` (2026-07-14). Nothing since.
- **Unproven since:** the fleet moved to `gemini-3.5-flash` (2026-08-21) and Northside became a rental agent. The tool is still present, but no call has exercised it on the current model/prompt.
- So the changelog is right that it worked, and the first audit was wrong that it doesn't exist. The honest gap is: works per-client at provisioning, once verified, not re-verified, no routing rules (emergency / VIP / everyone-else), no path to add it to an existing client who upgrades.

## Still to do
- **Chris:** the Live Call Transfer test call — Northside +1 (817) 612-6757, ask for a person, confirm the owner's phone rings. Then decide the copy. Nothing changes until then.
- ROI report build — when Chris says go (Report 3). Nothing in the pricing copy may list it until it actually sends.

## Known, for later
- **`send-monthly-roi-reports` is deliberately unscheduled, not forgotten.** It uses invented per-vertical `JOB_VALUE` numbers and would email clients a dollar figure nobody measured. Adding it to `vercel.json` is the *last* step of the ROI build (Report 3), never before.
- **The weekly digest still has known defects** that were not in scope: "after-hours" uses server time (UTC) against a hardcoded 8–18 rather than the business's timezone; no per-client-per-week idempotency (a double-fired cron double-sends); the "no calls last week" / "low volume" nag copy fires on quiet weeks.
- **"Dentrix integration" on the web copy — CLOSED, it was already gone.** Re-derived 2026-09-18 (Cowork, Opus) rather than trusted from this doc's previous version. The sentence "Full HIPAA compliance + Dentrix integration" was removed from **both** `AgentTeamGrid.tsx` and `public/dental-leads/index.html` by the same commit `0c358b7` ("remove 'Full HIPAA compliance' from the dental waitlist copy") — the whole sentence went, not just the HIPAA half. `0c358b7` is an ancestor of HEAD. `git grep -i dentrix` now returns no customer-facing hit: only `lib/integrations/dentrix.ts`, its caller `app/api/email-ingest/route.ts`, and doc prose. The live `/dental-leads/` page was fetched and carries neither claim. The module still needs `DENTRIX_API_URL`/`DENTRIX_API_KEY` and they are still unconfigured — but nothing sold points at it, so there is no truthfulness debt here. No decision needed from Chris on the web copy.
- **The claim that survives is in `docs/sales-ops/msa-sow-template.md`, and it is the worse one.** The SOW promises "Integrate with Client's Dentrix system (patient record access)" and "Real-time Dentrix patient record lookup on each incoming email", and asks the client to "Provide Dentrix API credentials within 3 business days of signing". §6 states "Provider will access Client's Dentrix system"; §7 accepts Business Associate status and offers "a formal Business Associate Agreement (BAA) ... upon request"; the ongoing-services list routes "Response delivery via Resend". That is a signable document promising an unbuilt integration, PHI access, and a BAA, over the one vendor that will not sign a BAA on any plan. **Deliberately not reworded.** It cannot be fixed independently of the Resend/BAA decision and Chris's lawyer, so it is blocked on the Elite/HIPAA session rather than fixed now. Zero paying clients, nothing signed, so no present exposure.
- Twilio A2P 10DLC registration takes days to weeks; start early if SMS is wanted.

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
- **Decision (Chris, 2026-09-18): adopted — "Natural-sounding voice" on all tiers.**
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

**Decision (Chris, 2026-09-18): not building a daily email; Starter stays "Weekly summary." Items 1 and 6 (revenue tile, footer promise) were fixed on the branch; items 2–5 apply only if a daily send is ever revisited.**

**Original recommendation:** do not switch any copy back to "Daily" until 1–4 are done. Realistic total with tests and a migration: 1 day, gated on Cowork's calls on items 1, 2 and 5.

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

**Decision (Chris, 2026-09-18): counts by default; a dollar line only when the client gave their own number, labelled as theirs. Build not started.**

**Original question (now answered):** does a client-facing report show a dollar figure at all, or counts only? My recommendation: counts by default, plus one clearly-labelled line "at your stated average job of $X" only when they gave one.

### 4. Elite scoping (brief section 4)
**Decision (Chris, 2026-09-18): rows 4 (Spanish), 5 (custom voice) and 6 (multi-location) are OUT — no further scoping. The rest of Elite's design goes to a separate session with Chris; this table is input to it, not a plan.**

Legend: **Code** = new application code; **Config** = Retell/agent settings via a script; **Service** = Chris's time, no build. "Today" is what verifiably exists, derived 2026-09-18.

| # | Item | Type | Today | What it takes |
|---|---|---|---|---|
| 1 | **Live transfer + routing rules** | Code + Config | Transfer works per client at Elite provisioning (warm, private briefing, ring 30s) — one client, one call ever (2026-07-14), not re-proven on the current model. **No routing rules.** | *Emergencies → owner's cell:* mostly a prompt/tool-description change plus a test call. *VIP/known callers straight through:* needs a VIP list (new table + dashboard editor, migration), a lookup at call start (an inbound-call webhook returning dynamic variables — `call-received` is a post-call route, not this), and a prompt branch. *Everyone else books:* already true. **Also missing: an upgrade path** — templates carry no transfer tool; only a fresh Elite checkout adds one, so an existing Starter/Pro client who upgrades gets nothing. Needs a script like `set-rental-tools.mjs`. `ownerPhone` comes from the checkout phone field — confirm it is the owner's cell, not the purchaser's desk line. **~1 day for emergencies + upgrade path; +2–3 days for VIP.** |
| 2 | **Monthly strategy call** | Service | Nothing. Data exists in the portal (`/api/export-calls` CSV, `/api/search-transcripts`, dashboard analytics). | A one-page monthly summary for Chris to use on the call — either an export or a dashboard view (~1 day). **The constraint is Chris's calendar, not code:** every Elite client is one recurring hour a month. Capacity decision for Cowork/Chris. |
| 3 | **Ops-brief bundled in** | Service + Code | An **admin-only** tool: upload a spreadsheet → parse → metrics (`lib/ops-brief-*`, `/admin/ops-brief`). Chris runs it; **no client-facing view, no scheduling, no per-client delivery.** Backed by *test* tables (`2026-07-30-ops-brief-test-tables.sql`). | Deliverable today only as a manual service: Chris uploads the client's file and sends the result. Bundling it as a product means a client-facing view, production tables and repeatable delivery — a build, size not scoped here. Needs a definition of what "tells the owner what to do" means before sizing. |
| 4 | **Spanish included** | Config + QA | **Not working.** Every agent is `language: en-US` on `retell-Marissa`; prompts, greeting and TRAIGA disclosure are English. Retell's SDK supports `es-419`/`es-ES`/`multi` and arrays like `["en-US","es-ES"]`. | Set language, translate prompt/greeting/disclosure/SMS-consent sentence, pick a voice that speaks Spanish, and **test with a native speaker on real calls** (I cannot judge quality). ~1–2 days + QA. Do not advertise before a real Spanish call is heard. |
| 5 | **Custom voice included** | Config + Service | **Not working.** All 12 agents share one platform voice. `client.voice.clone()` exists in the SDK (from audio files). | Per client: collect audio, **written consent from the voice's owner**, clone, set `voice_id` on that client's agent. Provider cost/plan limits **not verified** — check Retell pricing before promising "included". ~0.5 day script + a consent process. |
| 6 | **Multiple locations / numbers** | Code (real) | **One of everything per client.** `client_domain` is UNIQUE on `agent_subscriptions`, `client_questionnaires`, `calendar_connections` and `client_schedules`; provisioning buys one number per checkout. | *Extra numbers, same business:* small — Retell `inbound_agents` can bind several numbers to one agent (~0.5 day + billing decision, numbers cost money). *True multi-location* (own hours, calendar, greeting, inventory per site): **a new subsystem** — a location dimension across schedules, bookings, calendars and prompts. Escalate to Opus; days to weeks. Do not promise "multiple locations" for the simple version. |
| 7 | **Priority changes ≤24h** | Service | Prompt sync exists (`sync-questionnaire-kb` cron, `mergePromptWithContext`, per-client scripts). | A commitment about Chris's response time; no code needed. Useful: a "request a change" form that emails Chris and stamps a received-at time (~0.5 day). |
| 8 | **Transcript search** | — | Exists (`/api/search-transcripts`); confirmed on real data per the changelog — **not re-verified this session**. | Nothing. |
| 9 | **ROI report** | Code | See report 3. | Blocked on job-value capture; do not list on Elite until it sends. |
| 10 | *Later:* **Review requests** | Code | **No code exists** in any vertical. | Needs a per-client review link (new field), a trigger on completed jobs, and consent. Email-only is possible without Twilio. |
| 11 | *Later:* **Performance guarantee** | Decision + tracking | `leads` and `bookings` are measurable per client. | Needs a signed definition of a qualifying lead, a baseline before go-live, and a legal review. Chris/Cowork/lawyer, not a build. |

**Cost check Cowork should have in front of them:** the model floor is roughly **$0.197/min** on Gemini (CLAUDE.md, measured 2026-08-21). Elite adds a monthly call (Chris's time) and transfer minutes, on $750/mo. Model that before adding Spanish or multi-number to "included".

**Open questions from the brief, still open:** Pro's price/features (`tier-config`: Pro is $600, email follow-up sequence + priority email support — the only Pro-only items are the follow-up sequence and email support, which is a thin gap to Elite until #1 is real); how many Elite clients to accept.

**Suggested order if Elite is rebuilt around the brief's three pillars:** (1) transfer re-verification + upgrade path → (2) monthly summary export → (3) ops-brief as a manual service, explicitly labelled a service. Everything else waits for a real Elite client asking.

### 5. Vendor BAAs (brief section 5 — research only, nothing built)
**SUPERSEDED IN PART, 2026-09-18 (Cowork, Opus) — see `docs/EMAIL-BAA-DECISION-2026-09-18.md`.** Re-fetching Resend's own pages did **not** reproduce the sentence quoted below: `resend.com/security` and `resend.com/enterprise` both now list HIPAA as **"In progress"** alongside completed SOC 2 and GDPR, and no HIPAA/BAA article exists in their knowledge base. No BAA is available from Resend today, so the practical blocker stands — but "never" and "in progress" are different facts, and Resend must be asked directly for a date. The four unresearched vendors (Anthropic, Google Calendar, Twilio, Retell's model provider) are now resolved in that doc, along with four email providers that will sign, two that will not, and the repo's real migration surface (19 client constructions, 27 send sites, no wrapper).

**CORRECTION TO THE NOTE ABOVE, 2026-09-18 (Claude Code) — the quoted sentence IS still on Resend's page.** Checked against the raw HTML of `resend.com/security`, not a summariser. The page carries **both** statements: a compliance badge reading **"HIPAA — In progress"**, and, in its FAQ (collapsed by default, and repeated in the page's JSON-LD `FAQPage` data, so a rendered-text fetch misses it), the answer to "Is Resend HIPAA and ISO 27001 compliant?": *"Resend is not HIPAA compliant and cannot sign a Business Associate Agreement. Resend holds SOC 2 Type II, not an ISO 27001 certificate."* `resend.com/enterprise` shows only the "In progress" badge. The two are consistent: **no BAA today, HIPAA on their roadmap.** So Report 5's quote stands as written, and section 0 of `docs/EMAIL-BAA-DECISION-2026-09-18.md` ("I could not reproduce that sentence") is wrong on that one point. The practical conclusion is unchanged — dental cannot go through Resend today, and asking Resend for a dated, written answer is still the right question. **For Cowork:** section 0 of the decision doc should say the sentence is present, not absent, so a reader does not conclude Resend retracted it.

**Decision (Chris, 2026-09-18): the Resend/HIPAA problem goes to a separate session with Chris. Nothing is being built here.**

Checked 2026-09-18 against each vendor's **own pages**. "Not stated" means the official page was fetched and does not say; I have not filled gaps from third-party blogs. **This is not legal advice; Chris is taking it to a lawyer.**

| Vendor | Signs a BAA? | Plan / cost per the vendor's own page | Conditions stated |
|---|---|---|---|
| **Retell** (voice, transcripts) | **Yes** — self-signed at click-agreements.retellai.com. [docs.retellai.com/general/compliance](https://docs.retellai.com/general/compliance) | "No additional fee." **Plan not stated on this page** (Retell's own blog says pay-as-you-go works without an enterprise contract — [source](https://www.retellai.com/blog/hipaa-compliant-voice-ai-without-enterprise-contract); confirm in the dashboard). | "A signed BAA is required before transmitting PHI." Per-agent data retention (1 day–2 years) and per-agent choice of what is stored (everything / exclude PII / basic attributes). |
| **Supabase** (database) | **Yes** — request via forms.supabase.com/hipaa2. [docs](https://supabase.com/docs/guides/platform/hipaa-projects) | **Not stated on the official page.** Third-party writeups say Team plan + a paid HIPAA add-on; **unverified — get a quote from Supabase.** We are on a plan below that today (unconfirmed). | Signed BAA **and** the HIPAA add-on; projects set to High Compliance: Point-in-Time Recovery (with a compute add-on), SSL enforcement, network restrictions, Postgres connection logging on. |
| **Vercel** (hosting) | **Yes** — self-serve paid add-on for Pro; Enterprise via account rep. [changelog](https://vercel.com/changelog/hipaa-baas-are-now-available-to-pro-teams) | Price **not stated** on that page. **We are on Hobby** (CLAUDE.md, 2026-08-25) — a Pro plan is required first. | Redlines to the standard agreement need Enterprise. Vercel: using it "doesn't automatically ensure compliance." |
| **Resend** (email) | **No.** [resend.com/security](https://resend.com/security): *"Resend is not HIPAA compliant and cannot sign a Business Associate Agreement."* | n/a — all plans. | — |

**What this means for our system (my reading — for Cowork/Chris/lawyer):**
1. **Resend is a hard blocker for dental as built.** Nova's booking confirmations, owner lead/booking alerts and Rex's emails all go through Resend and carry caller names, appointment details and (for dental) health-adjacent context. Serving a covered entity means moving those flows to an email provider that will sign a BAA, or stripping PHI from every email. That is a build, not a setting.
2. **Where PHI would live today:** Retell (calls, recordings, transcripts) → our webhook → Supabase (`calls`, `leads`, `bookings`, transcripts) → email (Resend) → the client's Google Calendar event. Three of those need a BAA and one cannot have one.
3. **Not researched, and also in the path:** Anthropic's API (Nova, Felix, email-ingest read caller data), Twilio (SMS, unconfigured), Google (Calendar events with patient names), and whichever model provider Retell routes to. Each needs its own answer before "HIPAA-ready" is a truthful sentence.
4. **Cost/plan escalation is real:** Supabase and Vercel both need paid tiers above what we run, per-client or not. Model it against the dental price before quoting.
5. **Copy:** "Full HIPAA compliance" is removed (this session). It should not return until every vendor above has a signed BAA and legal has reviewed.

**Status:** the HIPAA Compliance Pack add-on definition has been deleted from the code; nothing HIPAA-related is sold or claimed.

## Retell platform changes announced 2026-09 (from Retell's builder email)

**1. Credit-based billing from October 1st.** All accounts migrate automatically; usage is
deducted from a prepaid balance in real time. **Auto-recharge must be on before Oct 1.** A zero
balance means agents stop taking calls — for a product whose promise is "your phone always gets
answered", an empty balance is an outage at the client's front desk, not a billing inconvenience.
Chris to set this in the Retell dashboard.

**2. LLM prices dropped, effective immediately.** Voice, per minute:

| model | was | now | change |
|---|---|---|---|
| **Gemini 3.5 Flash** (our fleet today) | $0.0810 | **$0.0480** | −41% |
| **Gemini 3.6 Flash** (newer, not yet tested here) | $0.0690 | **$0.0240** | −65% |
| Gemini 3.5 Flash Lite | $0.0230 | $0.0096 | −58% |
| Claude 5 Sonnet | $0.0800 | $0.0640 | −20% |

**Our all-in cost floor moves from ~$0.197/min to ~$0.164/min** on the same model, no work
required. On Gemini 3.6 Flash it would be roughly **$0.140/min**, if it measures as well.

**3. Gemini 3.6 Flash is now half the price of what we run and is a newer model.** Worth a
benchmark, not a switch — this repo's rule is measure, don't assume, and the method already
exists: `set-client-model.mjs --only <agentId>` on one agent, then `call-latency.mjs`, comparing
llm p50, max, and turns over 3000ms against the recorded Gemini 3.5 Flash baseline
(935ms p50, 1363ms max, 0 of 23 over 3000ms). Chris judges the voice by ear, as before.
**Do not move the fleet on price alone** — GPT-5 was cheaper than Gemini and sounded wrong.

**4. Feeds the pricing work.** `OVERAGE_RATE_CENTS` (35/30/25¢) was set against a 13.1¢ floor and
the open item flagged Elite's overage margin falling to ~5¢/min at 19.7¢. At 16.4¢ — or 14¢ on
3.6 Flash — that margin recovers. Re-derive the rates in the same move as flipping
`USAGE_BILLING_ENABLED`, not before.

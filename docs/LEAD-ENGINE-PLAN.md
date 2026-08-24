# Lead Engine — Implementation Plan

## ⚠️ Session Handoff — Read This First

**Protocol, same as `CLAUDE.md`'s own:** update this section before ending any session with open
items, and read it first thing at the start of the next one. Replace it each time — a running
snapshot, not a changelog. Delete an item once it's actually resolved rather than marking it done.
This section is scoped to `feature/lead-engine` only; `CLAUDE.md`'s own Session Handoff is a
separate initiative on `master` (dossier / audit-calls) — do not conflate the two.

**Last updated: 2026-08-24.**

### Where this session ended

All 8 review fixtures signed off after an extended composition and background-rhythm pass —
tsc clean, 530 tests, `verify-lead-engine.mjs --live` all-pass (button contrast as painted + 320px
overflow), `mobile-audit.mjs` 216/216 clean. Everything is committed on `feature/lead-engine`;
nothing is merged to `master`.

### ▶ START HERE NEXT SESSION

Two things, in the order Chris named them:

1. **Photo pipeline — `docs/PHOTO-REQUIREMENTS.md`, Part B.** Not started. No code touched —
   `lib/lead-engine/limits.ts` and the upload route are still whatever they were before this
   thread began. **Before writing anything**, answer the two questions Chris asked and never got
   answered: sharp vs `heic-convert` for HEIC conversion, and whether either needs anything added
   to `next.config.mjs` or the Vercel build config. Part A (the customer-facing copy for
   onboarding) is finished and needs no further work — copy it in as-is when onboarding exists to
   copy it into.

2. **Chunk B — the real questionnaire, public lead form, notification, dashboard.** Read this
   doc's own "Q4 rewritten — 2026-08-24, Q11 removed, Q5 doing double duty" section in full before
   touching `lib/lead-engine/sections.ts` or `lib/lead-engine/content.ts` — it is a DESIGN, not a
   changelog entry, and skipping it will re-derive decisions that were already made and tested
   against a real rendered comparison. Specifically, it specifies:
   - 4a/4b as the two guaranteed Why-us prompts (4a doubles as the hero lede), Q5 (credentials) as
     an optional third feeding BOTH the proof bar and Why-us.
   - **Fixed "Credentials" label for Why-us item 3** — never pulled from the generic per-item
     array (`['Our promise', 'What you get', 'How we work', 'Peace of mind']`), which was proven
     wrong for a credential in every phrasing tested.
   - **The `"Holds "` / `"We are "` lead-in helper** for a bare credential value, and its two known
     rough edges (verb-detection is not "contains a verb-shaped word," and a single fixed prefix
     does not fit both name-shaped and status-shaped credentials) — both found by rendering the
     fix, not before shipping it. Do not re-derive these from scratch; the doc section has the
     worked examples.
   - **Two replacement tests**, not one deleted: the credentials-concatenation ban survives,
     generalised beyond "never in Why-us" specifically; a new test asserts Q5, when answered,
     renders as its own distinct item rather than merged into 4b's string.
   - `app/sites/[slug]/page.tsx`'s meta-description fallback (`content.differentiator ?? content.intro`)
     needs to point at 4a once Q11 is gone — a live loose end, not hypothetical.

   **Nothing above is wired into live code yet.** The Why-us pull-quote layout that shipped this
   session renders off the OLD single-`differentiator`-string sentence-splitting mechanism
   (`whyUsItems()` in `lib/lead-engine/sections.ts`), not the new 4a/4b/Q5 field structure. Chunk B
   is what makes that switch.

### What shipped this session — the short version

- **`bandPlan()`** (`lib/lead-engine/sections.ts`) — background-rhythm alternation computed from
  what will actually render, not hand-picked per section. Read its own doc comment before touching
  background placement in any template; it exists because the hand-picked version broke the first
  time an optional section (Coverage, on a customer with too few service areas) failed to render
  and left two chosen bands touching.
- **The editorial-hero fix** — Service Clean and Supply's hero carries no colour of its own (no
  photo half), so `bandPlan()` is seeded with `startingPaperRun: 2` on those two templates only,
  and `Services` is the one section made `bandable: true` as a one-off exception to the rule that
  Services stays paper everywhere else.
- **Four rendering bugs**, all found by measuring or screenshotting the live page, none by reading
  code: a shared CSS rule leaking the split-hero's viewport-relative padding into the editorial
  hero (mid-word headline break at wide viewports); `review-sparse`'s Why-us silently rendering
  nothing because its differentiator was exactly one sentence; the Showcase Grid proof bar
  stretching short content across the full bar width with `1fr` columns; a `max-content` fix for
  that same bar that then overflowed 320px because `max-content` refuses to wrap.
- **The Why-us single-column fallback**, redesigned as a pull-quote treatment rather than a
  shrunken copy of the 3-item layout — see this doc's own section for the full before/after and
  the reasoning Chris approved.

### Facts that would waste time re-deriving

- **The dev server wedges** (500s on every route, including static ones) after enough hot-reloads
  during a heavy file-editing session — happened twice this session. Kill and restart; do not try
  to diagnose it further, and do not `rm -rf .next` while it might still be running (safe to
  delete a single stale `.next/types/app/<route>` directory if a deleted route leaves tsc failing
  against a generated stub that no longer has a source file).
- **A Next.js route folder starting with `_` is excluded from routing entirely** — a throwaway
  preview page needs a plain folder name to be reachable at all.
- **A `loading="lazy"` image will not appear in a naive full-page Playwright screenshot** taken
  without scrolling first — reads as a rendering bug, isn't one. Verify against the raw HTML
  (`<img src=...>` present with a real URL) before concluding a gallery is actually empty.
- **All 8 review fixtures are draft-status, preview-gated, and swept by `verify-lead-engine.mjs`'s
  `--sweep` flag** — they do not reach production regardless of `LEAD_ENGINE_PREVIEW`. Re-seed with
  `node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs --apply`
  any time fixture content or rendering changes; the URLs are always `/sites/review-<name>` for
  trade-classic, threshold, service-clean, showcase-grid, practice, supply, brand-fail, sparse.

---

## Context

Chris is adding a second product line: **Lead Engine** — a fixed-scope mini-site + lead form +
light customer dashboard for local service businesses, at $297/$497 setup + $69/month. It must
stand alone (fully useful with no Ava), reuse the existing auth/dashboard/Supabase/email
patterns, and leave a clean seam for activating Ava later.

Why now: distribution finally exists (chamber network, ~mid-September event). Lead Engine is a
lower-friction thing to sell in that room than a voice agent, and it creates the relationship
that makes Ava an upsell rather than a cold pitch.

All work on **`feature/lead-engine`**. `master` is not touched.

---

## What the repo actually does today (verified, not assumed)

These constrain every decision below.

| Area | Reality |
|---|---|
| Tenant identity | `agent_subscriptions.client_domain` (TEXT UNIQUE) + `user_email` vs JWT email. No `client_id` anywhere. The `clients` table is dead — `lib/client-identity.ts` says so. |
| Subscriptions | Voice-shaped: `vertical NOT NULL`, `tier CHECK IN ('Starter','Pro','Elite')`, and `lib/onboard-client.ts:110` **buys a Retell number** before writing the row. |
| Domains | **No host/subdomain handling exists.** Zero hits for `host` header reads, `nextUrl.hostname`, or `rewrites(`. `client_domain` is a lookup string, never routing. |
| Storage | **No Supabase Storage usage anywhere.** Greenfield. |
| `leads` table | Call-shaped: `call_id REFERENCES calls(id)`, `caller_phone NOT NULL`. Unusable for web submissions. |
| RLS | `USING (true) TO authenticated` on every portal table; the real boundary is app-code filters. `2026-07-24-...-PROPOSED.sql` is unapplied. |
| Email | Resend, instantiated inline in ~16 places. No shared wrapper. `resendFrom()` (`lib/email-from.ts`) is mandatory. `escapeHtml` from `lib/security/sanitize.ts`. |
| Portal guard | `middleware.ts` — `ADMIN_ONLY_PREFIXES` **and** `config.matcher` are two separate lists that must agree. |
| Token links | `lib/security/onboarding-token.ts` (HMAC, expiry inside the signed payload) + `lib/security/questionnaire-auth.ts` (signed-link OR owner-session). `app/dossier/review/[id]` is the public-signed-page precedent. |
| Build | `next.config.mjs` has `ignoreBuildErrors: true` — **the build catches no type errors.** `npx tsc --noEmit` is a required manual gate. |
| Tests | `npm test` → `node --test lib/**/*.test.ts`. 338 today. Parameter properties do not run under the resolver. |
| Commerce | Stripe is test mode, sole webhook **disabled**. A live-site checkout provisions nothing. |

Route-name landmines: `app/` already owns `agents, api, auth, book-demo, dental, dossier,
dumpster-rental, equipment-rental, event-rentals, founding, hvac, insurance, legal, onboarding,
onboarding-complete, plumbing, privacy, real-estate, roofing, saas, terms, wholesale`. `/` is
`app/route.ts` serving `public/index.html`. A `public/x/` and an `app/x/` collide and Next wins.
Root `templates/` already exists (CSV data), so template components go in `components/lead-engine/`.

---

## Decisions (Chris, 2026-08-23)

1. **Identity** — new `lead_engine_sites` with its own UUID + `owner_email` + `slug`, plus a
   **nullable `client_domain`** that stays null until Ava is activated. `agent_subscriptions` is
   not modified; the `clients` table is not revived.
2. **URL** — path-based `/sites/[slug]`. No subdomain or custom-domain work in v1; both can
   later be a rewrite onto this same route.
3. **Purchase** — admin-created, invoiced by hand. No webhook changes, no public self-serve
   checkout, **no public Lead Engine pricing page in v1.**
4. **Photos** — Supabase Storage, public bucket, limits enforced **server-side** in the upload
   route.
5. **RLS** — real per-tenant policies on `lead_engine_*` only, plus the existing `is_369_admin()`
   carve-out. Existing tables' RLS is untouched and the PROPOSED migration is **not** applied here.
6. **Limits** — 12 photos, 5MB each; 2 included revisions within 30 days of launch, further ones
   billable; a quarterly 3–5 photo refresh included in the monthly fee.
7. **Delivery** — three staged chunks on one branch, each ending at a point Chris can look at
   real output.

---

## Three template concepts (for review before Phase 2)

All three render **the same data** through the same section primitives, carry the same lead form
and footer contract, and are mobile-first single-column under 640px. They differ in section
**order and emphasis**, not in capability — which is what keeps three templates maintainable.

**1. Trade Classic** — photo-forward, credentials-first.
Hero (photo + business name + CTA) → trust bar (years in business · licenses · service areas) →
services → gallery → what makes us different → lead form → footer (phone, Google profile).
*Suits:* roofing, HVAC, plumbing, tree work, concrete — where a customer wants to see the work
and the licence before they call.

**2. Service Clean** — copy-forward, low-photo.
Hero (headline + CTA, no large image) → what we do (text cards) → why us (differentiators +
guarantees) → service areas → lead form → footer.
*Suits:* legal, insurance, consulting, cleaning — businesses with few good photos, where a
photo-hungry template looks worse than no photos at all.

**3. Showcase Grid** — inventory-forward.
Compact hero → gallery grid **first** → services/packages → areas served → lead form → footer.
*Suits:* event & party rentals, equipment rental, dumpsters — where "what have you got" is the
actual buying question.

A site with no photos must **degrade to Service Clean's layout automatically** rather than
render empty frames. Absence of a photo is not a reason to show a placeholder.

---

## The questionnaire (Chris's agreed list, tightened)

1. Business name **and** primary phone number.
2. What services do you mainly offer? *(3–8 repeatable lines)*
3. What cities or areas do you serve?
4. Two short prompts, replacing the single open-ended differentiator field below — see
   "Q4 rewritten" immediately after this list.
   - **4a.** What's one thing you do that other [vertical] businesses typically don't?
   - **4b.** What's the first thing customers usually say about you?
5. Any guarantees, licences, or certifications customers should know about? *(feeds both the proof
   bar and, when answered, a third Why-us item — see "Q4 rewritten")*
6. Roughly how long have you been in business?
7. Preferred main call-to-action — Call Now / Get a Free Estimate / Check Availability / Other.
8. Google Business Profile link *(with an "I can't find it" option that shows how to look it up —
   never a required field)*.
9. Do you have photos we can use? *(yes → upload step; no → the site uses the low-photo layout)*
10. Biggest current pain points getting or handling new customers?

**Two operational fields I am adding, flagged for your veto:**
- **Where should new lead notifications go?** (email; defaults to the account email). Without it
  the product's core promise has no destination.
- **Preferred web address** — proposed slug, pre-filled from the business name, editable.

**Q10 is for us, not the site.** Pain points are sales intelligence and the Ava wedge; they must
never render on the public page. This is written into the content mapper and asserted in a test.

### Q4 rewritten — 2026-08-24, Q11 removed, Q5 doing double duty

**The problem this fixes.** The single open-ended Q4 ("What makes you different…") plus the
catch-all Q11 ("Anything specific you want visitors to know or feel…") were the only two inputs
feeding the Why-us section, and both invite a ONE-SENTENCE answer — that's the natural register
for an open text box on a form. `whyUsItems()` takes Q4's first sentence as the hero lede and
whatever sentences remain across Q4 and Q11 as Why-us's content; a one-sentence Q4 with a skipped
Q11 leaves Why-us with nothing to say. Reviewing eight fixtures against real Q4/Q11 copy showed
three of eight landing on exactly two items — not a thin-fixture accident, a predictable consequence
of what these two prompts actually ask for.

**The fix is two narrower prompts plus one field doing double duty, not three new fields.**
Chris's revision, 2026-08-24: the guarantee/policy prompt (the original draft's 4b) sat close
enough to Q5 that it was a duplicate wearing different words, and the fix for a duplicate field is
to remove it, not to word around the overlap. Q5 already collects exactly that kind of answer —
it just answers a different QUESTION on the page (the proof bar's "is this a real, credentialed
business") than Why-us does ("why should I pick them"). One answer, reused honestly in both slots,
is simpler than two fields fighting over the same sentence.

- **4a** — *"What's one thing you do that other [vertical] businesses typically don't?"* The
  differentiator proper. Its answer becomes the hero lede, exactly as Q4's first sentence does
  today — `heroLede()` reads 4a directly instead of splitting a longer string.
- **4b** — *"What's the first thing customers usually say about you?"* Pulls a real,
  externally-observed impression rather than a self-assessment — different enough in kind from 4a
  that a customer is unlikely to answer both with the same sentence.
- **Q5** — unchanged wording, unchanged job feeding `credentials` and the proof bar. **New second
  job**: when a customer has answered it, it also becomes a third Why-us item. When they haven't,
  Why-us has two items and stops there — it does not invent a third to hit a round number.

**Mapping.** 4a and 4b are the two GUARANTEED Why-us sources — a customer who answers the
questionnaire at all produces both, since neither is skippable the way Q5 is. Q5 is the OPTIONAL
third: present whenever the business has stated a credential, absent otherwise. This is not a
fallback in the sense Q11 was (supplying filler when the guaranteed fields ran short) — it is the
same fact appearing in its two natural places, a stat in the proof bar and a sentence in Why-us,
because a real credential is legitimately relevant to both questions a visitor is asking.

**What this means for the layout.** Two items (4a, 4b only) is now the FLOOR, not an edge case —
every customer who answers the two guaranteed prompts gets it, which is exactly the shape the
2026-08-24 fallback redesign below was built for. Three items (Q5 also answered) gets the
multi-column layout. There is no longer a path to fewer than two items, short of a customer
skipping 4a or 4b outright — which the same missing-lede reasoning that made Q4 required in the
first place already covers: no 4a, no hero, no page.

**Credentials read twice — settled 2026-08-24, against a real rendered comparison, not guessed.**
Checked by rendering the actual `WhyUs` multi-column markup with three real credential shapes
("Class A CDL", "EPA certified", "Better Business Bureau A+ rated") as item 3, both bare and with a
lead-in, on the real Ironclad kit. Two findings, both from that rendering, not from reasoning about
it:

1. **The lead-in wins every time, not case-by-case.** All three read as a spec-sheet fragment bare,
   sitting oddly beside two full first-person sentences; all three read as a peer sentence with a
   lead-in. Chris's call: **always give a bare credential a subject and verb**, via a formatting
   helper (`"Holds " + value`) rather than trusting future customers to phrase Q5 as a sentence
   themselves.
2. **Item 3's label was the bigger problem, and it is independent of phrasing.** The multi-column
   layout's per-item label comes from a fixed array — `['Our promise', 'What you get', 'How we
   work', 'Peace of mind']` — and index 2 is always "How we work." "How we work: Class A CDL."
   does not answer that question in any of the six variants rendered; the label is simply wrong
   for credential-sourced content, independent of how the sentence itself is phrased. **Chris's
   call: item 3 gets a FIXED label, "Credentials"** (matching the proof bar's own name for the same
   field) rather than pulling from the generic array when the item's source is Q5.

**Two rough edges in the `"Holds " + value` helper, found rendering the fix, not before shipping
it.** Worth a note for whoever builds this rather than silently absorbing them:

- **"Has no verb" is not quite the right test.** "EPA certified" and "…A+ rated" both contain a
  past-participle ("certified", "rated") that a naive verb check would treat as "already has a
  verb" — but both still read as fragments bare, and both read better with a lead-in in the actual
  comparison. The rule that matches what was actually seen is closer to "does the value already
  open with a subject and an auxiliary or finite verb" (starts with "I", "We", "Is", "Are", "Has",
  "Have"…) than "does the value contain any verb-shaped word anywhere."
- **One fixed prefix does not fit every credential SHAPE.** `"Holds " + value` reads naturally for
  a licence/certification NAME — "Holds Class A CDL." — but not for a STATUS or RATING phrase:
  "Holds EPA certified." and "Holds Better Business Bureau A+ rated." do not parse. Those two read
  naturally with "We are " instead, which is what actually shipped in the approved comparison
  render, not the literal "Holds " prefix. A single fixed string cannot cover both shapes; whoever
  builds this needs at least a name-shaped-vs-status-shaped distinction, not one template.

**The old test is replaced, not deleted — two tests, testing two different things.** Chris's
instruction, 2026-08-24: removing "CREDENTIALS NEVER APPEAR IN A WHY-US ITEM" outright would also
un-ban the actual bug it was written for. The bug and the new feature are different in kind and
both need coverage:

1. **The concatenation ban survives, generalised.** The original bug was string concatenation with
   no separator — `differentiator + credentials + intro` joined and split on sentence boundaries,
   so "Licensed and insured in Texas" glued onto the front of whatever followed with no punctuation
   between them. That failure mode has nothing to do with WHERE credentials are allowed to
   appear — it is about never building a sentence by gluing two fields together and hoping a period
   was there to split on. Keep a test asserting `credentials` text is never found concatenated into
   another item's string with no separator, wherever `credentials` legitimately appears now.
2. **A new test for the new feature.** When Q5 is answered, assert it renders as its own distinct
   array entry / DOM element — not appended to 4b's string, not merged with it, a genuinely separate
   item. This is the test that would have caught the old bug's SHAPE even if the old bug's specific
   mechanism no longer exists, and it is the one that documents the new, intentional design rather
   than merely permitting it by the old test's absence.

Whoever builds Chunk B writes both before wiring Q5 into `whyUsItems()`'s replacement, not after.

**Q11 is removed, not merged.** Its only job was supplying extra sentences when Q4 came up short;
4a/4b plus Q5's second job no longer need a backstop — between the two guaranteed prompts and one
optional real credential, there is nothing left for a catch-all field to fill in. One loose end:
`app/sites/[slug]/page.tsx`'s meta description currently falls back to `content.intro` (Q11) when
`differentiator` is absent — `const description = content.differentiator ?? content.intro`. With
Q11 gone, that fallback should point at 4a instead (the closest surviving equivalent) when this is
actually built; flagged here so whoever builds Chunk B does not have to re-derive it.

**Numbered 4a/4b rather than renumbering 5–11 to 6–12.** Q10's identity is already referenced by
number elsewhere — `LEAD-ENGINE-DESIGN-BRIEF.md` cites "questionnaire Q10" directly, and the
pain-points test asserts against that same name. A full renumber would go stale outside this file
without anyone touching the file that actually changed.

---

## Schema — `supabase/migrations/2026-08-23-lead-engine.sql`

Four tables. `owner_email` is the tenant boundary; every child scopes through `site_id`.

**`lead_engine_sites`** — `id uuid pk` · `owner_email text not null` · `slug text unique not null`
· `business_name text not null` · `status text check ('draft','awaiting_answers','in_build','live','suspended','cancelled') default 'draft'`
· `template text check ('trade_classic','service_clean','showcase_grid')`
· **`client_domain text NULL`** — the Ava seam; null means "no voice product"
· `questionnaire jsonb` · `content jsonb` · `notify_email text` · `revisions_used int default 0`
· `launched_at` · `cancelled_at` · `created_at` · `updated_at`.

**The two-jsonb split is load-bearing.** `questionnaire` holds the customer's raw answers;
`content` holds what actually renders. An admin edit lands in `content`; a re-submitted
questionnaire updates `questionnaire` and **flags the site for review** — it never rewrites
`content` and never silently changes a live page. This repo has paid for the opposite twice
(the questionnaire deactivating unseen inventory; `mergePromptWithContext` discarding prompt
text). Two writers, one of which thinks it is alone, is a data-loss bug waiting for a date.

**`lead_engine_submissions`** — `id` · `site_id uuid not null references lead_engine_sites(id) on delete cascade`
· `name` · `email` · `phone` · `message` · `service_interest` · `status text default 'new'`
· `notified_at timestamptz` · `notify_error text` · `created_at`.
`notify_error` exists because a notification failure that reaches no human is the same as a lost
lead — the exact 2026-07 outage shape.

**`lead_engine_photos`** — `id` · `site_id` (cascade) · `storage_path text not null` · `caption`
· `sort_order int` · `bytes int` · `content_type text` · `created_at`.

**`lead_engine_change_requests`** — `id` · `site_id` (cascade) · `body text not null`
· `status text check ('open','done','declined')` · `billable boolean default false`
· `resolved_at` · `created_at`.

RLS on all four: `SELECT`/`UPDATE` where the row's site has `owner_email = auth.jwt()->>'email'`,
`OR public.is_369_admin()`. Server writes go through the service-role client and bypass it —
the policies are the backstop, not the only gate. Submissions get **no anonymous INSERT policy**:
the public form posts to a server route, never to PostgREST.

**Storage bucket `lead-engine-photos`** — public read, service-role write. Created by hand in the
Supabase dashboard alongside the migration (DDL cannot run from a script here — no `DATABASE_URL`).

Every route must survive the tables not existing yet, because schema and code always go live
separately in this project.

---

## Files

**New — lib (pure, tested):**
- `lib/lead-engine/types.ts`
- `lib/lead-engine/slug.ts` + `.test.ts` — derive/validate a slug, reject reserved words.
- `lib/lead-engine/content.ts` + `.test.ts` — questionnaire answers → renderable content.
  **Omits any section with no data; never invents one.** Asserts pain points never reach output.
- `lib/lead-engine/limits.ts` + `.test.ts` — photo count/size, revision quota, 30-day window,
  quarterly refresh eligibility. Pure decisions, no I/O — the `lib/billing.ts` shape.
- `lib/lead-engine/site.ts` — `createSite()` / `loadSiteBySlug()` / `publishSite()`. `createSite()`
  is written as a standalone function so a Stripe webhook can call it later without a rewrite.
- `lib/lead-engine/notify.ts` — owner lead notification via `resendFrom()` + `escapeHtml`.

**New — routes:**
- `app/sites/[slug]/page.tsx` — public renderer, `force-dynamic`. 404s on a non-live site.
- `app/api/lead-engine/submit/route.ts` — public form POST. **Only reports success once the row
  is committed** (the `/api/intake` contract, deliberately the inverse of `/api/early-access`).
- `app/lead-engine/questionnaire/[id]/page.tsx` — token-gated form.
- `app/api/lead-engine/questionnaire/[id]/route.ts` — GET saved answers + POST submit, behind
  one shared authorizer (the `lib/security/questionnaire-auth.ts` lesson: two copies of an auth
  check is how one ends up weaker).
- `app/api/lead-engine/photos/route.ts` — POST upload / DELETE, limits enforced here.
- `app/api/lead-engine/change-request/route.ts` — POST.
- `app/(portal)/client-dashboard/site/page.tsx` — customer view (already covered by
  `/client-dashboard/:path*`).
- `app/(portal)/admin/lead-engine/page.tsx` + `[id]/page.tsx` — list + edit (already admin-guarded).

**New — components:** `components/lead-engine/templates/{TradeClassic,ServiceClean,ShowcaseGrid}.tsx`,
`SiteSections.tsx` (shared primitives), `LeadForm.tsx`, `Gallery.tsx`, `PhotoUploader.tsx`.

**Reused, not rebuilt:** `lib/security/onboarding-token.ts` (mint/verify against the site id as
subject — a fourth token module is not worth it; documented in place, and it means
`ONBOARDING_TOKEN_SECRET` now protects two products), `lib/security/sanitize.ts`,
`lib/email-from.ts`, `lib/supabase-admin.ts`, `lib/supabase-server.ts`, `lib/admin.ts`,
`components/portal/PortalShell.tsx`.

**Modified — exactly two existing files, both small:** `components/portal/Sidebar.tsx` (one `NAV`
entry) and `supabase/schema.sql` (append the new tables so the file stays the reference).
`middleware.ts` needs **no** change — `/sites`, `/lead-engine` and `/api/lead-engine` are public
by design, and both portal paths sit under prefixes already matched.

---

## Delivery — three chunks, one branch

**Chunk A — Phases 1–2.** Migration, types, `site.ts`, `/sites/[slug]`, three templates.
*Verification point:* Chris opens a real seeded site on all three templates and reads it as a
customer would.

**Chunk B — Phases 3–5.** Questionnaire (token-gated), public lead form + owner notification,
customer dashboard section (submissions, counts, change-request form).
*Verification point:* Chris fills the questionnaire from a real emailed link and submits a real
lead, and the notification arrives.

**Chunk C — Phases 6–7.** Photo upload + gallery, internal admin list/edit so a site goes from
answers to live with no raw SQL. Quarterly refresh is a **`limits.ts` function only** — no cron
in `vercel.json` (the brief's non-goal, and there are already 10).
*Verification point:* Chris delivers one real site end to end.

---

## Verification

- `npx tsc --noEmit` — mandatory; the build ignores type errors.
- `npm test` — new pure-logic tests in `lib/lead-engine/*.test.ts` must pass alongside the 338.
- `scripts/verify-lead-engine.mjs` (new, committed) — against production Supabase and the real
  routes: schema probe, create a throwaway site, submit a lead through `/api/lead-engine/submit`,
  assert the row and the notification path, upload past the photo cap and assert refusal, then
  sweep every row it wrote. **Refuses to touch any site with `status = 'live'`.**
- `node scripts/mobile-audit.mjs` with `/sites/<slug>` added — Chris's own rule: do not reason
  about breakpoints instead of running it.
- **Read the artifact, not the code that made it.** Before Chunk A closes, render a real site and
  read the page as its visitor; before Chunk B closes, read the lead notification email as the
  business owner receiving it. This project's last two shipping defects were only visible that way.

## Truthfulness constraints, carried into the templates

No template may claim SMS, instant quoting, deposits, or booking — none exist, and Twilio is
unconfigured in every environment. The lead form's success screen promises exactly what happens:
the business gets an email. No pricing, no minute limits, and no Lead Engine price point appears
on any public page in v1 — it is sold in the room and invoiced by hand.

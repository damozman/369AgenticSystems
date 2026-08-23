# Lead Engine — Implementation Plan

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
4. What makes you different from other companies that do the same work?
5. Any guarantees, licences, or certifications customers should know about?
6. Roughly how long have you been in business?
7. Preferred main call-to-action — Call Now / Get a Free Estimate / Check Availability / Other.
8. Google Business Profile link *(with an "I can't find it" option that shows how to look it up —
   never a required field)*.
9. Do you have photos we can use? *(yes → upload step; no → the site uses the low-photo layout)*
10. Biggest current pain points getting or handling new customers?
11. Anything specific you want visitors to know or feel when they land on the page?

**Two operational fields I am adding, flagged for your veto:**
- **Where should new lead notifications go?** (email; defaults to the account email). Without it
  the product's core promise has no destination.
- **Preferred web address** — proposed slug, pre-filled from the business name, editable.

**Q10 is for us, not the site.** Pain points are sales intelligence and the Ava wedge; they must
never render on the public page. This is written into the content mapper and asserted in a test.

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

# Lead Engine — Implementation Plan

## ⚠️ Session Handoff — Read This First

**Protocol, same as `CLAUDE.md`'s own:** update this section before ending any session with open
items, and read it first thing at the start of the next one. Replace it each time — a running
snapshot, not a changelog. Delete an item once it's actually resolved rather than marking it done.
This section is scoped to `feature/lead-engine` only; `CLAUDE.md`'s own Session Handoff is a
separate initiative on `master` (dossier / audit-calls) — do not conflate the two.

**Last updated: 2026-08-25 (third session that day).**

### Where this session ended — 2026-08-25, third session

**Design item 1 is built: Forge and Counsel are real `template × theme` pairs, wired to the
verticals Chris's split names.** Both published mockups were read end to end and used as the spec.
`npx tsc --noEmit` clean apart from the known `xlsx` container failure, **579 tests** (577 + 2),
`verify-lead-engine.mjs` style check clean.

**Chris applied `2026-08-25-lead-engine-headline-noun.sql`** — the hero noun is live, that item is
gone from this list.

#### What shipped

1. **`forge` — a seventh kit, and the only one allowed a structural reversal.** Deeper navy
   structure (`#17222F`), the hotter accent (`#E4551D`), 6px card / 3px button radius and a real
   two-layer elevation, against Ironclad's flat-and-square. Type is Ironclad's, unchanged: the
   difference is chrome, colour and elevation, not the faces.
2. **The vertical split.** Trades (7) and rentals/hauling (4) resolve to `forge`. Templates are
   untouched — a rental yard still leads with a grid, in Forge's identity rather than Yard's.
   **Ironclad and Yard are now unmapped but still in `THEMES`**, deliberately: they stay
   operator-selectable and any live row carrying one must keep rendering as it did. Removing a kit
   is a migration question, not a design one.
3. **Forge's chrome, which is the part that answers "very generic".** A palette swap alone would
   have left the page in exactly the shape Chris objected to. Three things changed that no token
   can express, so they sit behind a new `data-theme` hook on `ThemeShell` — the only per-kit
   selector in the stylesheet, and it should stay that way:
   - dark sticky header
   - the split-anchor hero becomes **full-bleed under a scrim** — same DOM, `.le-hero-media` lifted
     out of the grid, so the no-photo fallback to `HeroEditorial` is untouched
   - the proof bar in the accent (`le-proof-band` on the two Forge templates' proof sections)
4. **Counsel gains ONE photograph — design item 2, inseparable from item 1.** `HeroEditorial` takes
   an optional `photo` in columns 8–12; the proof facts move to a hairline row directly beneath,
   **inside the hero element**. That placement is load-bearing: `heroCarriesProof(template)` is what
   tells `sectionCount` this template has no proof section, and making that predicate depend on
   whether a customer uploaded a photo is exactly the drift its own doc forbids. With no photograph
   every line renders as it did before — verified in a browser, not by reading.
   `TEMPLATE_RENDERS_GALLERY.service_clean` stays **false**; the two rules that had been collapsed
   ("must survive with zero photos" ≠ "must never show photos") are now separated in the doc there.

#### 🔴 A real bug the kit found: four of seven kits painted accent TEXT below 4.5:1

`.le-eyebrow`, `.le-tel`, the footer links and the focus outline all coloured text from
`--le-accent-derived`. In `surface_only` that token **equals the accent by design and by test** —
that mode means "the original works as a FILL", and derived is corrected for the fill. Measured on
each kit's own accent, no customer override involved:

| | accent on its own paper | now |
|---|---|---|
| yard | **1.97** | 4.66 |
| forge | **3.43** | 4.72 |
| clinic | **3.82** | 4.50 |
| ironclad | **3.96** | 4.71 |

Same shape as the bug `accentModeFor` already documents one function down — a kit's own accent
failing on a page nobody had measured. The fill half was fixed then; this is the text half.

Fixed with a **third token, `--le-accent-text`**, rather than by redefining `accent_derived`: the
two genuinely answer different questions, which is why the Forge mockup itself carries both an
`--accent` and an `--accent-txt`. `accent_derived`'s tested semantics are unchanged. Guarded by a
test over every kit, so an eighth kit cannot ship this again.

**One place the mockup is wrong and the validator is right:** the mockup sets the proof band's
labels white on the orange. That is ~3.4:1. The band uses `--le-ink`, which is what
`data-accent-mode="surface_only"` already concluded for every other fill on the page.

#### Corrections to the previous handoff — design item 3 was already done

It listed two placement bugs as "fixed in the mockups; neither is fixed in the real templates yet."
**Neither exists in the real templates.** `SiteContent` has no email field at all
(`lib/lead-engine/types.ts`), `contentFrom` never reads `notify_email`, and the footer renders
business name, phone and Google profile only — `notify_email` reaches `notify.ts` and nothing else.
The wordmark is already `logo_url ?? business_name` verbatim. Both were bugs in the mockup HTML,
not in the templates it was standing in for. **Item 3 is deleted from the list below rather than
carried.**

## ▶ START HERE NEXT SESSION

**Chunk C proper still has NOT started, and still waits on Chris's scope conversation.** Do not
start the uploader or the admin page without it.

**Approved and NOT yet built — what is left of the design work:**

1. ~~**Forge's services mosaic**~~ — **BUILT 2026-09-01.** `servicesLayout` gains `mosaic`,
   `mosaicSpans` / `mosaicPlan` decide the tiles, `Services` renders them, Trade Classic opts in.

   **It is opt-in, and NOT keyed off the kit.** Four templates share `servicesLayout`; a photo
   mosaic of "practice areas" is wrong for a law firm. And `data-theme` is deliberately bounded to
   paint and chrome on identical markup — a mosaic is different markup, so driving it from `forge`
   would quietly turn a theme into a layout.

   **The mosaic needs half the photos the ladder does, which is the whole point.** A ladder row
   without an image is broken; a mosaic tile without one is a deliberate colour block. So it renders
   in the band where the ladder cannot (half the services up to all of them) and where the
   two-column list would throw every photo away. Widest tiles take photographs first — a flat block
   at feature size reads as a missing image, at one column it reads as intent.

   **`ladderRows`/`.ladder` on the allocator are renamed `serviceSlots`/`.services`**, because a
   field called `ladder` feeding a mosaic is the misleading-name trap this repo already has a
   lesson for.

2. ~~**"Fixed copy" is template-scoped**~~ — **BUILT 2026-09-01, and the plan item was WRONG.**
   It is not template-scoped. `service_clean` serves legal, insurance, accounting, consulting AND
   **cleaning**, so scoping an attorney-client disclaimer to that template prints it on a cleaning
   company's website. The need follows the VERTICAL.

   Which the schema deliberately cannot answer, since `createSite` does not store the vertical — so
   the same solution as the headline: `VERTICAL_FOOTER_NOTES` supplies a default at creation and the
   RESOLVED text is stored as `footer_note`, operator-overridable, nullable, null being the common
   case. **`supabase/migrations/2026-09-01-lead-engine-footer-note.sql` is APPLIED** (Chris,
   2026-09-01), as is `-headline-noun.sql`.

   **⚠ Both columns are now SELECTED BY NAME in `SITE_COLUMNS`, so a schema/code mismatch takes out
   every mini-site at once rather than degrading one field.** `loadSiteBySlug` asks PostgREST for
   `headline_noun, footer_note`; a missing column errors the whole query and the page 404s. That is
   the highest-consequence failure mode in this change. **Check it with one query, not a page
   load:**
   ```sql
   select column_name from information_schema.columns
    where table_name = 'lead_engine_sites' and column_name in ('headline_noun', 'footer_note');
   ```
   Two rows means both applied, which is the whole question — a missing column is the only way
   `SITE_COLUMNS` breaks.

   **Do NOT check this on production.** Production runs `master`, whose `SITE_COLUMNS` does not name
   either column, so it renders identically either way and proves nothing. (Equally: adding nullable
   columns cannot break it, so the migrations carried no risk to the live site.) And a preview page
   load has two unrelated ways to 404 that look like a schema fault: `previewEnabled()` needs
   `LEAD_ENGINE_PREVIEW === 'true'` **baked in at build time** or an `in_build` site is filtered
   out, and previews are SSO-protected so `curl` gets 401.

   **The override is worth as much as the default.** A roofer needs no disclaimer but often needs a
   state contractor licence number in the footer — something no map can know. Same field.

   **The health notes disclaim advice and say nothing about privacy**, asserted by a test: a claim
   about how data is handled has to be true of the system handling it, and this form's handling is
   the same as every other vertical's.

   **🔴 CHRIS'S CALL 2026-09-01: the shipped notes are PLACEHOLDERS.** *"I would consider them
   placeholders and if not needed at the time we will adjust."* So they are not settled legal text
   and must never be treated as reviewed — they are a default that saves typing, confirmed or
   cleared per site at build time.

   **What that means for the admin create/edit page when it is built (Chunk C item 2):** the
   footer-note field must be presented as REQUIRING confirmation, not prefilled and forgotten. A
   default nobody reads is still a claim on a law firm's website, and clearing it is one keystroke
   — `footerNote: ''` stores null deliberately, which is why absent and empty are kept distinct in
   `createSite`.

3. **`cleaning` is mapped to `service_clean` × `counsel`, the LAW FIRM kit.** Raised, not fixed. A
   cleaning company's buying question is "can I trust you in my house", which is the trade
   question, not the professional one. It did NOT move to Forge in this session's split, because
   Chris's split names trades and rentals/hauling and cleaning is in neither list — worth settling
   deliberately rather than by inclusion.

**Two things seen while reading the rendered pages, neither introduced this session, both worth a
look and neither urgent:**
- **The display font falls back to `Georgia, serif` on every kit.** Fine for Counsel, Threshold and
  Clinic; for Forge, Ironclad, Yard and Ledger a failed webfont load renders a trades site in a
  serif. One shared fallback stack across seven kits is the cause.
- **In the ZERO-photo editorial hero, the stacked facts sit flush against the next section.**
  `.le-hero-facts` is `align-self: end` and gains no bottom padding of its own, so on
  `counsel-no-photos` the last fact's baseline lands on the band edge. Cosmetic, unchanged by this
  session, visible on `review-sparse` too.

**A defect the tests could not have caught, found by rendering it.** The first mosaic CSS had a
two-column state between 640 and 900px, and at six services it produced rows filling 100%, 49%,
100%, 49%, 100%, 49% — three half-empty rows, the exact failure the span table exists to prevent,
reintroduced at the tablet breakpoint. **A 2-column grid can only fill perfectly when the count is
even**, so there is now deliberately NO two-column state: three columns, then one. Measured, not
eyeballed — tile bounding boxes summed per row, for every count 3-6 at nine widths from 320 to
1440. Screenshotting alone would have missed it; the ragged row is only obvious if you know to
look at the tablet width.

**How the rendering was checked**, since `--live` needs Supabase credentials the cloud container
does not have: the templates were rendered offline to static HTML with `react-dom/server` and
screenshotted in the pre-installed Chromium at 1440, 390 and 320px — five cases (Forge trade, Forge
showcase, Counsel with photos, and both zero-photo fallbacks), no horizontal scroll at 320 on any
of them. **The harness was deliberately not committed**: it duplicates fixture data that
`seed-lead-engine-review.mjs` already owns, and a second copy of that data is the two-writers shape
this repo has been bitten by twice. **Re-run `verify-lead-engine.mjs --live` locally before the
deploy** — this session could not.

**Still true from earlier sessions, unchanged:** the five photo-uploader requirements from the
Miller Storm run are Chunk C item 1 and are recorded in full further down. Both mockup URLs remain
the spec for anything Forge or Counsel:
- **Forge** — https://claude.ai/code/artifact/8f36454e-9535-458a-8e41-509ed2968646
- **Counsel** — https://claude.ai/code/artifact/9ca925d6-7434-4fc7-bb00-9532b0569cd9

**🔴 THE RULE, unchanged and still the important part:**

> Every string on a generated site is either **derived from a questionnaire field** or **fixed copy
> that asserts nothing**. There is no third category.

**⚠ Environment note for cloud sessions:** `npm install` FAILS in Claude Code's remote container.
`xlsx` is served from `cdn.sheetjs.com`, which the network policy denies with a 403 on CONNECT.
The five resulting `lib/ops-brief-parse.ts` type errors are the workaround, not the code. **Re-run
`npx tsc --noEmit` locally before any deploy.**

### Chunk B build detail (2026-08-24) — kept for reference, not current state

**Verified two independent ways, both real, neither skipped:**
1. **By hand, in a browser, by Chris** — not by me. He opened the real questionnaire at
   `/lead-engine/questionnaire/<real fixture id>`, changed a real field, saved, hard-refreshed, and
   screenshotted the change surviving the refresh. He then submitted the real lead form on
   `/sites/review-trade-classic`, screenshotted the resulting email landing in his own
   `chris@369agenticsystems.com` inbox with the correct business identity, submitted content, and
   `Reply to` pointed at the prospect's own address rather than his. This is the verification that
   actually matters — the live script below proves the HTTP contract, this proves a human can use it.
2. **`scripts/verify-lead-engine.mjs --live`**, after three real bugs it surfaced were fixed (below)
   — full clean run, zero failures, confirmed by Chris pasting the actual terminal output rather
   than a summary.

**Three real bugs found chasing this session's verification, all fixed, all worth reading before
touching this code again:**

1. **`lib/lead-engine/questionnaire-auth.ts` imported `NextResponse` at module scope**, which pulls
   in `next/server` — unresolvable outside Next's own bundler
   (`ERR_MODULE_NOT_FOUND: next/server`). This broke the verify script's ability to import
   `questionnaireUrl()`, a function with no Next.js dependency of its own, purely because it lived
   in the same file as functions that do. **Fixed by splitting it out** to
   `lib/lead-engine/questionnaire-url.ts` — the same separation the voice product already draws
   between `lib/security/onboarding-token.ts` (script-safe) and
   `lib/security/questionnaire-auth.ts` (route-only). This project's own file didn't follow its own
   precedent the first time; a script hitting the boundary head-on is what caught it.
2. **The verify script's own GET calls hit the wrong URL.** `questionnaireUrl()` returns the
   PUBLIC PAGE (`/lead-engine/questionnaire/[id]`, HTML) — the script was fetching that and calling
   `.json()` on it, which silently fails and resolves to `{}` via a `.catch(() => ({}))`. This read
   as "the questionnaire write isn't landing / is stale" for THREE separate live runs, and burned a
   real `export const dynamic = 'force-dynamic'` fix (still a legitimate hardening, kept) on a
   theory that turned out to be wrong. The actual bug was the test hitting the wrong URL the entire
   time. Fixed by building a separate `apiUrl` pointing at `/api/lead-engine/questionnaire/[id]`.
   **The lesson:** when a live script disagrees with a live human's own click-through (Chris's
   manual test worked correctly throughout this whole saga), suspect the test before the app.
3. **The throttle-exhaustion test sent 21 real emails across four `--live` runs, not one.** To prove
   the 6th submission gets refused, the test fired `SUBMIT_THROTTLE_MAX - 1` additional REAL POSTs
   through the actual route — every one a genuine, non-honeypot submission, notified on exactly like
   a real customer's. Chris caught this by asking directly whether `--live` sends real mail, and
   confirmed 21 messages landed in his own inbox between 5:34–5:59 PM across the four runs chasing
   bug #2 above. **Fixed by seeding the other `SUBMIT_THROTTLE_MAX - 1` rows with a direct database
   insert** rather than routing them through the app — still proves the real question (does request
   N+1 get refused with 429?) without manufacturing N-1 real notification sends to ask it. Re-run
   live afterward: exactly one `sent at` line, one email, screenshotted and confirmed.
   **Cleanup independently proven, not just trusted**, with two SQL queries Chris ran himself
   against production: zero `lead_engine_sites` rows matching `verify-lead-engine-%`, and zero
   `lead_engine_submissions` rows whose `site_id` points at a site that no longer exists. Both came
   back empty. The mechanism (a `finally`-block delete cascading via the `ON DELETE CASCADE` FK) was
   always going to make this true, but "the script says it cleaned up" and "an independent query
   confirms nothing is left" are different claims, and only the second one is proof.

**What actually shipped, in build order:**

1. **The Q4/Q5 content-model rewrite** this doc's own "Q4 rewritten — 2026-08-24" section
   specified — done first because Chunk B's questionnaire has nothing to write into `content`
   without it. `QuestionnaireAnswers.differentiator` (4a) and the new `customer_impression` (4b)
   replace the old single open-ended differentiator paragraph; `visitor_message`/`SiteContent.intro`
   (Q11) is deleted outright, not merged. `heroLede()` now reads 4a verbatim — no more
   sentence-splitting, since 4a is a single short-answer prompt, not a paragraph.
   `whyUsItems()` returns `[4a, 4b, credentials?]`, in that order; the new `credentialWhyUsLine()`
   helper gives a bare Q5 credential a subject and verb ("Class A CDL" → "Holds Class A CDL.",
   "EPA certified" → "We are EPA certified.") using a word-boundary match against a fixed list of
   status participles, checked BOTH ends of the string — the doc's own worked examples only checked
   the trailing end, which broke on "Licensed and insured in Texas" (a real, common fixture value)
   until this session's own test caught it. The credential item never appears alone — only once at
   least one of 4a/4b is present — so a synthetic content object with only `credentials` set (an
   existing unrelated test built exactly that) can't earn its own Why-us section.
   `WhyUs` in `SiteSections.tsx` gives item index 2 the fixed label "Credentials" rather than
   pulling from the generic `['Our promise', 'What you get', ...]` array, since item 2 is now
   ALWAYS the Q5-sourced line by construction. All 8 review fixtures in
   `scripts/seed-lead-engine-review.mjs` rewritten to the 4a/4b shape — every `differentiator` is
   now a single sentence, every fixture gained a `customer_impression`. **Re-seeded to production
   later the same session** (Chris ran it himself) — the live `review-*` rows now hold the new
   shape, confirmed via the live verify script's own render checks.
2. **The Chunk B library layer** — `lib/lead-engine/notify.ts` (owner lead-notification email,
   `notify_email` falling back to `owner_email`, mirrors `/api/intake`'s never-throws contract),
   `lib/lead-engine/questionnaire-auth.ts` (signed-link-or-owner-session, reusing
   `lib/security/onboarding-token.ts`'s primitives with the site UUID as the signed subject —
   **enforces immediately, no reporting-only rollout**, unlike the voice product's version, because
   this route has never shipped before and so has no existing producer to break), and five new
   functions on `lib/lead-engine/site.ts` (`loadSiteForQuestionnaire`, `saveQuestionnaireAnswers`,
   `loadSiteForOwner`, `listSubmissions`, `listChangeRequests`).
3. **The routes**: `POST /api/lead-engine/submit` (public, the `/api/intake` contract — only
   reports success once the row is committed), `GET`+`POST /api/lead-engine/questionnaire/[id]`
   (one shared authorizer for both, per this doc's own file-list note), `POST
   /api/lead-engine/change-request` (owner-session only, reuses `photo-storage.ts`'s
   `resolveOwnedSite` rather than a third ownership check).
4. **The public questionnaire form** — `app/lead-engine/questionnaire/[id]/page.tsx`, same
   load-then-populate-then-enable-submit shape as the voice product's onboarding form, covering the
   full Chris-approved Q-list. **Scope cut, on purpose:** the practice-only extension questions
   (Q9–Q11 — accepting patients, insurance, hours, team, first-visit info) are NOT in this form yet.
   The API route's `parseAnswers()` already accepts them if posted; only the UI is missing. Nothing
   in Chunk B's file list called for a vertical-conditional form, and the site row doesn't carry its
   vertical after creation (only the resolved template/theme) — so showing them would mean either
   threading the vertical through at creation or branching on `template === 'practice'`. Deferred
   rather than guessed at.
5. **The real lead form** — `components/lead-engine/LeadForm.tsx` replaces the inert
   `LeadFormPlaceholder` Chunk A shipped, wired into all five templates with an added `siteId` prop
   threaded from `app/sites/[slug]/page.tsx`. Same four fields, same `.le-field`/`.le-submit`
   classes — no visual change to a page Chris already reviewed, just an onSubmit that works. Email
   required, phone optional (mirrors `/api/intake`'s "the email is what makes a lead actionable").
   `service_interest` is not collected in v1 — the DB column exists and stays null.
6. **The customer dashboard** — `app/(portal)/client-dashboard/site/page.tsx` (submissions list,
   `decideRevision()`'s own message, a change-request form) plus `ChangeRequestForm.tsx`. Lead
   Engine has no Sidebar nav entry (deliberately deferred to Chunk C, alongside the admin list page
   that will actually need one) — reached instead via a new redirect in the EXISTING
   `client-dashboard/page.tsx`: a customer with no `agent_subscriptions` row is now checked against
   `lead_engine_sites` before falling through to the "No active subscription" dead end, so a
   Lead-Engine-only customer (no Ava) can reach their dashboard at all, per this doc's own "must
   stand alone" requirement.
7. **`scripts/verify-lead-engine.mjs` extended, not replaced.** This file already existed —
   Chunk A's own style-drift gate (no hardcoded hex/font/radius/shadow under
   `components/lead-engine/`) plus its live schema/render/button-contrast/320px checks. **A first
   draft of this session's work overwrote it wholesale** — caught before being reported as done, by
   noticing `git status` showed it `M` (modified) rather than `??` (new) and diffing against `HEAD`.
   Restored, then extended with a THIRD job: create one throwaway site, round-trip the
   questionnaire through the real GET/POST routes (including a bad-token 403 check), submit a real
   lead through `/api/lead-engine/submit`, assert the notification path resolved one way or the
   other (never silent), then sweep the throwaway row. Runs under the existing `--live` flag,
   writes nothing under the `review-` prefix the rest of the script reads.
   **The lesson, restated because it nearly repeated itself:** a file that already exists is a
   claim about prior work, and `git status` before trusting a Write to a non-empty path is the
   ten-second check that catches it — the exact shape of this project's own "re-derive from the
   live system" rule, applied to a local file instead of a database.
8. **One real bug the merged style-check caught immediately**: the new `.le-form-error` CSS used a
   literal `#FCA5A5` for validation-error text. Fixed by adding `--le-danger` (`#DC2626`,
   `theme.ts`) as a sixth kit-identical token alongside the existing type-scale and rhythm
   constants — an "invalid" signal is a UX convention, not a brand decision, so it is NOT per-kit
   like `--le-accent`. `theme.test.ts`'s `REQUIRED_TOKENS` list updated to match.

The admin test page (`/admin/lead-engine-photos`) is still there, admin-gated, harmless to leave —
delete it whenever Chunk C's real dashboard photo uploader makes it redundant, not before.

### ▶ START HERE NEXT SESSION

**Merge decision is RESOLVED: merged.** PR #48 → `master` at `d18b1d0`. Work continues on
`feature/lead-engine-chunk-c`, cut from `master` after the merge — the old `feature/lead-engine`
branch is superseded, do not build on it.

**The real run Chris said he'd do is DONE — see "Where this session ended" above for the full
account.** Miller Storm went through questionnaire → 14 photos → hand-built content → a verified
rendered page. **Still do not start Chunk C build work until Chris explicitly says to begin** —
the run being finished produced the requirements below, which is what it was for; it is not itself
the go-ahead to start building them. The list below is no longer a pre-run hypothesis — every item
under #1 is a requirement gathered from the real run, dated and specific. #2 and #3 are unchanged.

1. **Photo upload wired into the customer dashboard** — `PhotoUploader.tsx` is still unbuilt; today
   a photo can only reach a site through the internal `/admin/lead-engine-photos` harness.
   **Chris's explicit direction, given 2026-08-25 while running Miller Storm through the current
   harness:** the real uploader should NOT be one generic file input. It should have **separate
   labeled sections per slot — hero, band, services ladder, gallery — each showing how many photos
   that slot needs/accepts and where an uploaded photo will land**, plus size/format guidance
   on-screen (today: 18 photos per site, 20MB each, `lib/lead-engine/limits.ts`). This is a
   deliberate reversal of the current allocator design note in `photos.ts` ("one function, disjoint
   slices" — allocation is automatic, computed at render time from aspect ratio, not chosen at
   upload time) — Chris wants placement made VISIBLE and predictable to the person uploading, even
   though the underlying automatic allocation can stay as the actual mechanism. Treat this as a
   real product requirement for the eventual dashboard uploader, not a nice-to-have.
   **Also has no running count or list of what's already landed.** After uploading several photos
   for Miller Storm, Chris had no way to tell from the page how many had actually been accepted —
   he had to ask, and the true count (checked live against `lead_engine_photos`) was 10 of the 18
   cap. The tool shows only the single most-recently-uploaded photo's own detail card, nothing
   cumulative. **The real uploader needs to show, live: how many photos exist for this site, and
   which ones — not just the one you just sent.** Related to but distinct from the counts-per-slot
   requirement above: that one is forward-looking ("here's what this slot still needs"), this one
   is backward-looking ("here's what you've already got").
   **Also worth surfacing: there is a real, useful stopping point well below the hard cap.** For a
   site with N services (3–6, the range `servicesLayout` will use a photo ladder for), the page can
   only ever use `1 hero + 1 band + N ladder + up to 6 gallery` photos — for Miller Storm's 6
   services that's 14. Photos uploaded past that number are accepted (up to 18) but never rendered
   anywhere; `allocatePhotos()` simply never reaches them. The real uploader should tell the person
   uploading when they've hit that useful ceiling, not just the hard one.
   **Also found running the current harness against a real site (not a fixture) for the first
   time:** its upload form never sends `isPrimary` or `caption`, even though
   `/api/lead-engine/photos` accepts both — every photo uploaded through it lands with
   `isPrimary: false, caption: null` regardless of intent, so there is no way to guarantee a
   specific shot becomes the hero. The real uploader needs to expose both.
   **There is also no "I'm done" action anywhere in the flow.** Site status only ever moves
   `draft → awaiting_answers → in_build → live`; nothing marks "photos are finished, ready to move
   forward." Running Miller Storm through today, the only way this got communicated was Chris
   saying so directly in the session. The real dashboard needs an explicit action for this —
   likely the natural trigger for handing a site to the admin list/edit page (item 2 below) rather
   than leaving it implicit in status alone.
2. **The internal admin list/edit page** so a site can go from answers to live with no raw SQL.
   Until that page exists, `content` still has to be built by hand — see
   `scripts/seed-lead-engine-review.mjs`'s own call to `contentFrom()` for the pattern an admin
   route would automate.
3. **The review fixtures were reseeded 2026-08-24** (Chris ran it himself after Chunk B closed) and
   are confirmed `draft` with the new 4a/4b/credential shape via the live script's own check — do
   not re-seed again without a reason; nothing here is stale.

**Fixed 2026-08-25, found running Miller Storm (a real, non-fixture site) through the photo
harness for the first time:** its Site dropdown was hardcoded to `slug LIKE 'review-%'`, so a real
site created outside `seed-lead-engine-review.mjs` couldn't be selected at all. Widened to list
every site — see the commit on `feature/lead-engine-chunk-c`.

**Known, deliberate gaps in what shipped — not bugs, just not built:**
- The public questionnaire form does not ask Q9–Q11 (practice-only: accepting patients, insurance,
  hours, team, first-visit info). The API route already accepts them if posted; only the UI is
  missing. Deferred because the site row doesn't carry its vertical after creation, so the form has
  no cheap way to know whether to show them — see this session's own note further up.
- The lead form doesn't collect "what are you interested in?" — `service_interest` stays null.
- `client-dashboard/site` has no Sidebar nav entry; reached via the redirect wired into the main
  `client-dashboard/page.tsx`, or a direct link, until Chunk C's admin page needs one and both get
  added together.

### What shipped 2026-08-24, second session — the photo pipeline

- **`lib/lead-engine/photo-pipeline.ts`** — `normalizeToRaster` (HEIC/HEIF → JPEG via
  `heic-convert`, everything else passes through) and `processPhoto` (EXIF-rotate-then-strip via
  `sharp().rotate()` + not calling `withMetadata()`, 4 variant widths skipping any larger than the
  source, WebP q82 + JPEG fallback, dominant color via `sharp().stats().dominant`). 7 tests, all
  against real `sharp`-generated image bytes — see the file's own note on why real HEIC decoding
  is NOT one of them.
- **Two API routes, not one** — `POST /api/lead-engine/photos/sign` then `POST
  /api/lead-engine/photos`, split because of the Vercel body-limit finding in this session's
  handoff above. `lib/lead-engine/photo-storage.ts` holds the bucket names, path helpers, and the
  one ownership check both routes (and DELETE) share.
- **`allocatePhotos()` gained two Part B rules** (`lib/lead-engine/photos.ts`) — `isPrimary`
  overrides `sort_order` for the hero slot only; hero/band prefer the pool's least-/most-wide
  photo by `aspectRatio` when that data exists. Both implemented so disjointness holds by
  construction (every pick splices out of one shared pool) rather than by re-checking it, and both
  degrade to the exact pre-Part-B FIFO behaviour when a photo carries neither field — which is why
  every pre-existing allocator test still passes unmodified.
- **Rendering pass in `components/lead-engine/SiteSections.tsx`** — one new `SitePhotoImg`
  helper used at all six photo call sites (hero, ladder, gallery ×3, band). Adds
  `srcSet`/`sizes`/`fetchPriority`/dominant-color placeholder when a photo has Part B data,
  degrades to a plain `<img src>` when it doesn't. Alt text now follows §9 exactly — gallery
  photos with no caption used to render `alt=""`; they now fall back to the business name, which a
  new `businessName` prop on `Gallery` threads through from all three template call sites.
- **Migration `2026-08-24-lead-engine-photo-pipeline.sql` is APPLIED**, and Part B is proven end to
  end against production, same day. **Do not re-verify any of this:**
  - The migration itself — not stated separately, proven by the test upload below, which only
    succeeds if `width`/`height`/`aspect_ratio`/`dominant_hex`/`variants` exist to write to.
  - **Both Storage buckets exist and work** — the original public `lead-engine-photos` (Phase 6)
    and the new private `lead-engine-photos-incoming`, created by hand by Chris.
  - **A real HEIC photo went through the live routes and back out clean.** Sign →
    direct-to-Storage upload → process, via the throwaway admin test page
    (`app/(portal)/admin/lead-engine-photos/`, not part of the product — a harness, same spirit as
    `admin/ops-brief`) built specifically because no real dashboard exists yet to click through.
    Correct orientation, 4 variants (480/960/1440/2560), real dimensions (4000×3000, 4:3 — a real
    iPhone photo), dominant color extracted. Then deleted through the real `DELETE
    /api/lead-engine/photos` route (not by hand) — verified read-only afterward: the DB row is
    gone and `storage.list()` on that photo's prefix returns empty, so all 8 variant objects
    (4 widths × 2 encodings) were actually removed, not just the row.
    **The one thing this did NOT need:** a fabricated HEIC test fixture.
    `lib/lead-engine/photo-pipeline.test.ts` was honest about not having one; a real photo made
    that gap moot rather than needing to be worked around.

### What shipped 2026-08-24, first session — the short version

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
- **`sharp`'s prebuilt binaries cannot decode HEIC** (patent licensing on the HEVC codec libheif
  needs) — there is no `@img/sharp-*-heif` package and none will appear from a normal `npm
  install` on Vercel. Don't re-investigate this if a future HEIC bug shows up; it's why
  `heic-convert` exists in this codebase at all.
- **Vercel Functions cap request AND response bodies at 4.5MB, hard, unconfigurable** — this is
  not a Next.js setting and there is no larger tier to buy. Any route that needs to move more than
  a few MB has to use a signed direct-to-Storage upload instead, the way
  `/api/lead-engine/photos/sign` does. Don't design another large-upload route as a single route
  without re-reading this.

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

**✅ IMPLEMENTED 2026-08-24 (third session).** Everything below was the design; the "What actually
shipped" list at the top of this doc's handoff records what building it actually found — most
notably that `credentialWhyUsLine`'s status-word check has to match at EITHER end of the string,
not just the trailing end this section's own worked examples checked, or "Licensed and insured in
Texas" — one of this project's own most common fixture credentials — comes out as the broken
"Holds Licensed and insured in Texas." Kept below for the reasoning, not as an open task.

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

**Chunk B — Phases 3–5. ✅ DONE 2026-08-24 — built, verified, committed, pushed.** Questionnaire
(token-gated), public lead form + owner notification, customer dashboard section (submissions,
counts, change-request form).
*Verification point:* met, by Chris, by hand — he filled the questionnaire, saved, and confirmed
it survived a refresh; he submitted a real lead and confirmed the notification arrived in his own
inbox with the correct content. See this doc's own handoff for the three real bugs verification
surfaced and fixed along the way.

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

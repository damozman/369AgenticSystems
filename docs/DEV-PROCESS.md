# 369 Agentic Systems — Development Process

A repeatable checklist for changing this codebase safely. Follow it for every
feature, fix, or restructure. Tuned to this stack: **Next.js (App Router) on
Vercel (auto-deploys from `master`), Supabase, Stripe, Retell, Resend.**

The single most important principle, above all the steps below:

> **Verify against the live system, not the code, the tests, or the dashboard.**
> Tonight's entire value came from checking real Supabase rows, doing real
> logins, and placing real calls — not from a passing build. A green checkmark
> is not proof. The database is the source of truth; the dashboard is an
> unreliable witness.

---

## The three phases (in order — never skip ahead)

### Phase 1 — Secure the foundation (recurring, not one-and-done)
Before *and after* meaningful changes, check for the vulnerability classes that
bite this app:
- **Broken object-level authorization (IDOR/BOLA)** — does every route/query
  scope data to the *authenticated user*, never to an ID/domain taken from the
  request? (This was the transcript-search breach.)
- **Unauthenticated routes** — any new API route that mutates data, sends
  email/SMS, or provisions anything MUST have an auth check (session, admin, or
  shared-secret gate). Default-open is the recurring failure here.
- **Injection / output encoding** — user/caller-supplied text going into HTML
  email, CSV, SQL `ilike`, or a `RegExp` must be escaped (`lib/security/sanitize.ts`).
- **Dependency audit** — `npm audit`; fix the non-breaking ones, schedule the
  breaking ones (framework majors) as their own branch.

> An audit is a point-in-time snapshot. Every new feature can reintroduce these.
> Re-scan anything touching **auth, money, or the database.**

### Phase 2 — Prove it works (the RIGHT kind of test)
Know your current app works before adding to it. But be honest about what each
kind of test can actually prove:
- **Unit tests (`npm test`, Node's built-in runner)** — use for **pure logic with
  no external dependency**: sanitizers, tier/pricing math, template selection,
  parsers. Cheap, reliable, run them every change.
- **Live verification** — the Stripe / Supabase-auth / Retell / Resend paths
  **cannot** be proven by unit tests, because the logic lives in those services.
  For these, your "test" is a **written manual checklist run against a Vercel
  preview deploy**. Examples that worked:
  - RLS: log in as admin (see everything) AND as a real client (see only their
    own rows).
  - Auth change: real OTP login → session persists → dashboards render.
  - Payment/provisioning: real charge → webhook fires → agent+number provisioned
    → confirmation email → refund → state stays clean.
  - Retell gate: place a real call → confirm a row lands in the `calls` table
    (check the DB, not the dashboard).

> Do not let a green unit-test suite create false confidence about a flow it
> never actually reached.

### Phase 3 — Build features, ONE item at a time
Only after the foundation is secure and verified.
- Feed **one backlog item + the specific file(s) + the business requirement.**
- Small, self-contained changes beat big multi-part builds (the big
  "Founding-Five launch" build had to be paused precisely because it moved too
  fast on too many fronts at once).
- Every claim shown to a user must be true of the code that exists — no copy for
  features that aren't built.

---

## The delivery loop (use this EVERY change)

1. **Branch** — never commit straight to `master` (it auto-deploys to prod).
   `git checkout -b <type>/<short-name>` (e.g. `feat/`, `fix/`, `security/`, `chore/`).
2. **Change** — smallest change that does the job. Match surrounding code style.
3. **Verify locally** — `npx tsc --noEmit`, `npm run build`, `npm test`. All green
   before pushing.
4. **PR + push** — `git push -u origin <branch>` then open a PR. This gives a
   **Vercel preview deploy** (separate URL, prod untouched).
5. **Test the preview** — run the manual checklist for whatever the change
   touches (see Phase 2). This is the real gate.
6. **Merge** — only after the preview passes. Merge = deploy to production.
7. **Confirm in prod** — quick sanity check on the live site / DB after deploy.

For **database migrations** (Supabase): pre-flight read-only checks first
(do the tables/columns/policies actually match what the migration expects?),
keep the **rollback SQL** ready, apply in a quiet window, then verify with real
logins. `schema.sql` is NOT guaranteed to match production — always probe live.

For **external-service config** (Retell/Stripe/Vercel env): set the **sender
before the receiver** so there's no window where one side rejects the other
(e.g. Retell sends the secret before Vercel starts requiring it). Prefer a
**dry-run script** over hand-editing many items; make it **idempotent** so it's
safe to re-run.

---

## Guardrails already in place (don't remove without reason)
- **`.claude/settings.json` deny rules + `.claude/hooks/guardrail-bash.mjs`** —
  block `rm -rf`, `.env` reads, `printenv`, `curl|sh` at the terminal. A safety
  net for automated work, not a substitute for the code-level fixes.
- **Shared-secret gates** (`lib/security/route-guard.ts`) — enforce-only-when-
  configured: dormant until the env var is set, so shipping them is non-breaking.
- **RLS** — the database enforces tenant isolation; app-layer `.eq(user_email)`
  is defense-in-depth, not the only boundary.

## Things that are true of this repo (easy to forget)
- `master` auto-deploys to production via Vercel. `.env.local` is git-ignored and
  **never deploys** — production env vars live in Vercel only.
- Secrets in two places (e.g. `RETELL_WEBHOOK_SECRET` in Vercel + on every Retell
  agent) must match exactly; record the value when you set it.
- `public/index.html` IS the homepage — never delete it.
- Static cold-email pages in `public/` are hand-edited HTML — never route through
  Next.js.

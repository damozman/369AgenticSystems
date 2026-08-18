-- SMS consent, and the business name a text actually goes out under.
--
-- Both are prerequisites for A2P 10DLC campaign registration, not nice-to-haves:
--
--   * Campaigns are rejected on **proof of opt-in** more than anything else. "They called us" is
--     not documented consent to text someone. Ava has to ask, and the answer has to be stored
--     where it can be shown.
--   * Under the ISV model the registered Brand is the CLIENT's business, so the sample messages
--     submitted must be what genuinely goes out. Today Rex texts "This is 369 Roofing" to a
--     person who called Northside Roofing — a brand mismatch that fails review, and confuses the
--     recipient where it doesn't.
--
-- NOTE: schema.sql is not guaranteed to match production. `agent_subscriptions.company_name` was
-- found MISSING on 2026-08-16 despite /api/cron/silence-check selecting it — that cron has been
-- erroring out and alerting nobody. Probe before trusting.


-- ── the business a message is sent as ─────────────────────────────────────────
-- Deliberately on agent_subscriptions rather than `clients`: the subscription is what owns the
-- phone number, the agent and the schedule, and `clients` is keyed by email which does not
-- reliably match (the one row present has a null company_name and a different address).
--
-- This is the CUSTOMER-FACING name — what Ava says out loud and what a text is signed with.
-- It is the trading name, not the legal entity: TCR keeps those as separate fields (legal name,
-- which must match the EIN, and DBA/brand name, which is what customers actually know you as).
-- Putting "NSR Holdings LLC" here would have Ava answer the phone with it. The legal name belongs
-- on the 10DLC form, not in this column.
alter table public.agent_subscriptions add column if not exists business_name text;


-- ── consent to be texted ──────────────────────────────────────────────────────
-- Default FALSE, not null. Silence is not consent, and a nullable flag read as "probably fine"
-- is how a platform ends up sending unconsented messages at scale.
alter table public.leads add column if not exists sms_consent    boolean not null default false;
alter table public.leads add column if not exists sms_consent_at timestamptz;

-- What the caller was actually asked, captured verbatim. If a complaint ever arrives, "we have a
-- boolean" is a much weaker answer than the sentence they agreed to and the second they said yes.
alter table public.leads add column if not exists sms_consent_source text;

-- The carrier-facing question is always "show me the opt-in for THIS number", so that is the
-- lookup this index serves.
create index if not exists leads_sms_consent_idx
  on public.leads (caller_phone, sms_consent)
  where sms_consent = true;


-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop index if exists public.leads_sms_consent_idx;
-- alter table public.leads drop column if exists sms_consent_source;
-- alter table public.leads drop column if exists sms_consent_at;
-- alter table public.leads drop column if exists sms_consent;
-- alter table public.agent_subscriptions drop column if exists business_name;

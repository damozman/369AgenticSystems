-- Usage metering, Phase A: measure and record. Bill nothing.
--
-- Tiers are flat today — $400/$600/$750 for unlimited minutes — which makes the heaviest user the
-- worst-margin user with no lever. Included minutes plus overage fixes that, but nothing in the
-- product can currently count a minute, so the pricing copy cannot honestly change yet.
--
-- This migration adds the ledger. /api/cron/usage-rollup writes one row per client per closed
-- period recording what it WOULD have billed, with status 'shadow', and charges nothing. After a
-- full cycle those rows get reconciled against Retell's own call records; that comparison is the
-- gate for turning billing on, not a date.
--
-- NOTE: schema.sql is not guaranteed to match production. Probe the live database before
-- assuming this applied cleanly — three tables were found drifted on 2026-07-12.

-- ── the billing-period anchor ─────────────────────────────────────────────────
-- `checkout.session.completed` carries `session.subscription` and we have been discarding it,
-- keeping only the customer id. Without the subscription there is no period anchor, and a client
-- with no anchor can never be billed (see lib/billing-period.ts:billablePeriodFor, which returns
-- null rather than inventing one). Capturing it now means Phase B starts with real anchors
-- instead of a backfill.
alter table public.agent_subscriptions add column if not exists stripe_subscription_id text;

create index if not exists agent_subscriptions_stripe_sub_idx
  on public.agent_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;


-- ── usage_periods ─────────────────────────────────────────────────────────────
-- One row per client per billing period, written when the period closes.
create table if not exists public.usage_periods (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  client_domain           text        not null
                            references public.agent_subscriptions(client_domain) on delete cascade,

  -- Half-open [start, end), matching lib/billing-period.ts and filterAvailable's slot rule. A
  -- call at 23:59:59.999 on the last night belongs to the closing period; one at 00:00:00 does
  -- not. Getting this wrong bills one call twice or never.
  period_start            timestamptz not null,
  period_end              timestamptz not null,

  -- Snapshotted, not looked up later. A client who changes tier mid-life must not retroactively
  -- change what a closed period was worth, and TIER_MINUTES may itself change.
  tier                    text        not null,
  included_minutes        int         not null,
  billed_minutes          int         not null default 0,
  overage_minutes         int         not null default 0,

  -- Integer cents, never dollars. `0.35 * 3` is 1.0499999999999998 in floating point, and money
  -- that passes through a float eventually bills a cent wrong — half the time in our favour,
  -- which is the half that costs a customer.
  overage_cents           int         not null default 0,

  -- 'shadow'  — computed, deliberately not billed. Every row in Phase A.
  -- 'invoiced'— a Stripe invoice item exists (Phase B).
  -- 'skipped' — no overage, or the client is not billable at all.
  -- 'failed'  — Stripe rejected the invoice item; needs a human.
  status                  text        not null default 'shadow'
                            check (status in ('shadow', 'invoiced', 'skipped', 'failed')),

  -- Set in Phase B. Also the idempotency key: a cron that runs twice must not bill twice, so the
  -- write is conditional on this being null.
  stripe_invoice_item_id  text,
  last_error              text,

  -- When the owner was told they crossed their allowance. Once per period — the same guard
  -- calendar_connections.alerted_at uses, because a daily nag about a known state gets filtered
  -- exactly like a daily all-clear does.
  alerted_at              timestamptz
);

-- One row per client per period. The rollup is idempotent on this: re-running a day later
-- updates the row rather than adding a second one.
create unique index if not exists usage_periods_client_period_idx
  on public.usage_periods (client_domain, period_start);

-- The cron's own scan: periods that computed an overage but have not been billed.
create index if not exists usage_periods_unbilled_idx
  on public.usage_periods (status, period_end)
  where status = 'shadow' and overage_minutes > 0;

alter table public.usage_periods enable row level security;

-- Read-only to the owner, and only their own. There is deliberately no client-side insert or
-- update policy: a browser session that could write its own usage row could write itself a zero
-- bill. Only the service role (the rollup cron) writes here.
create policy "usage_periods: owner read" on public.usage_periods for select to authenticated using (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);


-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop index if exists public.usage_periods_unbilled_idx;
-- drop index if exists public.usage_periods_client_period_idx;
-- drop table if exists public.usage_periods;
-- drop index if exists public.agent_subscriptions_stripe_sub_idx;
-- alter table public.agent_subscriptions drop column if exists stripe_subscription_id;

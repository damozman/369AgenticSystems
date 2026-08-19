-- Provisioning idempotency.
--
-- On 2026-08-18 a single checkout provisioned THREE Retell agents and bought THREE phone
-- numbers. `checkout.session.completed` reached both a local listener and the registered
-- production endpoint, and production was retried 37 seconds later. Two of those runs were
-- 3 MILLISECONDS apart.
--
-- That 3ms gap is why this is a table with a unique key rather than a SELECT before the work:
-- a check-then-act guard in application code loses that race every time, because both callers
-- read "not provisioned yet" before either writes. Only the database can arbitrate it.
--
-- It is a separate table rather than a unique index on agent_subscriptions.stripe_subscription_id
-- because the two answer different questions. agent_subscriptions answers "who is a client"
-- and is keyed on client_domain, which must stay upsertable — a client who cancels and later
-- re-subscribes has the same domain and a NEW subscription id, and must be allowed through.
-- This table answers "has this particular purchase already been acted on", which is keyed on
-- the purchase.
--
-- The claim is RELEASED if provisioning fails (see lib/onboard-client.ts), so a transient
-- Retell error does not permanently lock a paying customer out of being provisioned by a retry.

create table if not exists provisioning_claims (
  stripe_subscription_id text primary key,
  client_domain          text        not null,
  claimed_at             timestamptz not null default now(),
  completed_at           timestamptz,
  retell_agent_id        text
);

comment on table provisioning_claims is
  'One row per Stripe subscription that provisioning has started for. The primary key is the '
  'idempotency guard: a duplicate checkout.session.completed delivery loses the insert and '
  'short-circuits before any money is spent. Rows with completed_at IS NULL are either in '
  'flight or were abandoned by a crash between claiming and completing.';

comment on column provisioning_claims.completed_at is
  'Set when provisioning finished. NULL with an old claimed_at means a run died mid-flight — '
  'that client may have a purchased Retell number with no agent_subscriptions row.';

create index if not exists provisioning_claims_incomplete_idx
  on provisioning_claims (claimed_at)
  where completed_at is null;

-- Service-role only. Nothing client-side has any reason to read this.
alter table provisioning_claims enable row level security;

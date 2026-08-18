-- Per-item inventory: capacity that knows WHICH unit, not just how many.
--
-- `client_schedules.max_concurrent_per_slot` already answers "how many jobs can this business run
-- at once" — a roofer with three crews takes three. That is the right model for people-time, and
-- it is not touched here.
--
-- It cannot answer a rental question. A business with three bounce houses and two casino setups
-- has a customer asking for *the princess castle* on Saturday, and one scalar per client cannot
-- say whether that specific unit is out. Same shape for dumpsters, skid steers and party buses:
-- the calendar books people-time, inventory books things.
--
-- THE LOAD-BEARING PROPERTY: a booking with no item behaves exactly as it does today. Every
-- existing client books people-time, and `inventory_item_key is null` must remain completely
-- first-class — the same way `getProviderForClient()` returning null is.
--
-- NOTE: schema.sql is not guaranteed to match production. Probe the live database before assuming
-- this applied cleanly — three tables were found drifted on 2026-07-12.


-- ── client_inventory ──────────────────────────────────────────────────────────
create table if not exists public.client_inventory (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  client_domain text        not null
                  references public.agent_subscriptions(client_domain) on delete cascade,

  -- Stable slug used by the booking tools; never spoken.
  item_key      text        not null check (item_key = lower(item_key) and item_key <> ''),

  -- What Ava actually says out loud. Kept separate from item_key so renaming the customer-facing
  -- name never orphans the bookings that reference the key.
  label         text        not null,

  -- How many of THIS item exist. A business with two identical bounce houses can genuinely take
  -- two bookings for it at the same time.
  quantity      int         not null default 1 check (quantity >= 1),

  -- Soft-retire a unit that was sold or damaged. Deleting would orphan historical bookings, and
  -- an inactive item is deliberately unbookable rather than invisible in the record.
  active        boolean     not null default true
);

-- One row per item per client. Also the natural lookup key for book_slot().
create unique index if not exists client_inventory_domain_item_idx
  on public.client_inventory (client_domain, item_key);

alter table public.client_inventory enable row level security;

-- Tenant-scoped, copying the client_schedules policy shape exactly.
create policy "client_inventory: owner read"   on public.client_inventory for select to authenticated using (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);
create policy "client_inventory: owner write"  on public.client_inventory for update to authenticated using (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);
create policy "client_inventory: owner insert" on public.client_inventory for insert to authenticated with check (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);


-- ── bookings.inventory_item_key ───────────────────────────────────────────────
-- Nullable with no default. Null means "this booking consumes general capacity", which is every
-- booking that exists today and every booking a non-rental client will ever make.
alter table public.bookings add column if not exists inventory_item_key text;

-- The per-item capacity count filters on exactly this.
create index if not exists bookings_domain_item_starts_idx
  on public.bookings (client_domain, inventory_item_key, starts_at)
  where inventory_item_key is not null;


-- ── book_slot(): now capacity-aware per item ──────────────────────────────────
-- DROP, not CREATE OR REPLACE. Appending a defaulted parameter creates an *overload* rather than
-- replacing the function, and then every existing 9-argument call becomes ambiguous — Postgres
-- raises "function book_slot(...) is not unique" and EVERY booking fails. The old signature has
-- to go first.
--
-- DDL is transactional in Postgres, so running this file as one script means booking is never
-- actually down: either the whole swap lands or none of it does.
drop function if exists public.book_slot(text, timestamptz, timestamptz, uuid, uuid, timestamp, text, text, text);

create or replace function public.book_slot(
  p_client_domain    text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_call_id          uuid default null,
  p_lead_id          uuid default null,
  p_appointment_date timestamp default null,
  p_appointment_time text default null,
  p_service_type     text default null,
  p_location         text default null,
  p_item_key         text default null
)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_taken    int;
begin
  -- Serialize every booking attempt for this client until the transaction ends. Still keyed on
  -- the CLIENT rather than the item: two different items contending is harmless, and a
  -- client-wide lock means a general-capacity booking and an item booking cannot interleave in a
  -- way that lets both through.
  perform pg_advisory_xact_lock(hashtextextended(p_client_domain, 0));

  if p_item_key is null then
    -- ── Unchanged path. Every existing client lands here. ──────────────────────
    select max_concurrent_per_slot into v_capacity
      from public.client_schedules
     where client_domain = p_client_domain;

    -- No schedule row yet (client never onboarded) — fall back to one job at a time.
    v_capacity := coalesce(v_capacity, 1);

    -- Overlap, not equality. Equality would miss a 60-minute job starting halfway through
    -- another one, which is exactly what happens after someone changes slot_duration_minutes.
    select count(*) into v_taken
      from public.bookings b
     where b.client_domain = p_client_domain
       and b.starts_at is not null
       and coalesce(b.status, 'scheduled') <> 'cancelled'
       and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts_at, p_ends_at);

  else
    -- ── Per-item path. ────────────────────────────────────────────────────────
    select quantity into v_capacity
      from public.client_inventory
     where client_domain = p_client_domain
       and item_key      = p_item_key
       and active;

    -- An unknown or retired item is a configuration fault, not contention. Raising keeps zero
    -- rows meaning exactly one thing — "someone just took it" — so the caller can still tell the
    -- two apart and offer another time rather than apologising for the wrong reason.
    -- /api/book-appointment validates the item before calling, so reaching this is a bug.
    if v_capacity is null then
      raise exception 'book_slot: unknown or inactive inventory item % for client %', p_item_key, p_client_domain
        using errcode = 'foreign_key_violation';
    end if;

    -- Only bookings of the SAME item consume this item's capacity. A booked DJ does not make a
    -- bounce house unavailable.
    select count(*) into v_taken
      from public.bookings b
     where b.client_domain      = p_client_domain
       and b.inventory_item_key = p_item_key
       and b.starts_at is not null
       and coalesce(b.status, 'scheduled') <> 'cancelled'
       and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts_at, p_ends_at);
  end if;

  if v_taken >= v_capacity then
    return;  -- zero rows: it filled up between being offered and being accepted
  end if;

  return query
  insert into public.bookings (
    client_domain, call_id, lead_id,
    starts_at, ends_at,
    appointment_date, appointment_time,
    service_type, location, inventory_item_key
  ) values (
    p_client_domain, p_call_id, p_lead_id,
    p_starts_at, p_ends_at,
    p_appointment_date, p_appointment_time,
    p_service_type, p_location, p_item_key
  )
  returning *;
end;
$$;

-- Only the service-role key (API routes) may book. No client-side path should reach this.
--
-- The GRANT is not optional. Postgres grants EXECUTE to PUBLIC by default and every role —
-- service_role included — inherits it from there, so revoking from PUBLIC takes it from
-- service_role too and every booking fails with "permission denied for function book_slot".
-- Revoke first, then grant back explicitly. Note the signature now carries the tenth argument.
revoke all on function public.book_slot(text, timestamptz, timestamptz, uuid, uuid, timestamp, text, text, text, text) from public, anon, authenticated;
grant execute on function public.book_slot(text, timestamptz, timestamptz, uuid, uuid, timestamp, text, text, text, text) to service_role;


-- ── Rollback ──────────────────────────────────────────────────────────────────
-- Restoring the 9-argument function means re-running the 2026-08-04 migration's book_slot block
-- after dropping this one; the column and table below are otherwise inert and safe to leave.
-- drop function if exists public.book_slot(text, timestamptz, timestamptz, uuid, uuid, timestamp, text, text, text, text);
-- drop index if exists public.bookings_domain_item_starts_idx;
-- alter table public.bookings drop column if exists inventory_item_key;
-- drop index if exists public.client_inventory_domain_item_idx;
-- drop table if exists public.client_inventory;

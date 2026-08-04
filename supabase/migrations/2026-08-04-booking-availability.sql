-- Real appointment availability (plan Phase 1).
--
-- Before this, /api/available-slots was synthetic: hardcoded 10:00 AM and 2:00 PM, Mon–Fri,
-- always America/Chicago, and it read neither a calendar nor the bookings table. Ava could
-- hand the same Tuesday 10:00 AM to five callers and nothing objected. This migration gives
-- availability a real source of truth: per-client working hours, and capacity actually held
-- against rows already in `bookings`.
--
-- NOTE: schema.sql is not guaranteed to match production. Probe the live database before
-- assuming this applied cleanly — three tables were found drifted on 2026-07-12.

-- ── client_schedules ──────────────────────────────────────────────────────────
-- One row per client. Every column is defaulted, so a client who never answers the
-- onboarding questions still gets sane weekday hours rather than no availability at all.
create table if not exists public.client_schedules (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  client_domain           text        not null unique
                            references public.agent_subscriptions(client_domain) on delete cascade,

  -- IANA name, not an offset. Offsets are wrong twice a year, and the old route hardcoded
  -- America/Chicago for every client regardless of where they actually are.
  timezone                text        not null default 'America/Chicago',

  -- Per-weekday opening hours in the client's own timezone, as local wall-clock "HH:MM".
  -- A day whose value is null is closed. Stored as jsonb rather than columns because
  -- "which days are you open" is exactly the shape that grows split shifts later.
  business_hours          jsonb       not null default '{
    "mon": {"open": "08:00", "close": "17:00"},
    "tue": {"open": "08:00", "close": "17:00"},
    "wed": {"open": "08:00", "close": "17:00"},
    "thu": {"open": "08:00", "close": "17:00"},
    "fri": {"open": "08:00", "close": "17:00"},
    "sat": null,
    "sun": null
  }'::jsonb,

  slot_duration_minutes   int         not null default 60  check (slot_duration_minutes between 5 and 480),

  -- How many appointments this business can genuinely run at the same time. A roofer with
  -- three crews takes three; a solo attorney takes one. Defaulting to 1 is the safe error:
  -- it under-books rather than sending two crews to one slot.
  max_concurrent_per_slot int         not null default 1   check (max_concurrent_per_slot >= 1),

  -- Earliest bookable time from now. Stops Ava promising a 7:00 AM job at 6:40 AM.
  lead_time_hours         int         not null default 12  check (lead_time_hours >= 0),

  -- How far ahead Ava may offer. Keeps her from booking six months out.
  booking_horizon_days    int         not null default 14  check (booking_horizon_days between 1 and 365)
);

create index if not exists client_schedules_domain_idx on public.client_schedules (client_domain);

-- Tenant-scoped, so it follows the client_questionnaires policy shape exactly.
-- Service-role (every API route here) bypasses RLS for writes automatically.
alter table public.client_schedules enable row level security;

create policy "client_schedules: owner read"   on public.client_schedules for select to authenticated using (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);
create policy "client_schedules: owner write"  on public.client_schedules for update to authenticated using (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);
create policy "client_schedules: owner insert" on public.client_schedules for insert to authenticated with check (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);


-- ── bookings: a real instant, not prose ───────────────────────────────────────
-- `appointment_time` is TEXT ("2:00 PM") and `appointment_date` is a bare TIMESTAMP. Neither
-- carries a timezone and nothing carries a duration, so there was no way to say when an
-- appointment *ends* — which makes both overlap detection and any calendar event impossible.
--
-- Both old columns stay and keep being written: the dashboard reads them. These are additive.
alter table public.bookings add column if not exists starts_at timestamptz;
alter table public.bookings add column if not exists ends_at   timestamptz;

-- The capacity check in book_slot() filters on exactly this.
create index if not exists bookings_domain_starts_idx on public.bookings (client_domain, starts_at)
  where starts_at is not null;


-- ── book_slot(): capacity check and insert, atomically ────────────────────────
-- The check-then-insert race is real: two callers on two simultaneous calls can both be told
-- 10:00 AM is free before either row lands. The Supabase JS client cannot open a transaction,
-- so the check has to live where the insert does.
--
-- Returns the inserted row, or ZERO ROWS if the slot is full. Zero rows is unambiguous —
-- anything else raises — so the caller can distinguish "someone just took it" from a failure
-- and have Ava offer another time instead of silently double-booking.
create or replace function public.book_slot(
  p_client_domain    text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_call_id          uuid default null,
  p_lead_id          uuid default null,
  p_appointment_date timestamp default null,
  p_appointment_time text default null,
  p_service_type     text default null,
  p_location         text default null
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
  -- Serialize every booking attempt for this client until the transaction ends. Keyed on the
  -- client, not the slot: at this volume the contention is nil, and it means two overlapping
  -- but non-identical slots can't slip past each other.
  perform pg_advisory_xact_lock(hashtextextended(p_client_domain, 0));

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

  if v_taken >= v_capacity then
    return;  -- zero rows: the slot filled up between being offered and being accepted
  end if;

  return query
  insert into public.bookings (
    client_domain, call_id, lead_id,
    starts_at, ends_at,
    appointment_date, appointment_time,
    service_type, location
  ) values (
    p_client_domain, p_call_id, p_lead_id,
    p_starts_at, p_ends_at,
    p_appointment_date, p_appointment_time,
    p_service_type, p_location
  )
  returning *;
end;
$$;

-- Only the service-role key (API routes) may book. No client-side path should reach this.
--
-- The GRANT is not optional. Postgres grants EXECUTE to PUBLIC by default, and every role —
-- service_role included — inherits it from there. Revoking from PUBLIC therefore takes it away
-- from service_role too, and /api/book-appointment would fail on every single booking with
-- "permission denied for function book_slot". Revoke first, then grant back explicitly.
revoke all on function public.book_slot(text, timestamptz, timestamptz, uuid, uuid, timestamp, text, text, text) from public, anon, authenticated;
grant execute on function public.book_slot(text, timestamptz, timestamptz, uuid, uuid, timestamp, text, text, text) to service_role;


-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop function if exists public.book_slot(text, timestamptz, timestamptz, uuid, uuid, timestamp, text, text, text);
-- drop index if exists public.bookings_domain_starts_idx;
-- alter table public.bookings drop column if exists ends_at;
-- alter table public.bookings drop column if exists starts_at;
-- drop table if exists public.client_schedules;

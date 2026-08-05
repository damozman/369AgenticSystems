-- Google Calendar sync (plan Phase 2).
--
-- Phase 1 gave availability a real source of truth, but only *our* source: Ava reads the
-- `bookings` table and nothing else. She will happily offer a caller Tuesday 10:00 AM while the
-- owner has a dentist appointment on their own calendar at 10:00 — not a double booking in this
-- database, and completely wrong in the real world.
--
-- This migration stores the OAuth connection that lets a provider answer "when are you busy"
-- and "put this on the calendar", and gives `bookings` somewhere to record whether the event
-- was actually written.
--
-- NOTE: schema.sql is not guaranteed to match production. Probe the live database before
-- assuming this applied cleanly — three tables were found drifted on 2026-07-12.

-- ── calendar_connections ──────────────────────────────────────────────────────
-- One row per client. FK'd to agent_subscriptions exactly like client_schedules, which means a
-- client must be subscribed before they can connect a calendar, and the demo line can never
-- have one. That is deliberate: the demo number's whole point is the database check, and
-- nobody's real calendar should be reachable from a number published on nine landing pages.
create table if not exists public.calendar_connections (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  client_domain            text        not null unique
                             references public.agent_subscriptions(client_domain) on delete cascade,

  -- The seam's discriminator. Google first; Microsoft Graph is the planned second. Never
  -- Apple/CalDAV — it has no OAuth and needs a hand-generated app password, which cannot be
  -- automated and would kill "live within minutes of signup".
  provider                 text        not null default 'google'
                             check (provider in ('google', 'microsoft')),

  -- Which account consented, shown back on the dashboard so an owner who connected the wrong
  -- Google account can see that immediately rather than wondering why nothing syncs.
  account_email            text,
  -- 'primary' is the connected account's own calendar. Stored rather than assumed so a client
  -- can later point bookings at a shared "Dispatch" calendar without a schema change.
  calendar_id              text        not null default 'primary',

  -- AES-256-GCM ciphertext, never raw tokens. A leaked refresh token is standing access to a
  -- client's calendar until they notice and revoke it. See lib/calendar/crypto.ts.
  access_token_enc         text,
  refresh_token_enc        text,
  access_token_expires_at  timestamptz,

  -- What Google actually granted, which is not always what was asked for: the consent screen
  -- lets a user untick individual scopes. Storing it means "she stopped seeing my busy times"
  -- is diagnosable instead of mysterious.
  scopes                   text[]      not null default '{}',

  -- 'revoked' is set when Google returns invalid_grant — the user revoked access, or the token
  -- expired under Testing publishing status. Distinguished from 'error' (transient) because
  -- only one of the two is worth retrying.
  status                   text        not null default 'active'
                             check (status in ('active', 'revoked', 'error')),
  last_error               text,
  -- Last time a call to the provider actually succeeded. The reconciler cron alerts on this
  -- going stale, because a dead connection is otherwise invisible: Ava simply stops booking.
  last_ok_at               timestamptz,
  -- When the owner was last told this connection is broken. Cleared on reconnect. Without it
  -- the daily cron mails the same dead connection every morning, and a daily nag about a known
  -- problem gets filtered exactly like a daily all-clear does.
  alerted_at               timestamptz
);

create index if not exists calendar_connections_domain_idx on public.calendar_connections (client_domain);
create index if not exists calendar_connections_status_idx on public.calendar_connections (status)
  where status = 'active';

alter table public.calendar_connections enable row level security;

-- Read and delete only. There is deliberately no client-side insert or update policy: tokens
-- are written exclusively by the service role in the OAuth callback, and letting a browser
-- session write to these columns would be a way to inject a token. Disconnecting is the one
-- destructive action an owner should be able to take on their own — the privacy policy promises
-- exactly that — so delete is allowed.
create policy "calendar_connections: owner read" on public.calendar_connections for select to authenticated using (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);
create policy "calendar_connections: owner delete" on public.calendar_connections for delete to authenticated using (
  client_domain in (select client_domain from public.agent_subscriptions where user_email = auth.jwt() ->> 'email')
);


-- ── bookings: did the event actually get written? ─────────────────────────────
-- Creating the calendar event is deliberately non-fatal — the slot is already atomically held
-- by book_slot() and the caller is on the phone, so a Google outage must not fail a booking that
-- really happened. That trade only works if the failure is recorded somewhere a reconciler can
-- find it, which is what these three columns are for.
alter table public.bookings add column if not exists calendar_event_id    text;
alter table public.bookings add column if not exists calendar_synced_at   timestamptz;
alter table public.bookings add column if not exists calendar_sync_status text
  not null default 'not_applicable'
  check (calendar_sync_status in ('not_applicable', 'pending', 'synced', 'failed'));

-- 'not_applicable' is the default and the honest description of every booking that exists
-- today: no client has a calendar connected, so there was never an event to write. It is not
-- the same as 'synced' and must never be counted as success.

-- The reconciler scans exactly this: unsynced bookings that are still in the future. Past ones
-- are not worth retrying — an event written after the appointment has already happened is
-- noise, not a fix.
create index if not exists bookings_calendar_pending_idx
  on public.bookings (client_domain, starts_at)
  where calendar_sync_status in ('pending', 'failed');


-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop index if exists public.bookings_calendar_pending_idx;
-- alter table public.bookings drop column if exists calendar_sync_status;
-- alter table public.bookings drop column if exists calendar_synced_at;
-- alter table public.bookings drop column if exists calendar_event_id;
-- drop table if exists public.calendar_connections;

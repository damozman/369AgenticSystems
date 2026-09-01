-- Frequent cron for the dossier pipeline, without a Vercel Pro subscription.
--
-- ── Why this exists ──
-- Vercel's Hobby plan refuses any cron more frequent than once a day AT DEPLOY TIME, which is what
-- silently broke every deploy for three days in August: `audit-calls` was */15 and `dossier-build`
-- was */20, so the whole project stopped shipping and production served a stale build. The stopgap
-- was to drop both to daily. That unblocked deploys and left a real degradation behind.
--
-- The routes themselves are ordinary authenticated GETs -- `Bearer ${CRON_SECRET}`. Vercel Cron is
-- not privileged; it is just an HTTP caller. So anything that can send that request can drive the
-- pipeline, and Supabase is already in the stack: no new vendor, no new bill, and no third party
-- holding the secret.
--
-- ── Why daily is worse than it looks, and this is the real reason to fix it ──
-- `decideReadiness` (lib/dossier-queue.ts) marks a submission ready either when an audit call
-- SETTLES, or when BUILD_WITHOUT_CALLS_AFTER_MS (2 hours) has passed with nothing settled -- in
-- which case the dossier is built with the call section omitted. With `audit-calls` at daily, a
-- submission waits up to ~24h for its first call to even be PLACED, so the 2-hour fallback wins
-- almost every time and the dossier is built without the comparison that is its strongest section.
--
-- This does not bite today: AUDIT_CALLS_ENABLED is unset, so nothing dials and every dossier is
-- call-less by design. It bites the moment that switch flips -- the feature would look on and the
-- dossier would silently never carry a call. That makes this a prerequisite for step 5, not a
-- nice-to-have.
--
-- ── Vercel's entries are KEPT, daily, as backstops ──
-- Deliberately not removed. If this project is paused, the Vault secrets are missing, or pg_net is
-- failing, the pipeline degrades to today's once-daily behaviour rather than to nothing at all.
-- Their times are OFFSET so they can never coincide with a pg_cron tick (:07 against */15 and
-- */20, which only ever fire on :00/:15/:20/:30/:40/:45) -- `dossier-build` reads "already queued"
-- and then writes, so two genuinely simultaneous runs could both build one dossier. `audit-calls`
-- is safe either way: it claims a row `scheduled -> placed` before dialling.
--
-- ── Before this works, the two secrets must exist ──
-- Not carried in this migration on purpose -- a migration lives in git, and a secret must not.
-- Run once, in the SQL editor, substituting the real values:
--
--   select vault.create_secret('https://369agenticsystems.com', 'app_base_url',
--                              'Origin the scheduler calls. No trailing slash.');
--   select vault.create_secret('<the CRON_SECRET from Vercel>', 'cron_secret',
--                              'Must match CRON_SECRET in Vercel env, or every call 401s.');
--
-- To rotate later: select vault.update_secret(id, '<new>') from vault.secrets where name = '...';

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A private schema. NOT `public`: PostgREST exposes public functions as RPC endpoints, so a
-- function living there could be invoked by anyone holding the anon key -- which would let a
-- stranger trigger the audit-call dialler from a browser.
create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;

/**
 * Call one of the app's cron routes with its bearer token.
 *
 * SECURITY DEFINER because the caller is pg_cron's job runner, which has no business holding
 * Vault access of its own. The function returns pg_net's request id, never the secret.
 */
create or replace function internal.call_cron_route(route text)
returns bigint
language plpgsql
security definer
set search_path = internal, net, vault, pg_catalog
as $$
declare
  base_url  text;
  secret    text;
  req_id    bigint;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'cron_secret';

  -- Fail loudly. A scheduler that silently does nothing is exactly the failure `silence-check`
  -- spent months demonstrating: it ran, it reported success, and nobody could tell it apart from
  -- having had nothing to do.
  if base_url is null or secret is null then
    raise exception 'internal.call_cron_route: vault secret app_base_url or cron_secret is missing';
  end if;

  -- pg_net is fire-and-forget; the reply lands in net._http_response. The timeout only governs how
  -- long pg_net waits to RECORD an answer -- the route runs to completion either way -- but
  -- dossier-build declares maxDuration 60, so a 5s default would discard every result it produces.
  select net.http_get(
    url                  := base_url || route,
    headers              := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 60000
  ) into req_id;

  return req_id;
end;
$$;

revoke all on function internal.call_cron_route(text) from public, anon, authenticated;

-- ── The schedules ───────────────────────────────────────────────────────────
-- The cadences these were designed with, restored. cron.schedule upserts by name, so re-running
-- this migration re-points an existing job rather than creating a second one.
--
-- audit-calls stays INERT until AUDIT_CALLS_ENABLED is exactly 'true' -- the route returns
-- {enabled: false, placed: 0} and dials nothing. Scheduling it does not turn calling on, and must
-- not be mistaken for having done so: the switch still ships with the disclosure line.

select cron.schedule(
  'dossier-build',
  '*/20 * * * *',
  $$select internal.call_cron_route('/api/cron/dossier-build')$$
);

select cron.schedule(
  'audit-calls',
  '*/15 * * * *',
  $$select internal.call_cron_route('/api/cron/audit-calls')$$
);

-- ── Verifying this actually works, rather than that it was created ──────────
-- The job existing proves nothing; a 401 from a mismatched secret looks identical to success from
-- inside cron.job_run_details. Check the RESPONSE, not the run:
--
--   -- 1. the jobs exist and are active
--   select jobname, schedule, active from cron.job order by jobname;
--
--   -- 2. they ran, and the command did not raise
--   select jobname, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
--
--   -- 3. THE ONE THAT MATTERS -- what the app actually answered.
--   --    200 = worked. 401 = cron_secret does not match Vercel. 404 = app_base_url is wrong.
--   select id, status_code, content::text, created
--     from net._http_response order by created desc limit 10;
--
-- To stop either job:  select cron.unschedule('dossier-build');

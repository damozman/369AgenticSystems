-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSED — test on staging first. Tenant-isolation hardening for Row Level Security.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- WHY: Today every portal table's RLS policy is `USING (true)` for any
-- authenticated user (see supabase/schema.sql). That means RLS is NOT the tenant
-- boundary — the only thing stopping client A from reading client B's calls/leads
-- is the hand-written `.eq('user_email', …)` / `.eq('client_domain', …)` filters
-- in app code. One forgotten filter = cross-tenant breach (exactly the class of
-- bug that made /api/search-transcripts readable across tenants). This migration
-- makes the DATABASE the backstop.
--
-- WHAT: replaces the permissive policies with policies that scope every row to
-- the caller's own client_domain(s) — WHILE preserving the admin Command Center's
-- god-view via is_369_admin().
--
-- ⚠️ WHY IT IS STILL "TEST FIRST" — the two things that make this safe/unsafe:
--   1. SERVER reads use the SERVICE-ROLE key, which BYPASSES RLS. Unaffected. Good.
--   2. The ADMIN Command Center reads these tables DIRECTLY FROM THE BROWSER with
--      the anon key AND subscribes to realtime changes (realtime honors RLS):
--        - receptionist/page.tsx  → CallLeadsTable, CallsStatsBar (calls, leads)
--        - dashboard/page.tsx      → LiveFeed
--        - workforce/page.tsx      → ActiveSpecialists, PendingAlert
--        - history/page.tsx        → LeadsTable
--      The admin email is NOT a client in agent_subscriptions, so a naive
--      per-domain policy would return ZERO rows and BLACK OUT the admin dashboards
--      + kill realtime toasts. The is_369_admin() carve-out below prevents that —
--      but you MUST verify it by logging in as BOTH an admin and a real client on
--      a staging Supabase project before running this in production.
--
-- Ownership model: a user owns a client_domain when agent_subscriptions.user_email
-- = their JWT email. Admins (is_369_admin) see everything. system_audits stays
-- admin-wide by design.

BEGIN;

-- ── Admin predicate ───────────────────────────────────────────────────────────
-- MUST stay in sync with lib/admin.ts ADMIN_EMAILS (same emails, lowercased).
-- If you add/remove an admin there, update the array here too.
CREATE OR REPLACE FUNCTION public.is_369_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY[
    'chris@369agenticsystems.com'
  ]);
$$;

-- Reusable ownership predicate: does the caller own this client_domain?
-- (Kept inline in each policy rather than a function so the planner can inline it.)

-- ── agent_subscriptions: owner sees only their own rows; admin sees all ────────
DROP POLICY IF EXISTS "agent_subscriptions: authenticated read" ON agent_subscriptions;
CREATE POLICY "agent_subscriptions: owner or admin read"
  ON agent_subscriptions FOR SELECT TO authenticated
  USING (is_369_admin() OR user_email = auth.jwt() ->> 'email');

-- ── Per-domain scoped tables (owner's domains, or admin) ──────────────────────
DROP POLICY IF EXISTS "calls: authenticated read" ON calls;
CREATE POLICY "calls: owner or admin read"
  ON calls FOR SELECT TO authenticated
  USING (is_369_admin() OR client_domain IN (
    SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "leads: authenticated read" ON leads;
CREATE POLICY "leads: owner or admin read"
  ON leads FOR SELECT TO authenticated
  USING (is_369_admin() OR client_domain IN (
    SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "bookings: authenticated read" ON bookings;
CREATE POLICY "bookings: owner or admin read"
  ON bookings FOR SELECT TO authenticated
  USING (is_369_admin() OR client_domain IN (
    SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "agent_configurations: authenticated read" ON agent_configurations;
CREATE POLICY "agent_configurations: owner or admin read"
  ON agent_configurations FOR SELECT TO authenticated
  USING (is_369_admin() OR client_domain IN (
    SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "notifications: authenticated read" ON notifications;
CREATE POLICY "notifications: owner or admin read"
  ON notifications FOR SELECT TO authenticated
  USING (is_369_admin() OR client_domain IN (
    SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "sequences: auth read" ON follow_up_sequences;
CREATE POLICY "sequences: owner or admin read"
  ON follow_up_sequences FOR SELECT TO authenticated
  USING (is_369_admin() OR client_domain IN (
    SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "nova: auth read" ON nova_deliveries;
CREATE POLICY "nova: owner or admin read"
  ON nova_deliveries FOR SELECT TO authenticated
  USING (is_369_admin() OR client_domain IN (
    SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "conflicts: auth read" ON conflict_checks;
CREATE POLICY "conflicts: owner or admin read"
  ON conflict_checks FOR SELECT TO authenticated
  USING (is_369_admin() OR client_domain IN (
    SELECT client_domain FROM agent_subscriptions WHERE user_email = auth.jwt() ->> 'email'
  ));

-- ── Intentionally NOT changed ─────────────────────────────────────────────────
-- system_audits: admin-wide view by design (no per-tenant column). Its
--   "authenticated read USING (true)" is left as-is; the admin Command Center
--   reads it via the service-role key anyway. Tighten to is_369_admin() only if
--   you want to stop non-admin authenticated users reading audits.
-- client_questionnaires: already correctly owner-scoped in schema.sql.
--
-- Writes: all server writes use the service-role key (RLS-exempt), so no INSERT/
-- UPDATE policies are needed. Do NOT add authenticated write policies unless a
-- browser writes these tables directly (none do today).

COMMIT;

-- ── ROLLBACK (keep handy) ─────────────────────────────────────────────────────
-- If the admin dashboards go blank or a client sees nothing they should, revert:
--   BEGIN;
--   DROP POLICY IF EXISTS "calls: owner or admin read" ON calls;
--   CREATE POLICY "calls: authenticated read" ON calls FOR SELECT TO authenticated USING (true);
--   -- …repeat for leads, bookings, agent_configurations, notifications,
--   --   follow_up_sequences, nova_deliveries, conflict_checks, agent_subscriptions…
--   COMMIT;

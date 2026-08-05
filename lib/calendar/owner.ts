/**
 * Which client is the logged-in person, and where does Google send them back to.
 *
 * Shared by the three OAuth routes so they cannot disagree — a connect that resolves one
 * client_domain and a callback that resolves another would store a working token against the
 * wrong business.
 */

import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

export const GOOGLE_CALLBACK_PATH = '/api/calendar/google/callback'

/**
 * Built from NEXT_PUBLIC_APP_URL rather than the incoming request.
 *
 * Google matches the redirect URI against the console entry *exactly*, and Vercel preview
 * deployments each have their own hostname — deriving it from `request.url` would work in
 * production and fail on every preview with a redirect_uri_mismatch that looks like a code bug.
 */
export function googleRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  if (!base) throw new Error('NEXT_PUBLIC_APP_URL is not set — cannot build the Google redirect URI')
  return `${base}${GOOGLE_CALLBACK_PATH}`
}

export function serviceRoleClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface OwnerContext {
  email:        string
  clientDomain: string
}

/**
 * The signed-in owner's client_domain, or null if they are not signed in or have no
 * subscription.
 *
 * "Most recent wins" matches app/api/billing-portal/route.ts:25 and the dashboard: one email can
 * hold more than one subscription row (a second business, a re-signup, leftover test data), and
 * `.maybeSingle()` would error into a false "no subscription" for a customer who genuinely has
 * one.
 */
export async function resolveOwner(): Promise<OwnerContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data: subscriptions } = await serviceRoleClient()
    .from('agent_subscriptions')
    .select('client_domain')
    .eq('user_email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)

  const clientDomain = subscriptions?.[0]?.client_domain
  if (!clientDomain) return null

  return { email: user.email, clientDomain }
}

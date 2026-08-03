import { createClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'

/**
 * Middleware only gates page routes (see middleware.ts config.matcher — it has no
 * /api/:path* entry), so any admin-only API route must check this itself.
 * Returns the authenticated admin's email, or null if not logged in / not an admin.
 */
export async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return null
  return user.email!
}

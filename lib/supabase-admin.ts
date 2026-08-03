import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Server-only; never import from a Client Component.
// Factored out here since ops-brief adds multiple call sites; existing admin code inlines
// this same one-liner per-file (see app/(portal)/admin/page.tsx).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

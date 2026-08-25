import { unstable_noStore as noStore } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import PhotoUploadTool from './PhotoUploadTool'

// Auto-protected by middleware.ts (config.matcher includes /admin/:path*).
export default async function LeadEnginePhotosTestPage() {
  noStore()

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Every site, not just the 8 seeded review fixtures — this harness is also the only way to
  // attach a real photo to a real site until Chunk C's admin edit page exists. Originally scoped
  // to `review-%` only; widened 2026-08-25 when the first real site (created outside the seed
  // script) couldn't appear in the dropdown at all.
  const { data: sites } = await supabaseAdmin
    .from('lead_engine_sites')
    .select('id, slug, business_name')
    .order('slug')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Lead Engine — Photo Upload Test</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Internal test harness for the Part B photo pipeline — no client-facing polish, not part of
          the product. Exercises the real routes: <code>POST /api/lead-engine/photos/sign</code>,
          a direct browser upload to Supabase Storage, then <code>POST /api/lead-engine/photos</code>.
          Pick one of the review fixture sites below and attach a real photo to it, HEIC included.
        </p>
      </div>
      <PhotoUploadTool sites={sites ?? []} />
    </div>
  )
}

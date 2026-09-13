import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { listSitesForAdmin } from '@/lib/lead-engine/site'
import PhotoUploadTool from './PhotoUploadTool'

// Auto-protected by middleware.ts (config.matcher includes /admin/:path*).
export default async function LeadEnginePhotosTestPage() {
  noStore()

  // Shared with /admin/lead-engine rather than queried inline here. This page ran its own select
  // and drifted once already: it was scoped to `review-%` and could not see the first real site at
  // all, which is precisely the two-readers-of-one-table shape that keeps costing this project.
  const sites = await listSitesForAdmin()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Lead Engine — Photos</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Internal tool, not client-facing — this is how photos get onto a site until the customer
          dashboard uploader is built. Pick a site, attach photos (several at once, HEIC included),
          caption them and choose which one is the hero. The list underneath is what is actually on
          the site right now.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/admin/lead-engine" className="underline text-slate-700 dark:text-slate-300">
            ← All sites
          </Link>
        </p>
      </div>
      <PhotoUploadTool sites={sites ?? []} />
    </div>
  )
}

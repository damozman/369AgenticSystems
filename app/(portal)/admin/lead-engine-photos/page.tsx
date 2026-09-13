import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { listSitesForAdmin } from '@/lib/lead-engine/site'
import {
  MAX_PHOTOS_PER_SITE, MAX_PHOTO_BYTES, MIN_PHOTO_LONG_EDGE, WARN_PHOTO_LONG_EDGE,
} from '@/lib/lead-engine/limits'
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
        <div className="mt-4 rounded border border-slate-300 dark:border-slate-700 p-4 text-sm text-slate-700 dark:text-slate-300">
          <strong className="block mb-1 text-slate-900 dark:text-white">What a photo needs</strong>
          <ul className="space-y-1 list-disc pl-5">
            <li>
              <strong>{WARN_PHOTO_LONG_EDGE}px or more</strong> on the longest side to be used as
              the hero or the full-width band. Those are displayed very large, so anything smaller
              softens.
            </li>
            <li>
              <strong>At least {MIN_PHOTO_LONG_EDGE}px</strong> on the longest side to be accepted
              at all. Below that it is refused.
            </li>
            <li>
              Under {MAX_PHOTO_BYTES / (1024 * 1024)}MB each, up to {MAX_PHOTOS_PER_SITE} per site.
              JPEG, PNG, WebP or HEIC — straight off a phone is fine.
            </li>
          </ul>
          <p className="mt-2 text-slate-500">
            This is about <em>pixels</em>, not how big it looks on your screen. A photo that fills
            your browser can still be under {WARN_PHOTO_LONG_EDGE}px. Each photo&rsquo;s real size
            is shown in the list below.
          </p>
        </div>
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

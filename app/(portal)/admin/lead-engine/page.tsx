import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { listSitesForAdmin, type AdminSiteRow } from '@/lib/lead-engine/site'
import type { SiteStatus } from '@/lib/lead-engine/types'

// Auto-protected by middleware.ts (config.matcher includes /admin/:path*).
export const dynamic = 'force-dynamic'

/**
 * What each status means to the person reading the table, in their words rather than the
 * database's. `in_build` and `awaiting_answers` are schema vocabulary and say nothing about what
 * the operator should do next.
 */
const STATUS_LABEL: Record<SiteStatus, string> = {
  draft: 'Draft',
  awaiting_answers: 'Waiting on them',
  in_build: 'Ready to build',
  live: 'Live',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

const STATUS_CLASS: Record<SiteStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  awaiting_answers: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  in_build: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  live: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
}

function when(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function LeadEngineSitesPage() {
  noStore()
  const sites = await listSitesForAdmin()

  // Surfaced as its own count rather than left for the reader to spot in the table: this is the
  // one signal that means a specific site is waiting on a person.
  const needingReview = sites.filter(s => s.needs_review)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Lead Engine — Sites</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Every mini-site, most recently touched first.{' '}
          {needingReview.length > 0 ? (
            <strong className="text-amber-700 dark:text-amber-400">
              {needingReview.length} {needingReview.length === 1 ? 'site has' : 'sites have'} new
              answers since the page was built.
            </strong>
          ) : (
            'Nothing is waiting on new answers.'
          )}
        </p>
      </div>

      {sites.length === 0 ? (
        <p className="text-slate-500">
          No sites yet. They are created by an operator, then the owner fills in the questionnaire.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-slate-300 dark:border-slate-700">
              <th className="py-2 pr-4 font-medium">Business</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Launched</th>
              <th className="py-2 pr-4 font-medium">Updated</th>
              <th className="py-2 font-medium">Photos</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s: AdminSiteRow) => (
              <tr key={s.id} className="border-b border-slate-200 dark:border-slate-800 align-top">
                <td className="py-3 pr-4">
                  <div className="font-medium text-slate-900 dark:text-white">{s.business_name}</div>
                  <div className="text-xs text-slate-500 font-mono">{s.slug}</div>
                  <div className="text-xs text-slate-500">{s.owner_email}</div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_CLASS[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                  {s.needs_review && (
                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      New answers to review
                    </div>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{when(s.launched_at)}</td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{when(s.updated_at)}</td>
                <td className="py-3">
                  <Link href="/admin/lead-engine-photos" className="underline text-slate-700 dark:text-slate-300">
                    Photos
                  </Link>
                  {s.status === 'live' && (
                    <>
                      {' · '}
                      <a href={`/sites/${s.slug}`} target="_blank" rel="noreferrer" className="underline text-slate-700 dark:text-slate-300">
                        View
                      </a>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

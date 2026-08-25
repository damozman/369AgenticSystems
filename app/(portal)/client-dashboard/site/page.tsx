import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadSiteForOwner, listSubmissions, listChangeRequests } from '@/lib/lead-engine/site'
import { decideRevision } from '@/lib/lead-engine/limits'
import ChangeRequestForm from './ChangeRequestForm'

/**
 * The Lead Engine customer dashboard — Chunk B's third piece: submissions, counts, a
 * change-request form. Its own tenant lookup, separate from the voice product's
 * `agent_subscriptions` — Lead Engine stands alone, so this page must work for a customer who has
 * never bought Ava. Reached either directly or via the redirect in `../page.tsx` for a
 * Lead-Engine-only customer whose voice lookup came back empty.
 */
export default async function LeadEngineSitePage() {
  noStore()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: rows } = user?.email
    ? await admin
        .from('lead_engine_sites')
        .select('id')
        .eq('owner_email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
    : { data: null }

  const siteId = rows?.[0]?.id as string | undefined

  if (!siteId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Lead Engine site yet</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6 leading-relaxed">
          Your account isn&apos;t linked to a site yet. Contact us to get one set up.
        </p>
        <a
          href="mailto:chris@369agenticsystems.com?subject=Lead Engine Setup"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: '#D4AF37', color: '#000' }}
        >
          Contact us
        </a>
      </div>
    )
  }

  const site = await loadSiteForOwner(siteId)
  if (!site) return null

  const [submissions, changeRequests] = await Promise.all([
    listSubmissions(siteId),
    listChangeRequests(siteId),
  ])

  const revision = decideRevision({ revisionsUsed: site.revisions_used, launchedAt: site.launched_at })
  const isLive = site.status === 'live'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1">Lead Engine</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{site.business_name}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Status: <span className="font-semibold">{STATUS_LABEL[site.status]}</span>
          {isLive && (
            <>
              {' · '}
              <a href={`/sites/${site.slug}`} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
                View your site →
              </a>
            </>
          )}
          {!site.questionnaireCompleted && ' · Waiting on your questionnaire answers'}
        </p>
      </div>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-3">
          Leads ({submissions.length})
        </h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No leads yet — they&apos;ll show up here as soon as someone fills out your form.</p>
        ) : (
          <div className="space-y-2">
            {submissions.map(s => (
              <div key={s.id} className="border border-[var(--border-faint)] rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold text-[var(--text-primary)]">{s.name ?? 'Unnamed'}</span>
                  <span className="text-xs text-[var(--text-muted)]">{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="text-[var(--text-muted)] text-xs mt-0.5">
                  {[s.email, s.phone].filter(Boolean).join(' · ')}
                </div>
                {s.message && <p className="mt-1.5 text-[var(--text-secondary)]">{s.message}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-3">
          Request a change
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-3">{revision.message}</p>
        <ChangeRequestForm siteId={siteId} />

        {changeRequests.length > 0 && (
          <div className="mt-6 space-y-2">
            {changeRequests.map(r => (
              <div key={r.id} className="border border-[var(--border-faint)] rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{r.body}</span>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-2">
                    {r.status}{r.billable ? ' · billable' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Being set up',
  awaiting_answers: 'Waiting on your answers',
  in_build: 'In build',
  live: 'Live',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

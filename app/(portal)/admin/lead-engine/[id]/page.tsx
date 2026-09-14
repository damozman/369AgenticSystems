import Link from 'next/link'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import {
  loadPhotos, loadSiteById, loadSiteForQuestionnaire, listSubmissions,
} from '@/lib/lead-engine/site'
import { allocatePhotos } from '@/lib/lead-engine/photos'
import { contentFrom } from '@/lib/lead-engine/content'
import { serviceReadiness } from '@/lib/lead-engine/sections'
import ReviewTool from './ReviewTool'

// Auto-protected by middleware.ts (config.matcher includes /admin/:path*).
export const dynamic = 'force-dynamic'

export default async function LeadEngineSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  noStore()

  const site = await loadSiteById(id)
  if (!site) notFound()

  // Two reads because SITE_COLUMNS deliberately excludes `questionnaire` — the renderer must never
  // see raw answers, so the column is not in the shared select list. This page is the one place
  // that legitimately needs both halves.
  const withAnswers = await loadSiteForQuestionnaire(id)
  const answers = withAnswers?.answers ?? null

  const [photos, submissions] = await Promise.all([
    loadPhotos(id),
    listSubmissions(id, 10),
  ])

  // Built once and read twice below — the photo allocation and the service readiness must be
  // looking at the same content, or the review screen contradicts itself.
  const content = answers ? contentFrom(answers, site.business_name) : null

  // Shown so the operator can see WHERE each photo lands before publishing, rather than finding
  // out by looking at the rendered page. Asks for the full set of slots; the real page asks for
  // what its template uses, so this is the upper bound rather than an exact preview.
  const allocation = allocatePhotos(photos, {
    hero: true,
    band: true,
    serviceSlots: content?.services?.length ?? 0,
  })

  // Which services have their own page, and what the ones that do not are short of. Computed from
  // the same `serviceEarnsPage` the renderer uses, so this screen cannot promise a page the site
  // refuses to build. The gaps are the useful half: they are what to go back and ask the customer
  // for, rather than a silent quality difference nobody notices.
  const readiness = content
    ? serviceReadiness(content, {
        photos,
        faqs: content.faqs ?? [],
        testimonials: content.testimonials ?? [],
      })
    : []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-sm">
          <Link href="/admin/lead-engine" className="underline text-slate-700 dark:text-slate-300">
            ← All sites
          </Link>
        </p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{site.business_name}</h1>
        <p className="text-slate-500 font-mono text-sm">/sites/{site.slug}</p>
      </div>

      <ReviewTool
        siteId={site.id}
        slug={site.slug}
        businessName={site.business_name}
        status={site.status}
        headlineNoun={site.headline_noun ?? ''}
        footerNote={site.footer_note ?? ''}
        answers={answers}
        photoCount={photos.length}
        allocation={{
          hero: allocation.hero?.caption ?? (allocation.hero ? 'Untitled' : null),
          band: allocation.band?.caption ?? (allocation.band ? 'Untitled' : null),
          services: allocation.services.length,
          gallery: allocation.gallery.length,
        }}
        services={readiness.map(r => ({
          name: r.name,
          slug: r.slug,
          earns: r.earns,
          wordCount: r.wordCount,
          wordsNeeded: r.wordsNeeded,
          hasPhoto: r.hasPhoto,
          faqCount: r.faqCount,
          testimonialCount: r.testimonialCount,
          missing: r.missing,
        }))}
        submissionCount={submissions.length}
      />
    </div>
  )
}

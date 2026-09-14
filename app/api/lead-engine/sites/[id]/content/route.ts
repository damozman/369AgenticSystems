import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { loadSiteById, loadSiteForQuestionnaire, saveContent, updateSiteFields } from '@/lib/lead-engine/site'
import { contentFrom } from '@/lib/lead-engine/content'
import type { QuestionnaireAnswers } from '@/lib/lead-engine/types'

/**
 * Build a site's rendered content from (possibly corrected) answers. Admin only.
 *
 * ── The body carries ANSWERS, not SiteContent, and that is the design ──
 * `list()` and `servicesFrom()` in lib/lead-engine/content.ts are private. Accepting a SiteContent
 * here would mean the admin form parsing its own services and service-area text — a second parser
 * for the same strings, which is the two-writers shape this project has been bitten by twice.
 * Taking answers means the operator's correction normalises through EXACTLY the path the
 * customer's original answer took, with no new code and nothing to drift.
 *
 * ── The edited answers are deliberately NOT persisted ──
 * Only `content` is written. The `questionnaire` column stays the customer's untouched record,
 * which is what makes "Regenerate from answers" a re-read rather than an undo stack, and what
 * keeps `saveContent`'s single-writer promise honest. An operator correcting a typo must not
 * silently rewrite what the customer said.
 *
 * `saveContent` clears `needs_review` as a side effect, which is correct here: a human has now
 * looked at the answers that raised it.
 *
 * `force-dynamic` because it reads the site fresh and writes based on it.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { answers?: QuestionnaireAnswers; headlineNoun?: string; footerNote?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.answers || typeof body.answers !== 'object') {
    return NextResponse.json({ error: 'answers is required' }, { status: 400 })
  }

  const site = await loadSiteById(id)
  if (!site) return NextResponse.json({ error: 'No such site.' }, { status: 404 })

  // The business name falls back to the SITE's, not to whatever the form posted: `contentFrom`
  // needs a non-empty name and the site row always has one, whereas an operator can empty the
  // field. Same argument the questionnaire route makes when it passes its own fallback.
  const content = contentFrom(body.answers, site.business_name)

  const saved = await saveContent(id, content)
  if (!saved.ok) return NextResponse.json({ error: saved.error ?? 'Could not save content.' }, { status: 500 })

  // Separate write, because these two are columns rather than content — see updateSiteFields.
  // Ordered after saveContent so a failure here leaves the content saved rather than the reverse:
  // content is the bulk of the work and the harder thing to retype.
  const fields = await updateSiteFields(id, {
    headlineNoun: body.headlineNoun,
    footerNote: body.footerNote,
  })
  if (!fields.ok) {
    return NextResponse.json(
      { error: `Content saved, but the headline noun and footer note did not: ${fields.error}` },
      { status: 500 },
    )
  }

  console.log(`[LEAD-ENGINE] ${admin} saved content for ${id} (/sites/${site.slug})`)
  return NextResponse.json({ ok: true, slug: site.slug, content })
}

/**
 * The stored answers, for "Regenerate from answers".
 *
 * The page already server-renders them once; this exists so the button can discard form state
 * without a full reload, and so it reads the CURRENT stored answers rather than a copy captured
 * when the page loaded — the customer may have resubmitted in the meantime, which is exactly the
 * case `needs_review` flags.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const site = await loadSiteForQuestionnaire(id)
  if (!site) return NextResponse.json({ error: 'No such site.' }, { status: 404 })

  return NextResponse.json({ answers: site.answers, businessName: site.businessName })
}

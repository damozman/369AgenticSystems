import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { setSiteStatus } from '@/lib/lead-engine/site'
import { SITE_STATUSES, type SiteStatus } from '@/lib/lead-engine/types'

/**
 * Publish, unpublish or suspend a site. Admin only.
 *
 * This is the only way to put a Lead Engine site in front of the public. Until it existed nothing
 * in the app or in `scripts/` ever wrote `status: 'live'`, so a finished site could only be
 * published by hand-editing the database.
 *
 * **`requireAdmin()` rather than middleware.** `middleware.ts`'s matcher covers `/admin/:path*`
 * and has no `/api` entry, so an API route that relies on it is not gated at all. This one changes
 * whether a page is visible to strangers, which makes it exactly the wrong route to get that wrong
 * on.
 *
 * `force-dynamic` because it reads the site's current status and writes based on it; a cached read
 * here would decide a transition from a stale starting point.
 */
export const dynamic = 'force-dynamic'

function isSiteStatus(value: unknown): value is SiteStatus {
  return typeof value === 'string' && (SITE_STATUSES as readonly string[]).includes(value)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: { status?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validated against the real union rather than trusted: `setSiteStatus` looks the incoming value
  // up in a transition table, and an unknown key there returns undefined, which `canTransition`
  // would read as "no legal transitions" -- a refusal, but a confusing one. Rejecting here says
  // what actually went wrong.
  if (!isSiteStatus(payload.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${SITE_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const result = await setSiteStatus(params.id, payload.status)
  if (!result.ok) {
    // 409, not 400: the request is well-formed and the caller is allowed -- the SITE is not in a
    // state where this makes sense. A publish refused for missing content should read differently
    // from a malformed body, because the fix is different.
    return NextResponse.json({ error: result.error }, { status: 409 })
  }

  console.log(`[LEAD-ENGINE] ${admin} set ${params.id} to ${result.status}`)
  return NextResponse.json({
    ok: true,
    slug: result.slug,
    status: result.status,
    alreadyInStatus: result.alreadyInStatus,
    // Surfaced, never enforced: the customer changed their answers after the content was built.
    // Worth saying out loud on a publish; not grounds for refusing one.
    needsReview: result.needsReview,
  })
}

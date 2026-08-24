import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createStorageAdminClient, resolveOwnedSite } from '@/lib/lead-engine/photo-storage'
import { decideRevision } from '@/lib/lead-engine/limits'

/**
 * A customer asking for something to change on their live site.
 *
 * **This never refuses** — see `decideRevision`'s own note. A request outside the included
 * allowance is still recorded and still answered, just flagged billable, because a request we
 * decline to record is a lost conversation, not a saved one.
 *
 * `force-dynamic` for the same reason as the other two Chunk B routes: `decideRevision` reads
 * `revisions_used` and `launched_at` fresh on every call, and a cached read here would let a
 * customer's revision count silently disagree with what actually happened. Explicit rather than
 * relying on `createClient()`'s own `cookies()` call to imply it.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: { siteId?: string; body?: string }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const siteId = payload.siteId?.trim()
  const body = payload.body?.trim().slice(0, 2000)
  if (!siteId || !body) {
    return NextResponse.json({ error: 'siteId and a description of the change are required' }, { status: 400 })
  }

  const admin = createStorageAdminClient()
  const site = await resolveOwnedSite(admin, siteId, user.email)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: full } = await admin
    .from('lead_engine_sites')
    .select('revisions_used, launched_at')
    .eq('id', siteId)
    .single()

  const decision = decideRevision({
    revisionsUsed: full?.revisions_used ?? 0,
    launchedAt: full?.launched_at ?? null,
  })

  const { data: row, error } = await admin
    .from('lead_engine_change_requests')
    .insert({ site_id: siteId, body, billable: !decision.included })
    .select('id')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'Could not save your request' }, { status: 500 })
  }

  if (decision.included) {
    await admin.from('lead_engine_sites').update({ revisions_used: (full?.revisions_used ?? 0) + 1 }).eq('id', siteId)
  }

  return NextResponse.json({ ok: true, message: decision.message, billable: !decision.included })
}

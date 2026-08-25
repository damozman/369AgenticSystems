import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase-server'
import { createStorageAdminClient, resolveOwnedSite, incomingPath, PHOTOS_INCOMING_BUCKET } from '@/lib/lead-engine/photo-storage'

/**
 * Step 1 of 2 for a photo upload — see the doc comment on `lib/lead-engine/photo-storage.ts` for
 * why this exists at all. Mints a signed URL the browser uploads the RAW file to directly, so the
 * up-to-20MB original never has to pass through this Vercel Function's 4.5MB request-body limit.
 *
 * Returns just `{ path, token }`; the browser calls Supabase's own
 * `storage.from(bucket).uploadToSignedUrl(path, token, file)` with them, then POSTs `path` to
 * `/api/lead-engine/photos` (the other half) once that upload finishes.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { siteId?: string; filename?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const siteId = body.siteId?.trim()
  const filename = body.filename?.trim()
  if (!siteId || !filename) {
    return NextResponse.json({ error: 'siteId and filename are required' }, { status: 400 })
  }

  const admin = createStorageAdminClient()
  const site = await resolveOwnedSite(admin, siteId, user.email)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const path = incomingPath(siteId, randomUUID(), filename)
  const { data, error } = await admin.storage.from(PHOTOS_INCOMING_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Could not create an upload URL' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token })
}

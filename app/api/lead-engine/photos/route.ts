import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase-server'
import {
  createStorageAdminClient, resolveOwnedSite, variantPath,
  PHOTOS_BUCKET, PHOTOS_INCOMING_BUCKET,
} from '@/lib/lead-engine/photo-storage'
import { decidePhotoUpload, MAX_PHOTOS_PER_SITE } from '@/lib/lead-engine/limits'
import { loadPhotos, loadSiteById } from '@/lib/lead-engine/site'
import { normalizeToRaster, processPhoto } from '@/lib/lead-engine/photo-pipeline'
import type { PhotoVariant } from '@/lib/lead-engine/types'
import { PHOTO_SLOTS } from '@/lib/lead-engine/types'

/**
 * Step 2 of 2 — see `lib/lead-engine/photo-storage.ts` for why this is a JSON call naming a
 * storage path rather than a multipart upload. By the time this runs, the raw file already
 * reached `PHOTOS_INCOMING_BUCKET` directly from the browser via the `sign` route's signed URL;
 * this route fetches it server-to-server (not bound by the inbound 4.5MB limit), runs
 * `lib/lead-engine/photo-pipeline.ts`, stores the results in the PUBLIC bucket, writes the DB row,
 * and deletes the raw original either way — it must never linger, processed or not.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { siteId?: string; incomingPath?: string; filename?: string; caption?: string; isPrimary?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const siteId = body.siteId?.trim()
  const path = body.incomingPath?.trim()
  const filename = body.filename?.trim() ?? path ?? 'photo'
  if (!siteId || !path) {
    return NextResponse.json({ error: 'siteId and incomingPath are required' }, { status: 400 })
  }
  // The path is server-generated (lib/lead-engine/photo-storage.ts's incomingPath) and always
  // starts with the site id it was minted for — a mismatch here means someone is naming a path
  // that was never signed for their site.
  if (!path.startsWith(`${siteId}/`)) {
    return NextResponse.json({ error: 'incomingPath does not belong to this site' }, { status: 400 })
  }

  const admin = createStorageAdminClient()
  const site = await resolveOwnedSite(admin, siteId, user.email)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cleanupIncoming = () => admin.storage.from(PHOTOS_INCOMING_BUCKET).remove([path]).catch(() => {})

  const { data: blob, error: downloadError } = await admin.storage.from(PHOTOS_INCOMING_BUCKET).download(path)
  if (downloadError || !blob) {
    return NextResponse.json({ error: 'Upload not found — it may have expired. Try again.' }, { status: 404 })
  }

  const rawBuffer = Buffer.from(await blob.arrayBuffer())

  let contentType = blob.type || ''
  if (!contentType || contentType === 'application/octet-stream') {
    const ext = filename.toLowerCase().split('.').pop()
    contentType = ext === 'heic' ? 'image/heic'
      : ext === 'heif' ? 'image/heif'
      : ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg'
  }

  const { count: currentCount } = await admin
    .from('lead_engine_photos')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)

  const gate = decidePhotoUpload({
    currentCount: currentCount ?? 0,
    bytes: rawBuffer.length,
    contentType,
    filename,
  })
  if (!gate.allowed) {
    await cleanupIncoming()
    return NextResponse.json({ error: gate.reason }, { status: 400 })
  }

  try {
    const { buffer: raster } = await normalizeToRaster(rawBuffer, contentType)
    const processed = await processPhoto(raster)

    if (processed.resolution.status === 'reject') {
      await cleanupIncoming()
      return NextResponse.json({ error: processed.resolution.message }, { status: 400 })
    }

    const photoId = randomUUID()
    const variants: PhotoVariant[] = []

    for (const v of processed.variants) {
      const webpPath = variantPath(siteId, photoId, v.width, 'webp')
      const jpgPath = variantPath(siteId, photoId, v.width, 'jpg')
      const [webpUp, jpgUp] = await Promise.all([
        admin.storage.from(PHOTOS_BUCKET).upload(webpPath, v.webp, { contentType: 'image/webp' }),
        admin.storage.from(PHOTOS_BUCKET).upload(jpgPath, v.jpg, { contentType: 'image/jpeg' }),
      ])
      if (webpUp.error || jpgUp.error) {
        throw new Error(webpUp.error?.message ?? jpgUp.error?.message ?? 'Storage upload failed')
      }
      variants.push({
        width: v.width,
        webp: admin.storage.from(PHOTOS_BUCKET).getPublicUrl(webpPath).data.publicUrl,
        jpg: admin.storage.from(PHOTOS_BUCKET).getPublicUrl(jpgPath).data.publicUrl,
      })
    }

    const largest = variants[variants.length - 1]
    const isPrimary = body.isPrimary === true

    if (isPrimary) {
      // At most one primary per site (also enforced by the DB's partial unique index) — clear
      // any existing one first so the insert below cannot violate it.
      await admin.from('lead_engine_photos').update({ is_primary: false }).eq('site_id', siteId).eq('is_primary', true)
    }

    const { data: row, error: insertError } = await admin
      .from('lead_engine_photos')
      .insert({
        id: photoId,
        site_id: siteId,
        storage_path: variantPath(siteId, photoId, largest.width, 'webp'),
        caption: body.caption?.trim() || null,
        sort_order: currentCount ?? 0,
        bytes: rawBuffer.length,
        content_type: 'image/webp',
        width: processed.width,
        height: processed.height,
        aspect_ratio: processed.aspectRatio,
        dominant_hex: processed.dominantHex,
        variants,
        is_primary: isPrimary,
      })
      .select()
      .single()

    if (insertError || !row) throw new Error(insertError?.message ?? 'Could not save the photo')

    await cleanupIncoming()

    return NextResponse.json({
      photo: {
        id: row.id,
        url: largest.webp,
        caption: row.caption,
        variants,
        aspectRatio: row.aspect_ratio,
        dominantHex: row.dominant_hex,
        isPrimary: row.is_primary,
      },
      warning: processed.resolution.status === 'warn' ? processed.resolution.message : undefined,
    })
  } catch (err) {
    await cleanupIncoming()
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not process this photo' },
      { status: 500 },
    )
  }
}

/**
 * Every photo on a site, in display order.
 *
 * Added for the admin tool, which previously showed only the single most-recently-uploaded photo —
 * so after uploading several there was no way to tell from the page how many had actually landed,
 * or which one was the hero. "How many did that take?" had to be answered by querying the database
 * by hand.
 *
 * Reuses `photoFromRow` rather than mapping again here: the renderer and this tool must agree
 * about what a photo IS, and the bug that function exists to prevent was precisely two readers
 * disagreeing about which columns matter. `isPrimary` shown here is the same field the hero slot
 * reads, which is the whole point of showing it.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const siteId = new URL(request.url).searchParams.get('siteId')
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 })

  const admin = createStorageAdminClient()
  const site = await resolveOwnedSite(admin, siteId, user.email)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const photos = await loadPhotos(siteId)

  // The service NAMES, so the slot picker can offer real tiles rather than asking someone to type
  // a name that has to match exactly. An unbuilt site has no content yet and returns none, which
  // the UI shows as "build the page content first" rather than an empty dropdown.
  const full = await loadSiteById(siteId)
  const services = (full?.content?.services ?? []).map(svc => svc.name)

  return NextResponse.json({ photos, services, count: photos.length, max: MAX_PHOTOS_PER_SITE })
}

/**
 * Re-assign an existing photo: where it goes, its caption, whether it is the hero.
 *
 * The reason this exists rather than only accepting slots at upload time: by the time anyone can
 * SEE that the "Drain cleaning" tile is showing a bedroom, the photo is already uploaded. Fixing
 * it by deleting and re-uploading would mean re-running a HEIC decode and four resize passes to
 * change one text field.
 *
 * Singleton slots are cleared before being claimed. `hero` and `band` have partial unique indexes
 * per site, so assigning a second one would otherwise fail on a constraint the operator cannot
 * see -- the same shape the existing `is_primary` write already handles by clearing first.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { photoId?: string; slot?: string | null; slotKey?: string | null; caption?: string | null; isPrimary?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const photoId = body.photoId?.trim()
  if (!photoId) return NextResponse.json({ error: 'photoId is required' }, { status: 400 })

  const admin = createStorageAdminClient()
  const { data: photo } = await admin
    .from('lead_engine_photos')
    .select('id, site_id')
    .eq('id', photoId)
    .maybeSingle()
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const site = await resolveOwnedSite(admin, photo.site_id, user.email)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}

  if (body.slot !== undefined) {
    const slot = body.slot
    if (slot !== null && !(PHOTO_SLOTS as readonly string[]).includes(slot)) {
      return NextResponse.json(
        { error: `slot must be null or one of: ${PHOTO_SLOTS.join(', ')}` },
        { status: 400 },
      )
    }
    // A service pin without a name cannot resolve to a tile, so it would silently behave as
    // "automatic" while the UI showed it as assigned. Refuse rather than store the ambiguity.
    if (slot === 'service' && !body.slotKey?.trim()) {
      return NextResponse.json({ error: 'Pick which service this photo belongs to.' }, { status: 400 })
    }
    patch.slot = slot
    patch.slot_key = slot === 'service' ? body.slotKey!.trim() : null

    if (slot === 'hero' || slot === 'band') {
      await admin.from('lead_engine_photos')
        .update({ slot: null, slot_key: null })
        .eq('site_id', photo.site_id).eq('slot', slot).neq('id', photoId)
    }
  }

  if (body.caption !== undefined) patch.caption = body.caption?.trim() || null

  if (body.isPrimary !== undefined) {
    patch.is_primary = body.isPrimary === true
    if (body.isPrimary === true) {
      await admin.from('lead_engine_photos')
        .update({ is_primary: false })
        .eq('site_id', photo.site_id).eq('is_primary', true).neq('id', photoId)
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })

  const { error } = await admin.from('lead_engine_photos').update(patch).eq('id', photoId)
  if (error) {
    // The unique indexes are the last word on "one photo per service". Surfaced in the operator's
    // terms rather than as a Postgres constraint name.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Another photo is already assigned there. Move that one first.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const photoId = new URL(request.url).searchParams.get('photoId')
  if (!photoId) return NextResponse.json({ error: 'photoId is required' }, { status: 400 })

  const admin = createStorageAdminClient()
  const { data: photo } = await admin
    .from('lead_engine_photos')
    .select('id, site_id, variants')
    .eq('id', photoId)
    .maybeSingle()
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const site = await resolveOwnedSite(admin, photo.site_id, user.email)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const variants: PhotoVariant[] = Array.isArray(photo.variants) ? photo.variants : []
  const paths = variants.flatMap(v => [
    variantPath(photo.site_id, photo.id, v.width, 'webp'),
    variantPath(photo.site_id, photo.id, v.width, 'jpg'),
  ])
  if (paths.length > 0) {
    await admin.storage.from(PHOTOS_BUCKET).remove(paths)
  }

  const { error } = await admin.from('lead_engine_photos').delete().eq('id', photoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase-server'
import {
  createStorageAdminClient, resolveOwnedSite, variantPath,
  PHOTOS_BUCKET, PHOTOS_INCOMING_BUCKET,
} from '@/lib/lead-engine/photo-storage'
import { decidePhotoUpload } from '@/lib/lead-engine/limits'
import { normalizeToRaster, processPhoto } from '@/lib/lead-engine/photo-pipeline'
import type { PhotoVariant } from '@/lib/lead-engine/types'

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

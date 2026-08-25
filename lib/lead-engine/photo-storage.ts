/**
 * Bucket names, paths, and the site-ownership check both photo routes share.
 *
 * **Two buckets, not one, and the split is load-bearing.** Vercel Functions cap request AND
 * response bodies at 4.5MB, hard, unconfigurable (confirmed against Vercel's own docs 2026-08-24)
 * — so the 20MB raw upload `docs/PHOTO-REQUIREMENTS.md` Part B calls for can never travel through
 * our own route as a request body. The fix is the standard one: the browser uploads the raw file
 * straight to Storage with a signed URL our `sign` route mints (POST /api/lead-engine/photos/sign,
 * a few hundred bytes either direction), then a second, equally tiny JSON call
 * (POST /api/lead-engine/photos) tells us the path so we can fetch it *server-to-server* — which
 * is not subject to the inbound-request limit — and run it through the pipeline.
 *
 * The raw original MUST NOT land in the public bucket, even briefly: it still carries whatever
 * EXIF/GPS it arrived with (stripping happens in the pipeline, not before), and a customer's job
 * photo can be the GPS coordinates of someone's home. `PHOTOS_INCOMING_BUCKET` is a SEPARATE,
 * PRIVATE bucket for exactly that reason. Both buckets are created by hand in the Supabase
 * dashboard — buckets are not DDL, same as the public one in the original migration.
 */

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/admin'

export const PHOTOS_BUCKET = 'lead-engine-photos'
export const PHOTOS_INCOMING_BUCKET = 'lead-engine-photos-incoming'

export function createStorageAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Where a finished variant lives in the PUBLIC bucket. */
export function variantPath(siteId: string, photoId: string, width: number, ext: 'webp' | 'jpg'): string {
  return `${siteId}/${photoId}/${width}.${ext}`
}

/** Where a raw, not-yet-processed upload lives in the PRIVATE incoming bucket. Not guessable from
 *  a photo id — it never becomes one, it is deleted once the pipeline has read it. */
export function incomingPath(siteId: string, uploadId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  return `${siteId}/${uploadId}-${safeName}`
}

export interface OwnedSite {
  id: string
  owner_email: string
}

/**
 * The one ownership check both routes need: does this email own this site, or are they us. Reused
 * rather than duplicated so the two routes cannot drift into checking different things — exactly
 * the RLS policies' own logic (`lower(owner_email) = lower(jwt email) OR is_369_admin()`), applied
 * here because these routes write under the service-role key and RLS does not run for them at all.
 */
export async function resolveOwnedSite(
  admin: ReturnType<typeof createStorageAdminClient>,
  siteId: string,
  email: string,
): Promise<OwnedSite | null> {
  const { data: site } = await admin
    .from('lead_engine_sites')
    .select('id, owner_email')
    .eq('id', siteId)
    .maybeSingle()
  if (!site) return null
  if (site.owner_email.toLowerCase() !== email.toLowerCase() && !isAdminEmail(email)) return null
  return site
}

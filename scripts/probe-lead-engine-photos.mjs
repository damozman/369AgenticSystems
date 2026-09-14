/**
 * Do the photos a site claims to have actually EXIST, and can a browser fetch them?
 *
 * Read-only. Writes nothing, deletes nothing, uploads nothing.
 *
 * ── Why this exists ──
 * The photo tool said "18 of 18" and every tile rendered blank. Both facts were true: the rows
 * were there and the images were not. Nothing in this project could tell those two apart, because
 * every check stopped at the database row — the seed verified its own inserts, `loadPhotos` builds
 * a URL from `storage_path` without ever asking whether an object sits at it, and the tool renders
 * that URL and shows whatever the browser gets, including nothing.
 *
 * A row is a claim that a photo exists. This asks the storage bucket, and then asks the URL the
 * page actually uses, which are two different questions:
 *   - the object can be missing from the bucket entirely, or
 *   - the object can be there while the bucket is PRIVATE, so the public URL 404s for a visitor
 *     while every server-side check passes.
 * The second one is invisible from inside Supabase and is exactly the shape that ships.
 *
 *   node --env-file=.env.local scripts/probe-lead-engine-photos.mjs
 *   node --env-file=.env.local scripts/probe-lead-engine-photos.mjs review-trade-classic
 */

import { createClient } from '@supabase/supabase-js'

const PHOTO_BUCKET = 'lead-engine-photos'
const only = process.argv[2] ?? null

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
let problems = 0

const { data: bucket } = await supabase.storage.getBucket(PHOTO_BUCKET)
if (!bucket) {
  console.error(`✗ the bucket "${PHOTO_BUCKET}" does not exist`)
  process.exit(1)
}
console.log(`Bucket ${PHOTO_BUCKET}: ${bucket.public ? 'PUBLIC' : '🔴 PRIVATE — every public URL will 404'}`)
if (!bucket.public) problems++

const { data: sites, error } = await supabase
  .from('lead_engine_sites')
  .select('id, slug, business_name')
  .order('slug')
if (error) { console.error(`✗ ${error.message}`); process.exit(1) }

for (const site of sites ?? []) {
  if (only && site.slug !== only) continue

  const { data: rows } = await supabase
    .from('lead_engine_photos')
    .select('id, storage_path, width, height')
    .eq('site_id', site.id)
    .order('sort_order')

  if (!rows?.length) { console.log(`\n${site.slug}: no photo rows`); continue }

  // What the bucket actually holds under this site's folder.
  const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(site.id, { limit: 1000 })
  const held = new Set((files ?? []).map(f => `${site.id}/${f.name}`))

  const missing = rows.filter(r => !held.has(r.storage_path))
  const orphans = [...held].filter(p => !rows.some(r => r.storage_path === p))

  // The consumer's view. A HEAD on the exact URL the page puts in its <img src>, unauthenticated,
  // which is the only version of this question a visitor's browser ever asks.
  let unfetchable = 0
  let firstFailure = null
  for (const row of rows) {
    const url = `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${row.storage_path}`
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (!res.ok) { unfetchable++; firstFailure ??= `${res.status} on ${url}` }
    } catch (e) {
      unfetchable++
      firstFailure ??= `${e.message} on ${url}`
    }
  }

  const noSize = rows.filter(r => !r.width || !r.height).length
  console.log(`\n${site.slug} — ${rows.length} row(s)`)
  missing.length     ? console.error(`  ✗ ${missing.length} row(s) point at a file that is NOT in the bucket`)
                     : console.log('  ✓ every row has a file in the bucket')
  unfetchable        ? console.error(`  ✗ ${unfetchable} of ${rows.length} are not fetchable — ${firstFailure}`)
                     : console.log('  ✓ every photo answers over its public URL')
  if (orphans.length) console.log(`  · ${orphans.length} file(s) in the bucket with no row (harmless, just clutter)`)
  if (noSize)         console.log(`  · ${noSize} row(s) have no width/height, so the tool shows "size unknown"`)

  problems += missing.length + unfetchable
}

console.log(problems ? `\n${problems} problem(s)` : '\nAll photos present and fetchable.')
process.exitCode = problems ? 1 : 0

/**
 * Seeds three throwaway Lead Engine sites — one per template — so the designs can be READ rather
 * than reasoned about.
 *
 * This project's own lesson, paid for twice: read the artifact, not the code that made it. A unit
 * test asks whether the code did what it was told; only a reader asks whether the result is worth
 * reading. Two shipping defects in the dossier were invisible to every test and obvious in the
 * first thirty seconds of reading one.
 *
 * Everything it writes is prefixed `review-` and owned by the address below, and `--cleanup`
 * refuses to touch anything else.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs --apply
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs --cleanup --apply
 *
 * It writes to PRODUCTION Supabase — there is no other Supabase here — but it buys nothing, calls
 * no external API, and sends no mail.
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { contentFrom } from '@/lib/lead-engine/content'
import { PHOTO_BUCKET } from '@/lib/lead-engine/site'

const APPLY   = process.argv.includes('--apply')
const CLEANUP = process.argv.includes('--cleanup')

const OWNER = 'chris@369agenticsystems.com'
const PREFIX = 'review-'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * Three real-shaped businesses, deliberately different in how COMPLETE their answers are.
 *
 * The middle one leaves several questions blank, because a half-filled questionnaire is the normal
 * case and "does the page still look finished when the customer skipped four questions" is the
 * thing a seed with three perfect records would never show.
 */
const SITES = [
  {
    slug: `${PREFIX}trade-classic`,
    template: 'trade_classic',
    photos: 5,
    answers: {
      business_name: 'Northside Roofing Company',
      phone: '(817) 612-6757',
      services: ['Roof replacement', 'Storm damage repair', 'Gutter installation', 'Free roof inspections'],
      service_areas: 'Fort Worth, Arlington, Keller, Southlake',
      differentiator: 'We answer the phone at nine at night, and we show up when we say we will.',
      credentials: 'Licensed and insured in Texas',
      years_in_business: '12 years',
      primary_cta: 'call',
      google_profile_url: 'g.page/northside-roofing',
      has_photos: true,
      visitor_message: 'Most people call us after a storm, worried about what it will cost. We will tell you straight whether you need a repair or a replacement.',
      pain_points: 'WE MISS HALF OUR CALLS — this must never appear on the page.',
    },
  },
  {
    // The sparse one. Four questions unanswered on purpose.
    slug: `${PREFIX}service-clean`,
    template: 'service_clean',
    photos: 0,
    answers: {
      business_name: 'Hallam & Reed Legal',
      phone: '(817) 555-0142',
      services: ['Wills and probate', 'Family law', 'Small business contracts'],
      service_areas: 'Tarrant County',
      // 'other' on purpose, and it is the realistic answer: "Get a Free Estimate" is a trades
      // phrase that reads wrong over a law firm. It also exercises the free-text CTA path, which
      // nothing else in this seed reaches.
      primary_cta: 'other',
      primary_cta_other: 'Request a Consultation',
      has_photos: false,
      pain_points: 'INTERNAL ONLY — should not render.',
    },
  },
  {
    slug: `${PREFIX}showcase-grid`,
    template: 'showcase_grid',
    photos: 6,
    answers: {
      business_name: 'Lone Star Party Rentals',
      phone: '(817) 555-0199',
      services: ['Bounce houses', 'Mobile casino tables', 'DJ and sound', 'Party bus', 'Tables and chairs'],
      service_areas: 'Fort Worth and Dallas',
      differentiator: 'Everything is cleaned and checked between every hire.',
      years_in_business: 'Since 2019',
      primary_cta: 'availability',
      has_photos: true,
      visitor_message: 'Tell us the date and how many people, and we will tell you what is free.',
      pain_points: 'INTERNAL ONLY — should not render.',
    },
  },
]

/** A clean labelled placeholder. Honest about being a placeholder — this is a layout review. */
async function placeholder(label, index) {
  const tones = ['#DDE3EA', '#E6E2DC', '#DCE5E1', '#E4E0EA', '#E9E4DC', '#DEE6E9']
  const bg = tones[index % tones.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
      <rect width="1200" height="900" fill="${bg}"/>
      <text x="600" y="450" font-family="Inter, sans-serif" font-size="44" fill="#8A93A3"
            text-anchor="middle" dominant-baseline="middle">${label} ${index + 1}</text>
    </svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer()
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(PHOTO_BUCKET)
  if (data) return { existed: true }
  if (!APPLY) return { existed: false }
  const { error } = await supabase.storage.createBucket(PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  if (error) throw new Error(`Could not create bucket ${PHOTO_BUCKET}: ${error.message}`)
  return { existed: false }
}

async function cleanup() {
  const { data: sites, error } = await supabase
    .from('lead_engine_sites')
    .select('id, slug')
    .like('slug', `${PREFIX}%`)
  if (error) throw new Error(error.message)

  if (!sites?.length) {
    console.log('Nothing to clean up.')
    return
  }

  for (const site of sites) {
    // Belt and braces: the query already filtered, but a delete keyed on a prefix is exactly the
    // sort of thing that gets edited later by someone in a hurry.
    if (!site.slug.startsWith(PREFIX)) {
      console.error(`REFUSING to delete ${site.slug} — not a review site.`)
      continue
    }
    console.log(`${APPLY ? 'Deleting' : 'Would delete'} /sites/${site.slug}`)
    if (!APPLY) continue

    const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(site.id)
    if (files?.length) {
      await supabase.storage.from(PHOTO_BUCKET).remove(files.map(f => `${site.id}/${f.name}`))
    }
    // Photos and submissions cascade from the site row.
    const { error: delError } = await supabase.from('lead_engine_sites').delete().eq('id', site.id)
    if (delError) console.error(`  failed: ${delError.message}`)
  }
  console.log(APPLY ? '\nCleaned up.' : '\nDry run — add --apply to actually delete.')
}

async function seed() {
  // Fail with the actual instruction rather than a Postgres error code.
  // PGRST205 is PostgREST's "not in the schema cache"; 42P01 is Postgres's own undefined_table.
  // A supabase-js call normally hits the first, never the second.
  const { error: probe } = await supabase.from('lead_engine_sites').select('id').limit(1)
  if (probe?.code === 'PGRST205' || probe?.code === '42P01') {
    console.error('\n✗ lead_engine_sites does not exist.')
    console.error('  Apply supabase/migrations/2026-08-23-lead-engine.sql in the Supabase SQL editor first.\n')
    // exitCode rather than exit(): an abrupt exit while sharp's native worker is still open trips
    // a libuv assertion on Windows, which prints a scary line after a perfectly clear message.
    process.exitCode = 1
    return
  }
  if (probe) throw new Error(probe.message)

  const bucket = await ensureBucket()
  console.log(bucket.existed
    ? `Bucket ${PHOTO_BUCKET}: already exists`
    : `Bucket ${PHOTO_BUCKET}: ${APPLY ? 'CREATED (public, 5MB, jpeg/png/webp)' : 'would create'}`)

  for (const spec of SITES) {
    const content = contentFrom(spec.answers, spec.answers.business_name)
    console.log(`\n${APPLY ? 'Seeding' : 'Would seed'} /sites/${spec.slug}  [${spec.template}, ${spec.photos} photos]`)
    console.log(`  ${content.businessName} — CTA "${content.cta.label}" (${content.cta.kind})`)

    if (!APPLY) continue

    await supabase.from('lead_engine_sites').delete().eq('slug', spec.slug)

    const { data: site, error } = await supabase
      .from('lead_engine_sites')
      .insert({
        owner_email: OWNER,
        slug: spec.slug,
        business_name: spec.answers.business_name,
        status: 'live',
        template: spec.template,
        questionnaire: spec.answers,
        content,
        notify_email: OWNER,
        launched_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw new Error(`insert failed for ${spec.slug}: ${error.message}`)

    for (let i = 0; i < spec.photos; i++) {
      const body = await placeholder('Photo', i)
      const path = `${site.id}/photo-${i + 1}.jpg`
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, body, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw new Error(`upload failed for ${path}: ${upErr.message}`)

      await supabase.from('lead_engine_photos').insert({
        site_id: site.id,
        storage_path: path,
        sort_order: i,
        bytes: body.length,
        content_type: 'image/jpeg',
      })
    }
    console.log(`  ✓ ${spec.photos} photos uploaded`)
  }

  const base = process.env.REVIEW_BASE_URL ?? 'http://localhost:3001'
  console.log(APPLY ? '\n✓ Seeded. Read these as a customer would:' : '\nDry run — add --apply to write.')
  for (const spec of SITES) console.log(`  ${base}/sites/${spec.slug}`)
  if (APPLY) {
    console.log('\nWhen finished:')
    console.log('  node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs --cleanup --apply')
  }
}

const run = CLEANUP ? cleanup : seed
run().catch(e => { console.error(`\n✗ ${e.message}`); process.exitCode = 1 })

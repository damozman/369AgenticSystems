/**
 * Seeds throwaway Lead Engine sites — one per template, plus a theme-independence case and a
 * sparse regression case — so the designs can be READ rather
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
import { MAX_PHOTOS_PER_SITE } from '@/lib/lead-engine/limits'
import { resolveForVertical } from '@/lib/lead-engine/theme'

const APPLY   = process.argv.includes('--apply')
const CLEANUP = process.argv.includes('--cleanup')

const OWNER = 'chris@369agenticsystems.com'
const PREFIX = 'review-'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * Seven businesses: one per template, one proving theme is independent of template, and one
 * deliberately sparse.
 *
 * The first six are answered to 100% of the agreed contract — every one of the eleven questions,
 * both operational fields, and the full 12-photo allowance — because a design has to be judged at
 * full data. A layout critiqued on a half-filled record is a critique of the record.
 *
 * `review-threshold` is the one that proves the model: it runs the SAME template as the roofer
 * (Trade Classic) on a DIFFERENT theme (Threshold), and carries a customer brand accent. If those
 * two pages look like the same site, the theme layer is not doing its job.
 *
 * The last is thin on purpose and is the regression case — a real customer will skip questions,
 * and "does it still look finished" has to stay answerable after every design change.
 */
const SITES = [
  {
    slug: `${PREFIX}trade-classic`,
    vertical: 'roofing',            // -> trade_classic + ironclad
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Northside Roofing Company',
      phone: '(817) 612-6757',
      services: [
        'Roof replacement', 'Storm damage repair', 'Gutter installation', 'Free roof inspections',
        'Emergency tarping', 'Skylight repair', 'Metal roofing', 'Insurance claim support',
      ],
      service_areas: 'Fort Worth, Arlington, Keller, Southlake, Grapevine, Colleyville',
      differentiator: 'We answer the phone at nine at night, and we show up when we say we will. Every roof we replace is inspected by the owner before we ask you for the final payment.',
      credentials: 'Licensed and insured in Texas · GAF Master Elite · BBB A+',
      years_in_business: '12 years',
      primary_cta: 'call',
      google_profile_url: 'g.page/northside-roofing',
      has_photos: true,
      visitor_message: 'Most people call us after a storm, worried about what it will cost. We will tell you straight whether you need a repair or a replacement, and we will put it in writing before anyone climbs on your roof.',
      pain_points: 'WE MISS HALF OUR CALLS — this must never appear on the page.',
      notify_email: OWNER,
      preferred_slug: 'northside-roofing',
    },
  },
  {
    // Same template as the roofer, different theme, plus a customer brand colour. This is the page
    // that proves template and theme are separate layers rather than one setting with two names.
    slug: `${PREFIX}threshold`,
    vertical: 'real-estate',        // -> trade_classic + threshold
    photos: MAX_PHOTOS_PER_SITE,
    brand: { accent: '#2F5D50', paper_shade: 'warm' },
    answers: {
      business_name: 'Camden & Vale Realty',
      phone: '(817) 555-0188',
      services: [
        'Residential sales', 'First-time buyers', 'Relocation', 'Investment property',
        'Property valuation', 'Listing preparation', 'New construction', 'Land',
      ],
      service_areas: 'Fort Worth, Southlake, Westlake, Colleyville, Keller',
      differentiator: 'We take twelve listings a year, not sixty. You get the agent you met, at every showing.',
      credentials: 'Texas Real Estate Commission licensed · Accredited Buyer Representative',
      years_in_business: '9 years',
      primary_cta: 'other',
      primary_cta_other: 'Book a Valuation',
      google_profile_url: 'g.page/camden-vale-realty',
      has_photos: true,
      visitor_message: 'Selling a house is mostly waiting, punctuated by decisions you have never made before. We will tell you which ones actually matter.',
      pain_points: 'INTERNAL ONLY — should not render.',
      notify_email: OWNER,
      preferred_slug: 'camden-vale-realty',
    },
  },
  {
    slug: `${PREFIX}service-clean`,
    vertical: 'legal',              // -> service_clean + counsel
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Hallam & Reed Legal',
      phone: '(817) 555-0142',
      services: [
        'Wills and probate', 'Family law', 'Small business contracts', 'Real estate closings',
        'Estate planning', 'Guardianship', 'Business formation', 'Contract disputes',
      ],
      service_areas: 'Tarrant County, Dallas County, Denton County, Parker County',
      differentiator: 'You will speak to the attorney handling your matter, not a case manager. We quote a flat fee before we start, so you are never surprised by an invoice.',
      credentials: 'Licensed by the State Bar of Texas · Board Certified in Estate Planning and Probate',
      years_in_business: '18 years',
      // 'other' is the realistic answer: "Get a Free Estimate" is a trades phrase that reads wrong
      // over a law firm. It also exercises the free-text CTA path.
      primary_cta: 'other',
      primary_cta_other: 'Request a Consultation',
      google_profile_url: 'g.page/hallam-reed-legal',
      has_photos: true,
      visitor_message: 'Most people come to us at a difficult moment and want to know what happens next. We will explain it in plain English and tell you honestly whether you need a lawyer at all.',
      pain_points: 'INTERNAL ONLY — should not render.',
      notify_email: OWNER,
      preferred_slug: 'hallam-reed-legal',
    },
  },
  {
    slug: `${PREFIX}showcase-grid`,
    vertical: 'event-rentals',      // -> showcase_grid + yard
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Lone Star Party Rentals',
      phone: '(817) 555-0199',
      services: [
        'Bounce houses', 'Mobile casino tables', 'DJ and sound', 'Party bus',
        'Tables and chairs', 'Water slides', 'Concession machines', 'Tents and marquees',
      ],
      service_areas: 'Fort Worth, Dallas, Arlington, Plano, Frisco, Denton',
      differentiator: 'Everything is cleaned and checked between every hire, and we set up and take down so you never touch a thing.',
      credentials: 'Fully insured · Texas Department of Insurance inspected · Background-checked crew',
      years_in_business: 'Since 2019',
      primary_cta: 'availability',
      google_profile_url: 'g.page/lone-star-party-rentals',
      has_photos: true,
      visitor_message: 'Tell us the date and how many people, and we will tell you what is free. Most weekends book out three weeks ahead, so the earlier you ask the better we can do.',
      pain_points: 'INTERNAL ONLY — should not render.',
      notify_email: OWNER,
      preferred_slug: 'lone-star-party-rentals',
    },
  },
  {
    slug: `${PREFIX}practice`,
    vertical: 'dental',             // -> practice + clinic
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Bluebonnet Family Dental',
      phone: '(817) 555-0164',
      services: [
        'Check-ups and cleaning', 'Fillings', 'Crowns and bridges', 'Root canal treatment',
        'Teeth whitening', 'Childrens dentistry', 'Emergency appointments', 'Dentures',
      ],
      service_areas: 'Fort Worth, Benbrook, White Settlement',
      differentiator: 'We keep two slots free every morning for people in pain, and we will tell you the cost before we start.',
      credentials: 'Texas State Board of Dental Examiners · ADA member',
      years_in_business: '15 years',
      primary_cta: 'other',
      primary_cta_other: 'Book an Appointment',
      google_profile_url: 'g.page/bluebonnet-family-dental',
      has_photos: true,
      visitor_message: 'Plenty of people have not seen a dentist in years and feel awkward about it. Nobody here is going to make you feel bad about that.',
      pain_points: 'INTERNAL ONLY — should not render.',
      notify_email: OWNER,
      preferred_slug: 'bluebonnet-family-dental',
    },
  },
  {
    slug: `${PREFIX}supply`,
    vertical: 'wholesale',          // -> supply + ledger
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Trinity Trade Supply',
      phone: '(817) 555-0121',
      services: [
        'Fasteners and fixings', 'Power tool accessories', 'Abrasives', 'Safety equipment',
        'Adhesives and sealants', 'Hand tools', 'Site consumables', 'Workwear',
      ],
      service_areas: 'North Texas, Oklahoma, Louisiana, Arkansas',
      differentiator: 'Order by two, on your site by seven the next morning, anywhere in North Texas. Same van driver every week.',
      credentials: 'Authorised distributor for eleven manufacturers · ISO 9001',
      years_in_business: '22 years',
      primary_cta: 'other',
      primary_cta_other: 'Request a Quote',
      google_profile_url: 'g.page/trinity-trade-supply',
      has_photos: true,
      visitor_message: 'Most of our customers are buying the same forty lines every week. Tell us what they are and we will keep them on the shelf for you.',
      pain_points: 'INTERNAL ONLY — should not render.',
      notify_email: OWNER,
      preferred_slug: 'trinity-trade-supply',
    },
  },
  {
    // The regression case. Note the vertical resolves to trade_classic + ironclad, but with zero
    // photos it RENDERS Service Clean — in Ironclad's identity. That degrade is the thing to look
    // at here: it should still read as a plumber, not as a law firm.
    slug: `${PREFIX}sparse`,
    vertical: 'plumbing',
    photos: 0,
    answers: {
      business_name: 'Bell Avenue Plumbing',
      phone: '(817) 555-0175',
      services: ['Drain cleaning', 'Water heaters', 'Leak repair'],
      service_areas: 'Fort Worth',
      primary_cta: 'call',
      has_photos: false,
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
    // Printed from resolveForVertical rather than from the spec, so a dry run shows the pair the
    // mapping actually produces — which is the thing worth checking before writing anything.
    const pair = resolveForVertical(spec.vertical)
    const rendered = spec.photos > 0 ? pair.template : 'service_clean (degraded — no photos)'
    console.log(`\n${APPLY ? 'Seeding' : 'Would seed'} /sites/${spec.slug}`)
    console.log(`  ${spec.vertical} -> ${pair.template} + ${pair.theme}, renders ${rendered}, ${spec.photos} photos`)
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
        // Resolved from the vertical exactly as createSite() does, rather than set by hand — a
        // seed that hardcodes the pair cannot catch a broken mapping.
        template: resolveForVertical(spec.vertical).template,
        theme: resolveForVertical(spec.vertical).theme,
        brand: spec.brand ?? {},
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

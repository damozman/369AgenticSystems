/**
 * Reading and creating Lead Engine sites.
 *
 * Everything here uses the service-role client. The public renderer has no session — a visitor to
 * a customer's mini-site is a stranger — so RLS cannot be the mechanism that lets the page load.
 * The policies in the migration are the backstop for the authenticated portal; this file is the
 * gate for the public side, and the gate is `status = 'live'`.
 */

import { createAdminClient } from '@/lib/supabase-admin'
import type {
  LeadEngineSite, QuestionnaireAnswers, SiteContent, SitePhoto, SiteStatus, Template, Theme,
} from '@/lib/lead-engine/types'
import { proposeSlug, validateSlug } from '@/lib/lead-engine/slug'
import { MAX_PHOTOS_PER_SITE } from '@/lib/lead-engine/limits'
import { resolveForVertical } from '@/lib/lead-engine/theme'
import { footerNoteFor, headlineNounFor, normaliseVertical } from '@/lib/lead-engine/verticals'
import { previewEnabled } from '@/lib/lead-engine/preview'

export const PHOTO_BUCKET = 'lead-engine-photos'

const SITE_COLUMNS =
  'id, slug, business_name, status, template, theme, brand, content, headline_noun, footer_note, notify_email, client_domain, launched_at, revisions_used'

/**
 * Whether an error means "the migration has not been applied yet".
 *
 * DDL cannot be run from a script in this project — no DATABASE_URL, no pg package — so schema and
 * code always go live separately, in whichever order happens. Every read has to survive the table
 * not existing, and it has to do so LOUDLY: a 404 nobody can explain is worse than a 500.
 *
 * BOTH codes are needed, and this was found by running it rather than by reading. Postgres raises
 * `42P01` for an undefined table, but a supabase-js query never reaches Postgres — PostgREST checks
 * its own schema cache first and returns `PGRST205` ("Could not find the table … in the schema
 * cache"). Matching only the Postgres code silently never fired, which would have turned "you
 * forgot the migration" into an unexplained 404 on every mini-site.
 */
function isMissingTable(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205'
}

/**
 * The live site behind a slug, or null.
 *
 * Null covers three genuinely different situations — no such slug, a site that is not live, and
 * the table not existing — and the caller renders the same 404 for all three, because a stranger
 * must not be able to tell a draft site from a typo. The log line distinguishes them for us.
 */
export async function loadSiteBySlug(slug: string): Promise<LeadEngineSite | null> {
  if (!validateSlug(slug).valid) return null

  const supabase = createAdminClient()

  // The gate. `status = 'live'` is the only thing a production deployment ever serves; preview mode
  // additionally serves drafts, and is enabled only in .env.local — never in Vercel. See
  // lib/lead-engine/preview.ts for why the check is written the way it is.
  const query = supabase
    .from('lead_engine_sites')
    .select(SITE_COLUMNS)
    .eq('slug', slug)

  const { data, error } = await (previewEnabled()
    ? query.in('status', ['live', 'draft', 'in_build', 'awaiting_answers'])
    : query.eq('status', 'live')
  ).maybeSingle()

  if (error) {
    if (isMissingTable(error.code)) {
      console.error('[LEAD-ENGINE] lead_engine_sites does not exist — apply supabase/migrations/2026-08-23-lead-engine.sql')
    } else {
      console.error(`[LEAD-ENGINE] Could not load site "${slug}": ${error.message}`)
    }
    return null
  }
  if (!data) {
    console.warn(`[LEAD-ENGINE] No live site for slug "${slug}"`)
    return null
  }

  return data as unknown as LeadEngineSite
}

/**
 * A site by id, whatever its status. For the operator views only — never reachable from the public
 * renderer, which is why it is a separate function rather than a flag on the one above. A boolean
 * parameter is how a draft site ends up served to the public by a caller that passed the wrong
 * argument.
 */
export async function loadSiteById(id: string): Promise<LeadEngineSite | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lead_engine_sites')
    .select(SITE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error(`[LEAD-ENGINE] Could not load site ${id}: ${error.message}`)
    return null
  }
  return (data as unknown as LeadEngineSite) ?? null
}

/**
 * A site's photos, in display order, with public URLs already built.
 *
 * Returns an empty array on any failure. A gallery that fails to load must degrade to a page
 * without a gallery — `effectiveTemplate` then picks the copy-forward layout — rather than taking
 * the whole site down. The photos are the most decorative part of the page and the least worth a
 * 500 to a visitor who is trying to find a phone number.
 */
export async function loadPhotos(siteId: string): Promise<SitePhoto[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lead_engine_photos')
    .select('id, storage_path, caption')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true })
    .limit(MAX_PHOTOS_PER_SITE)

  if (error) {
    if (isMissingTable(error.code)) {
      console.error('[LEAD-ENGINE] lead_engine_photos does not exist — apply the migration')
    } else {
      console.error(`[LEAD-ENGINE] Could not load photos for ${siteId}: ${error.message}`)
    }
    return []
  }

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  return (data ?? []).map(row => ({
    id: row.id as string,
    url: `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${row.storage_path as string}`,
    caption: (row.caption as string | null) ?? null,
  }))
}

export type CreateSiteResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string }

/**
 * Create a site.
 *
 * Written as a standalone function taking plain values rather than a request, so that the Stripe
 * webhook can call it unchanged if Lead Engine ever becomes self-serve. v1 is sold in the room and
 * invoiced by hand, and the only caller is the admin page — but the seam costs nothing now and a
 * second creation path written later would drift from this one.
 *
 * The slug is settled here, not by the caller, because uniqueness is a database fact and a form
 * that "checks availability" separately from the insert has a race in it.
 *
 * `vertical` is an INPUT and is not stored — `template` and `theme` are the resolved output. If an
 * operator needs to re-derive later they pass the vertical again. Storing both the input and its
 * output means they can disagree, and nothing then says which one is right.
 *
 * It is required rather than optional on purpose: an unrecognised vertical resolves to the default
 * pair, so an optional parameter would quietly make every site look like a law firm.
 */
export async function createSite(input: {
  ownerEmail: string
  businessName: string
  vertical: string
  preferredSlug?: string | null
  /** Overrides the vertical's resolved pair. The admin edit page sets these; nothing else should. */
  template?: Template | null
  theme?: Theme | null
  /**
   * Overrides the vertical's resolved headline noun, for a business that sells itself as something
   * the map cannot know — "Storm restoration" rather than "Roofing". The admin create page will
   * offer this prefilled; until it exists the map's answer stands.
   */
  headlineNoun?: string | null
  /**
   * Overrides the vertical's default footer note — a contractor licence number, or a firm's own
   * wording in place of ours. Passing it EMPTY clears the note deliberately; omitting it takes
   * the default.
   */
  footerNote?: string | null
  notifyEmail?: string | null
}): Promise<CreateSiteResult> {
  const ownerEmail = input.ownerEmail.trim().toLowerCase()
  const businessName = input.businessName.trim()

  if (!ownerEmail) return { ok: false, error: 'An owner email is required.' }
  if (!businessName) return { ok: false, error: 'A business name is required.' }
  if (!normaliseVertical(input.vertical)) return { ok: false, error: 'A vertical is required.' }

  const resolved = resolveForVertical(input.vertical)

  const slug = proposeSlug(businessName, input.preferredSlug)
  if (!slug) {
    // Rather than inventing `site-1`, which gives a customer a URL that says nothing about them.
    return { ok: false, error: 'Could not derive a web address from that business name — please choose one.' }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lead_engine_sites')
    .insert({
      owner_email:   ownerEmail,
      business_name: businessName,
      slug,
      template:      input.template ?? resolved.template,
      theme:         input.theme ?? resolved.theme,
      // Absent and empty mean different things. Not passing the field at all takes the map's
      // answer; passing it empty is an operator deliberately clearing it, and must NOT have the
      // map reinstated behind their back — that site's hero falls back to the business name.
      headline_noun: input.headlineNoun === undefined
        ? headlineNounFor(input.vertical) ?? null
        : input.headlineNoun?.trim() || null,
      footer_note: input.footerNote === undefined
        ? footerNoteFor(input.vertical) ?? null
        : input.footerNote?.trim() || null,
      brand:         {},
      notify_email:  input.notifyEmail?.trim().toLowerCase() || null,
      status:        'draft',
    })
    .select('id, slug')
    .single()

  if (error) {
    // 23505 is the unique violation on `slug`. Surfaced as a sentence the operator can act on,
    // because "duplicate key value violates unique constraint" is not one.
    if (error.code === '23505') {
      return { ok: false, error: `The web address "${slug}" is already taken. Choose another.` }
    }
    console.error(`[LEAD-ENGINE] Could not create site for ${ownerEmail}: ${error.message}`)
    return { ok: false, error: 'Could not create the site. The error has been logged.' }
  }

  console.log(`[LEAD-ENGINE] Created site ${data.id} (/sites/${data.slug}) for ${ownerEmail}`)
  return { ok: true, id: data.id as string, slug: data.slug as string }
}

/**
 * Replace a site's rendered content.
 *
 * Only ever writes `content`, never `questionnaire`. The two columns have two different writers —
 * the customer fills the questionnaire, an operator shapes the content — and the whole point of
 * keeping them apart is that neither can silently discard the other's work. This project has
 * shipped the merged version of that mistake twice.
 */
export async function saveContent(siteId: string, content: SiteContent): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('lead_engine_sites')
    .update({ content, needs_review: false })
    .eq('id', siteId)

  if (error) {
    console.error(`[LEAD-ENGINE] Could not save content for ${siteId}: ${error.message}`)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * A site's identity plus its raw questionnaire answers — never its `content`. For the
 * questionnaire routes only: they read and write what the customer typed, and must never touch
 * what actually renders. Returns null for a site that does not exist; callers distinguish "not
 * found" from "found but not yours" using `ownerEmail` themselves, the same way
 * `lib/lead-engine/photo-storage.ts`'s `resolveOwnedSite` does for the photo routes.
 */
export async function loadSiteForQuestionnaire(siteId: string): Promise<{
  id: string
  businessName: string
  ownerEmail: string
  status: SiteStatus
  answers: QuestionnaireAnswers | null
  /** When `questionnaire` last changed — the POST route's own throttle cooldown, not rendering. */
  updatedAt: string
} | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lead_engine_sites')
    .select('id, business_name, owner_email, status, questionnaire, updated_at')
    .eq('id', siteId)
    .maybeSingle()

  if (error || !data) {
    if (error && !isMissingTable(error.code)) {
      console.error(`[LEAD-ENGINE] Could not load questionnaire for ${siteId}: ${error.message}`)
    }
    return null
  }

  return {
    id: data.id as string,
    businessName: data.business_name as string,
    ownerEmail: data.owner_email as string,
    status: data.status as SiteStatus,
    answers: (data.questionnaire as QuestionnaireAnswers | null) ?? null,
    updatedAt: data.updated_at as string,
  }
}

/**
 * Save what the customer typed. Writes ONLY `questionnaire` — see this file's own note on
 * `saveContent` and the migration's comment on why the two columns must never share a writer.
 *
 * The first submission (site still `draft` or `awaiting_answers`) moves it to `in_build`: there is
 * now something for an operator to build a page from. A later re-submission — the site already has
 * real content, possibly already live — leaves `status` alone and sets `needs_review` instead, so
 * a live page can never change under a customer without a human seeing the diff first.
 */
export async function saveQuestionnaireAnswers(
  siteId: string,
  answers: QuestionnaireAnswers,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { data: existing, error: readError } = await supabase
    .from('lead_engine_sites')
    .select('status')
    .eq('id', siteId)
    .maybeSingle()
  if (readError || !existing) {
    return { ok: false, error: readError?.message ?? 'Site not found' }
  }

  const status = existing.status as SiteStatus
  const nextStatus: SiteStatus = status === 'draft' || status === 'awaiting_answers' ? 'in_build' : status

  const { error } = await supabase
    .from('lead_engine_sites')
    .update({ questionnaire: answers, status: nextStatus, needs_review: true })
    .eq('id', siteId)

  if (error) {
    console.error(`[LEAD-ENGINE] Could not save questionnaire for ${siteId}: ${error.message}`)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * A site as the customer dashboard needs it — narrower than `LeadEngineSite`, wider than the
 * public renderer's columns: it needs `status` and `revisions_used`, which a stranger never should.
 */
export async function loadSiteForOwner(siteId: string): Promise<
  (LeadEngineSite & { ownerEmail: string; questionnaireCompleted: boolean }) | null
> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lead_engine_sites')
    .select(`${SITE_COLUMNS}, owner_email, questionnaire`)
    .eq('id', siteId)
    .maybeSingle()

  if (error || !data) return null

  return {
    ...(data as unknown as LeadEngineSite),
    ownerEmail: data.owner_email as string,
    questionnaireCompleted: data.questionnaire != null,
  }
}

export interface SiteSubmission {
  id: string
  createdAt: string
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  serviceInterest: string | null
  status: string
}

export async function listSubmissions(siteId: string, limit = 50): Promise<SiteSubmission[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lead_engine_submissions')
    .select('id, created_at, name, email, phone, message, service_interest, status')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error(`[LEAD-ENGINE] Could not load submissions for ${siteId}: ${error.message}`)
    return []
  }
  return (data ?? []).map(row => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    name: row.name as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    message: row.message as string | null,
    serviceInterest: row.service_interest as string | null,
    status: row.status as string,
  }))
}

export interface SiteChangeRequest {
  id: string
  createdAt: string
  body: string
  status: string
  billable: boolean
}

export async function listChangeRequests(siteId: string): Promise<SiteChangeRequest[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lead_engine_change_requests')
    .select('id, created_at, body, status, billable')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[LEAD-ENGINE] Could not load change requests for ${siteId}: ${error.message}`)
    return []
  }
  return (data ?? []).map(row => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    body: row.body as string,
    status: row.status as string,
    billable: row.billable as boolean,
  }))
}

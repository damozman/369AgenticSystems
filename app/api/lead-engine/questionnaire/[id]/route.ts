import { NextRequest, NextResponse } from 'next/server'
import { loadSiteForQuestionnaire, saveQuestionnaireAnswers } from '@/lib/lead-engine/site'
import { authorizeSiteQuestionnaire, questionnaireAuthFailure } from '@/lib/lead-engine/questionnaire-auth'
import { decideQuestionnaireThrottle } from '@/lib/lead-engine/rate-limit'
import type { QuestionnaireAnswers } from '@/lib/lead-engine/types'
import { CTA_KINDS } from '@/lib/lead-engine/types'

/**
 * Read and write a Lead Engine site's raw questionnaire answers, behind one shared authorizer —
 * see `lib/lead-engine/questionnaire-auth.ts`. Read returns exactly the shape the write accepts,
 * for the same reason the voice product's version does: a form that cannot show its own saved
 * answers cannot round-trip them, and a partial re-submit then silently destroys anything it
 * never saw.
 *
 * `force-dynamic` for the same reason `app/sites/[slug]/page.tsx` sets it: this route reads then,
 * on POST, writes then re-reads within seconds of each other (a customer saving, then reloading,
 * or this file's own verify script doing exactly that against a real fixture) — caught live
 * 2026-08-24 when `verify-lead-engine.mjs --live` proved a write correct via a direct database
 * query in the same run, while the GET route handler still returned the pre-write state
 * immediately after. Next's Data Cache can cache a Route Handler's internal `fetch()` calls
 * (which is what the Supabase client makes under the hood) unless a route opts out — this route
 * never had a reason to allow that caching in the first place.
 */
export const dynamic = 'force-dynamic'

const STRING_FIELDS = [
  'business_name', 'phone', 'service_areas', 'differentiator', 'customer_impression', 'credentials',
  'years_in_business', 'primary_cta_other', 'google_profile_url', 'pain_points', 'notify_email',
  'preferred_slug', 'hours', 'location', 'first_visit', 'patient_forms_url',
] as const satisfies readonly (keyof QuestionnaireAnswers)[]

/** Trim, cap, drop anything that is not a usable string — same discipline as content.ts's `text()`. */
function str(raw: unknown, max: number): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.replace(/\s+/g, ' ').trim().slice(0, max)
  return s.length > 0 ? s : undefined
}

/**
 * The raw POST body, narrowed to the shape `questionnaire` may hold — never trusted verbatim.
 *
 * This is deliberately looser than `lib/lead-engine/content.ts`'s `contentFrom()`: that function
 * shapes what RENDERS and is where the real truthfulness discipline lives. This one only has to
 * stop a malformed or oversized payload from reaching the database — `questionnaire` is read back
 * by the same form and by an operator building `content` from it later, never rendered directly.
 */
function parseAnswers(body: Record<string, unknown>): QuestionnaireAnswers {
  const out: QuestionnaireAnswers = {}

  for (const key of STRING_FIELDS) {
    const v = str(body[key], key === 'pain_points' ? 1000 : 600)
    if (v) out[key] = v
  }

  if (Array.isArray(body.services)) {
    out.services = body.services.slice(0, 12).flatMap(entry => {
      if (typeof entry === 'string') {
        const name = str(entry, 60)
        return name ? [{ name }] : []
      }
      const name = str((entry as { name?: unknown })?.name, 60)
      if (!name) return []
      const description = str((entry as { description?: unknown })?.description, 140)
      return [description ? { name, description } : { name }]
    })
  }

  // Accepts a string ("Delta Dental, Cigna") or an array — the same tolerance content.ts's own
  // `list()` gives every other multi-valued field, since a plain text box is what most practices
  // will actually type into.
  if (typeof body.insurance_accepted === 'string') {
    const v = str(body.insurance_accepted, 600)
    if (v) out.insurance_accepted = v
  } else if (Array.isArray(body.insurance_accepted)) {
    const v = body.insurance_accepted.map(x => str(x, 60)).filter((x): x is string => !!x).slice(0, 12)
    if (v.length > 0) out.insurance_accepted = v
  }

  if (typeof body.accepting_new_patients === 'boolean') out.accepting_new_patients = body.accepting_new_patients
  if (typeof body.has_photos === 'boolean') out.has_photos = body.has_photos
  if (typeof body.primary_cta === 'string' && (CTA_KINDS as readonly string[]).includes(body.primary_cta)) {
    out.primary_cta = body.primary_cta as QuestionnaireAnswers['primary_cta']
  }
  if (Array.isArray(body.what_to_bring)) {
    const v = body.what_to_bring.map(x => str(x, 80)).filter((x): x is string => !!x).slice(0, 6)
    if (v.length > 0) out.what_to_bring = v
  }
  if (Array.isArray(body.team)) {
    out.team = body.team.slice(0, 8).flatMap(m => {
      const name = str((m as { name?: unknown })?.name, 60)
      const role = str((m as { role?: unknown })?.role, 60)
      if (!name || !role) return []
      const credentials = str((m as { credentials?: unknown })?.credentials, 80)
      const bio = str((m as { bio?: unknown })?.bio, 240)
      return [{ name, role, ...(credentials ? { credentials } : {}), ...(bio ? { bio } : {}) }]
    })
  }

  return out
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = new URL(request.url).searchParams.get('t')

  const site = await loadSiteForQuestionnaire(id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const authorizedBy = await authorizeSiteQuestionnaire(id, site.ownerEmail, token)
  const refusal = questionnaireAuthFailure(authorizedBy, id, { readOnly: true })
  if (refusal) return refusal

  return NextResponse.json({
    businessName: site.businessName,
    status: site.status,
    answers: site.answers,
    authorizedBy,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = (typeof body.t === 'string' ? body.t : null) ?? new URL(request.url).searchParams.get('t')

  const site = await loadSiteForQuestionnaire(id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const authorizedBy = await authorizeSiteQuestionnaire(id, site.ownerEmail, token)
  const refusal = questionnaireAuthFailure(authorizedBy, id)
  if (refusal) return refusal

  // This route is already token- or session-gated, so the threat is narrower than the public
  // submit route's — a leaked or brute-forced link hammering a write endpoint, not open scraping.
  // A short per-site cooldown is enough. `updatedAt` moves on ANY write to the row, not only a
  // questionnaire one (an operator content edit bumps it too), so this can rarely refuse a
  // customer who happens to submit within QUESTIONNAIRE_THROTTLE_COOLDOWN_SECONDS of an unrelated
  // admin edit — an acceptable trade against a schema change for a dedicated column nobody else
  // needs, and the customer simply retries once.
  //
  // Only applies once `answers` already exists. `updatedAt` is also set at ROW CREATION — a site
  // is typically created and its link sent within seconds of each other, so gating a FIRST
  // submission on this would routinely refuse the most common real path through this route.
  // There is nothing to be "hammering" before a first write has ever happened.
  if (site.answers) {
    const throttle = decideQuestionnaireThrottle(site.updatedAt)
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Please wait a moment before saving again.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } },
      )
    }
  }

  const answers = parseAnswers(body)

  // 4a is the hero's lede — "no 4a, no hero, no page" is the product rule this enforces, not a
  // stylistic minimum. Every other field is optional and the renderer already omits what it lacks.
  if (!answers.differentiator) {
    return NextResponse.json(
      { error: "Please answer \"what's one thing you do that other businesses typically don't?\" — every page needs this." },
      { status: 400 },
    )
  }

  const result = await saveQuestionnaireAnswers(id, answers)
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Could not save your answers.' }, { status: 500 })

  return NextResponse.json({ ok: true, authorizedBy })
}

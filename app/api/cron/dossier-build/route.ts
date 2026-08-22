/**
 * Builds the dossiers that are ready, and queues them for approval. Step 6.
 *
 * Thin: readiness lives in `lib/dossier-queue.ts`, the content decisions in `lib/dossier.ts`, the
 * markup in `lib/dossier-html.ts`. This route fetches, asks, renders and writes.
 *
 * **Nothing here sends anything.** A built dossier sits in `pending` until a human reads it and
 * approves. That was Chris's decision when the gate was agreed, and it is why the nudge exists.
 *
 * The website fetch happens here rather than at intake time on purpose: intake's one job is to
 * capture the lead, and a slow third-party homepage must never sit between a prospect and their
 * success screen.
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { decideReadiness, type QueueCandidate } from '@/lib/dossier-queue'
import { buildDossier, worthSending } from '@/lib/dossier'
import { renderDossierEmail, dossierSubject } from '@/lib/dossier-html'
import { fetchHomepage } from '@/lib/website-audit'
import { describeAuditPair } from '@/lib/audit-call-pair'
import type { AuditCallResult } from '@/lib/audit-call'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** How far back to look. Older submissions predate the dossier and are not retro-built. */
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

/** Rebuild a stored call row into the shape `describeAuditPair` expects. */
function toResult(row: {
  reportable: boolean | null; outcome: string | null; unreportable: string | null
  sentence: string | null; detail: string | null
} | undefined): AuditCallResult | null {
  if (!row) return null
  return {
    reportable: Boolean(row.reportable),
    outcome: (row.outcome ?? undefined) as AuditCallResult['outcome'],
    unreportable: (row.unreportable ?? undefined) as AuditCallResult['unreportable'],
    sentence: row.sentence ?? '',
    detail: row.detail ?? '',
  }
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString()

  const { data: audits, error } = await supabaseAdmin
    .from('system_audits')
    .select('id, created_at, client_email, client_name, client_company, client_industry, client_phone, service_area, website_url, monthly_volume, avg_job_value, pain_points, pain_point')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(25)

  if (error) {
    console.error(`[369 DOSSIER-BUILD] ✗ could not read submissions: ${error.message}`)
    return NextResponse.json({ error: 'Could not read submissions' }, { status: 500 })
  }

  const rows = audits ?? []
  if (!rows.length) return NextResponse.json({ ok: true, considered: 0, built: 0 })

  const ids = rows.map(r => r.id)
  const [{ data: calls }, { data: existing }] = await Promise.all([
    supabaseAdmin.from('audit_calls')
      .select('audit_id, slot, status, reportable, outcome, unreportable, sentence, detail, called_at')
      .in('audit_id', ids),
    supabaseAdmin.from('dossiers').select('audit_id').in('audit_id', ids),
  ])

  const queued = new Set((existing ?? []).map(d => d.audit_id as string))
  const callsFor = (id: string) => (calls ?? []).filter(c => c.audit_id === id)

  let built = 0
  const skipped: Record<string, number> = {}

  for (const audit of rows) {
    const mine = callsFor(audit.id)
    const candidate: QueueCandidate = {
      auditId: audit.id,
      submittedAt: audit.created_at,
      email: audit.client_email,
      calls: mine.map(c => ({ status: c.status as string, slot: c.slot as string | null })),
      alreadyQueued: queued.has(audit.id),
    }

    const decision = decideReadiness(candidate, now)
    if (!decision.ready) {
      skipped[decision.reason ?? 'unknown'] = (skipped[decision.reason ?? 'unknown'] ?? 0) + 1
      continue
    }

    // Only calls that actually resolved carry a finding; anything else is excluded rather than
    // softened, which is what makes the section omit rather than say "we could not reach you".
    const resolved = mine.filter(c => c.status === 'resolved')
    const bizCall = resolved.find(c => c.slot === 'business')
    const eveCall = resolved.find(c => c.slot === 'evening')
    // The times matter: the comparison line may only say "same day" when the calls WERE on the
    // same day, and an evening submission on a Friday puts them three days apart.
    const pair = describeAuditPair(toResult(bizCall), toResult(eveCall), {
      businessAt: bizCall?.called_at ? new Date(bizCall.called_at) : null,
      eveningAt:  eveCall?.called_at ? new Date(eveCall.called_at) : null,
    })

    // Best-effort: an unreachable homepage costs that section, never the dossier.
    const site = audit.website_url ? await fetchHomepage(audit.website_url).catch(() => null) : null

    const dossier = buildDossier({
      company: audit.client_company,
      name: audit.client_name,
      website: audit.website_url,
      serviceArea: audit.service_area,
      vertical: audit.client_industry,
      // `pain_points` is the ordered array; `pain_point` is its joined mirror, kept for the rung
      // of the intake ladder that runs before that column exists.
      painPoints: (audit.pain_points as string[] | null)
        ?? (audit.pain_point ? String(audit.pain_point).split(', ') : null),
      monthlyVolume: audit.monthly_volume,
      avgJobValue: audit.avg_job_value == null ? null : Number(audit.avg_job_value),
      calls: pair,
      site,
    })

    if (!worthSending(dossier)) {
      skipped.nothing_to_say = (skipped.nothing_to_say ?? 0) + 1
      console.log(`[369 DOSSIER-BUILD] · ${audit.id} has nothing to say — not queued`)
      continue
    }

    const { error: insErr } = await supabaseAdmin.from('dossiers').insert({
      audit_id: audit.id,
      to_email: audit.client_email,
      status:   'pending',
      subject:  dossierSubject(dossier),
      html:     renderDossierEmail(dossier),
      omitted:  dossier.omitted,
    })

    // A duplicate is the unique index doing its job, not a failure — two crons overlapped.
    if (insErr) {
      if (insErr.code === '23505') continue
      console.error(`[369 DOSSIER-BUILD] ✗ ${audit.id}: ${insErr.message}`)
      continue
    }
    built++
    console.log(`[369 DOSSIER-BUILD] ✓ queued for ${audit.client_email} (${dossier.sections.length} sections)`)
  }

  const summary = Object.entries(skipped).map(([k, v]) => `${k}=${v}`).join(' ') || 'none skipped'
  console.log(`[369 DOSSIER-BUILD] considered ${rows.length} · built ${built} · ${summary}`)

  return NextResponse.json({ ok: true, considered: rows.length, built, skipped })
}

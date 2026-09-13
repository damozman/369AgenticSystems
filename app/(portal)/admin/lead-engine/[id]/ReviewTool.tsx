'use client'

import { useState } from 'react'
import type { QuestionnaireAnswers, ServiceItem, SiteStatus } from '@/lib/lead-engine/types'

interface Props {
  siteId: string
  slug: string
  businessName: string
  status: SiteStatus
  headlineNoun: string
  footerNote: string
  answers: QuestionnaireAnswers | null
  photoCount: number
  allocation: { hero: string | null; band: string | null; services: number; gallery: number }
  submissionCount: number
}

/** Services arrive as `string[]` OR `ServiceItem[]` — the questionnaire accepts both shapes. */
function servicesToText(services: QuestionnaireAnswers['services']): string {
  if (!Array.isArray(services)) return ''
  return services
    .map(s => (typeof s === 'string' ? s : [s.name, s.description].filter(Boolean).join(' — ')))
    .join('\n')
}

/**
 * One line per service, `Name — description`. Posted as ServiceItem[] because that is the richer
 * of the two shapes the questionnaire accepts, and servicesFrom() normalises either.
 */
function textToServices(text: string): ServiceItem[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [name, ...rest] = line.split('—')
      const description = rest.join('—').trim()
      return description ? { name: name.trim(), description } : { name: name.trim() }
    })
}

const CTA_OPTIONS = [
  { value: 'call', label: 'Call now' },
  { value: 'estimate', label: 'Get a free estimate' },
  { value: 'availability', label: 'Check availability' },
  { value: 'other', label: 'Something else…' },
] as const

export default function ReviewTool(props: Props) {
  const [status, setStatus] = useState<SiteStatus>(props.status)
  const [headlineNoun, setHeadlineNoun] = useState(props.headlineNoun)
  const [footerNote, setFooterNote] = useState(props.footerNote)
  const [a, setA] = useState<QuestionnaireAnswers>(props.answers ?? {})
  const [servicesText, setServicesText] = useState(servicesToText(props.answers?.services))
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<QuestionnaireAnswers>) => setA(prev => ({ ...prev, ...patch }))

  async function save() {
    setBusy(true); setError(null); setNote(null)
    try {
      const res = await fetch(`/api/lead-engine/sites/${props.siteId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: { ...a, services: textToServices(servicesText) },
          headlineNoun,
          footerNote,
        }),
      })
      const data: { error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setNote('Saved. The page will show these changes now.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function regenerate() {
    if (!confirm('Discard your edits and start again from what the customer submitted?')) return
    setBusy(true); setError(null); setNote(null)
    try {
      // Re-read rather than reset to the props captured at page load: the customer may have
      // resubmitted since, which is exactly the case "new answers to review" flags.
      const res = await fetch(`/api/lead-engine/sites/${props.siteId}/content`)
      const data: { answers?: QuestionnaireAnswers; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not reload the answers')
      setA(data.answers ?? {})
      setServicesText(servicesToText(data.answers?.services))
      setNote('Reset to the customer’s answers. Nothing is saved until you press Save.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reload')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(to: SiteStatus) {
    setBusy(true); setError(null); setNote(null)
    try {
      const res = await fetch(`/api/lead-engine/sites/${props.siteId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      })
      const data: { error?: string; alreadyInStatus?: boolean; needsReview?: boolean } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not change the status')
      setStatus(to)
      setNote(
        data.alreadyInStatus
          ? `Already ${to}.`
          : `Now ${to}.${data.needsReview ? ' Note: the customer has changed their answers since this page was built.' : ''}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the status')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full border rounded px-3 py-2 dark:bg-slate-800 dark:border-slate-600'
  const label = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

  if (!props.answers) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
        This site has no questionnaire answers yet, so there is nothing to build a page from. Send
        the owner their questionnaire link first.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4 text-red-800 dark:text-red-200">
          <strong>Failed:</strong> {error}
        </div>
      )}
      {note && (
        <div className="rounded border border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 p-4 text-green-800 dark:text-green-200">
          {note}
        </div>
      )}

      <section className="rounded border border-slate-300 dark:border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Status: {status}
        </h2>
        <div className="flex flex-wrap gap-2">
          {status !== 'live' && (
            <button type="button" disabled={busy} onClick={() => changeStatus('live')}
              className="px-4 py-2 rounded bg-green-700 text-white disabled:opacity-40">
              Publish
            </button>
          )}
          {status === 'live' && (
            <>
              <button type="button" disabled={busy} onClick={() => changeStatus('in_build')}
                className="px-4 py-2 rounded border border-slate-400 disabled:opacity-40">
                Unpublish
              </button>
              <button type="button" disabled={busy} onClick={() => changeStatus('suspended')}
                className="px-4 py-2 rounded border border-red-400 text-red-700 dark:text-red-400 disabled:opacity-40">
                Suspend
              </button>
            </>
          )}
          <a href={`/sites/${props.slug}`} target="_blank" rel="noreferrer"
            className="px-4 py-2 rounded border border-slate-400 underline">
            View the page
          </a>
        </div>
        {status !== 'live' && (
          <p className="mt-2 text-xs text-slate-500">
            Not published yet, so only you can see it — and only with preview turned on locally.
          </p>
        )}
      </section>

      <section className="rounded border border-slate-300 dark:border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Photos</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {props.photoCount} uploaded. Hero: {props.allocation.hero ?? 'none'} · Band:{' '}
          {props.allocation.band ?? 'none'} · Services: {props.allocation.services} · Gallery:{' '}
          {props.allocation.gallery}
        </p>
        <p className="mt-2 text-sm">
          <a href="/admin/lead-engine-photos" className="underline text-slate-700 dark:text-slate-300">
            Add or change photos →
          </a>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          The page content
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Prefilled from what the customer submitted. Correcting something here changes the page,
          not their answers — their original stays on record.
        </p>

        <div>
          <label className={label}>Business name</label>
          <input className={field} value={a.business_name ?? ''}
            onChange={e => set({ business_name: e.target.value })} />
        </div>

        <div>
          <label className={label}>Phone</label>
          <input className={field} value={a.phone ?? ''} onChange={e => set({ phone: e.target.value })} />
          <p className="mt-1 text-xs text-slate-500">
            A number that cannot be dialled turns the Call Now button into the estimate form.
          </p>
        </div>

        <div>
          <label className={label}>What they do <span className="font-normal text-slate-500">— for the headline</span></label>
          <input className={field} value={headlineNoun} onChange={e => setHeadlineNoun(e.target.value)}
            placeholder="Roofing, Legal counsel, Dumpster rental…" />
          <p className="mt-1 text-xs text-slate-500">
            Leave empty and the headline falls back to the business name.
          </p>
        </div>

        <div>
          <label className={label}>Services <span className="font-normal text-slate-500">— one per line</span></label>
          <textarea className={field} rows={6} value={servicesText}
            onChange={e => setServicesText(e.target.value)}
            placeholder={'Roof replacement — Full tear-off and rebuild\nStorm damage repair'} />
          <p className="mt-1 text-xs text-slate-500">
            Add a description after an em dash if you want one. 3 to 6 services get the photo layout.
          </p>
        </div>

        <div>
          <label className={label}>Service areas</label>
          <textarea className={field} rows={2} value={a.service_areas ?? ''}
            onChange={e => set({ service_areas: e.target.value })}
            placeholder="Fort Worth, Arlington, Keller" />
        </div>

        <div>
          <label className={label}>What they do that others don&rsquo;t <span className="font-normal text-slate-500">— appears under the headline</span></label>
          <textarea className={field} rows={3} value={a.differentiator ?? ''}
            onChange={e => set({ differentiator: e.target.value })} />
        </div>

        <div>
          <label className={label}>What customers say about them</label>
          <textarea className={field} rows={2} value={a.customer_impression ?? ''}
            onChange={e => set({ customer_impression: e.target.value })} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Credentials</label>
            <input className={field} value={a.credentials ?? ''}
              onChange={e => set({ credentials: e.target.value })}
              placeholder="Licensed and insured in Texas" />
          </div>
          <div>
            <label className={label}>Years in business</label>
            <input className={field} value={a.years_in_business ?? ''}
              onChange={e => set({ years_in_business: e.target.value })} />
          </div>
        </div>

        <div>
          <label className={label}>Main button</label>
          <select className={field} value={a.primary_cta ?? 'estimate'}
            onChange={e => set({ primary_cta: e.target.value as QuestionnaireAnswers['primary_cta'] })}>
            {CTA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {a.primary_cta === 'other' && (
            <input className={`${field} mt-2`} value={a.primary_cta_other ?? ''}
              onChange={e => set({ primary_cta_other: e.target.value })}
              placeholder="What the button should say" />
          )}
        </div>

        <div>
          <label className={label}>Footer line <span className="font-normal text-slate-500">— optional</span></label>
          <textarea className={field} rows={2} value={footerNote}
            onChange={e => setFooterNote(e.target.value)}
            placeholder="A licence number, or a disclaimer" />
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            If this was filled in automatically, read it and confirm it is right for this business —
            or clear it. It appears on their public page.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 items-center">
        <button type="button" disabled={busy} onClick={save}
          className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900">
          {busy ? 'Working…' : 'Save'}
        </button>
        <button type="button" disabled={busy} onClick={regenerate}
          className="px-4 py-2 rounded border border-slate-400 disabled:opacity-40">
          Start again from their answers
        </button>
        {props.submissionCount > 0 && (
          <span className="text-sm text-slate-500">{props.submissionCount} leads so far</span>
        )}
      </div>
    </div>
  )
}

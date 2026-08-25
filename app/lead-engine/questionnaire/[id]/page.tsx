'use client'

/**
 * The Lead Engine questionnaire — token-gated, same shape as the voice product's onboarding form
 * at `app/onboarding/questionnaire/[domain]/page.tsx`: a load-then-populate step gates the submit
 * button so a slow or failed load can never present hardcoded defaults as a customer's real
 * answers, which is exactly what made every re-submit destructive there until 2026-08-21.
 *
 * Q10 (pain points) is answered here and never rendered on the public site — see
 * `lib/lead-engine/content.ts`'s own note; this form's label says so explicitly so nobody types a
 * customer-facing sentence into it.
 *
 * 4a and 4b (differentiator / customer_impression) are the two guaranteed Why-us sources and the
 * hero's lede — see `docs/LEAD-ENGINE-PLAN.md`'s "Q4 rewritten" section. 4a is required: no
 * differentiator, no hero, no page.
 */

import { useState, useEffect, use } from 'react'
import type { CtaKind, ServiceItem } from '@/lib/lead-engine/types'

type FormAnswers = {
  business_name: string
  phone: string
  service_areas: string
  differentiator: string
  customer_impression: string
  credentials: string
  years_in_business: string
  primary_cta: CtaKind | ''
  primary_cta_other: string
  google_profile_url: string
  has_photos: boolean | null
  pain_points: string
  notify_email: string
  preferred_slug: string
}

const EMPTY: FormAnswers = {
  business_name: '', phone: '', service_areas: '', differentiator: '', customer_impression: '',
  credentials: '', years_in_business: '', primary_cta: '', primary_cta_other: '',
  google_profile_url: '', has_photos: null, pain_points: '', notify_email: '', preferred_slug: '',
}

export default function LeadEngineQuestionnaire({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [form, setForm] = useState<FormAnswers>(EMPTY)
  const [services, setServices] = useState<ServiceItem[]>([{ name: '', description: '' }])

  const [businessNameOnFile, setBusinessNameOnFile] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const token = new URLSearchParams(window.location.search).get('t')
    const qs = token ? `?t=${encodeURIComponent(token)}` : ''

    fetch(`/api/lead-engine/questionnaire/${id}${qs}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Could not load this questionnaire.')
        return data
      })
      .then(data => {
        if (cancelled) return
        setBusinessNameOnFile(data.businessName ?? null)
        const a = data.answers as Record<string, unknown> | null
        if (a) {
          setForm(prev => {
            const next = { ...prev }
            for (const k of Object.keys(prev) as (keyof FormAnswers)[]) {
              const v = a[k]
              if (v !== null && v !== undefined) (next[k] as unknown) = v
            }
            return next
          })
          if (Array.isArray(a.services) && a.services.length > 0) {
            setServices(a.services.map((s: unknown) =>
              typeof s === 'string' ? { name: s } : (s as ServiceItem)))
          }
        }
      })
      .catch(err => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load this questionnaire.') })
      .finally(() => { if (!cancelled) setLoaded(true) })

    return () => { cancelled = true }
  }, [id])

  const set = <K extends keyof FormAnswers>(key: K, value: FormAnswers[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const setService = (i: number, patch: Partial<ServiceItem>) =>
    setServices(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const addService = () => setServices(prev => (prev.length >= 8 ? prev : [...prev, { name: '', description: '' }]))
  const removeService = (i: number) => setServices(prev => prev.filter((_, idx) => idx !== i))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const token = new URLSearchParams(window.location.search).get('t')
      const res = await fetch(`/api/lead-engine/questionnaire/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: token,
          ...form,
          services: services.filter(s => s.name.trim() !== ''),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save your answers.')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your answers.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 32px', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: '#FFFFFF' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#D4AF37' }}>Answers saved</h2>
        <p style={{ fontSize: '15px', color: '#94A3B8', lineHeight: 1.6 }}>
          Thanks — we have what we need to build your site. We&rsquo;ll be in touch once it&rsquo;s ready to look at.
        </p>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '20px', lineHeight: 1.6 }}>
          You can close this page. If you need to change anything, use the same link again.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 32px' }}>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: Inter, sans-serif; background: #0A0A0A; color: #FFFFFF; }
        input, textarea, select {
          background: #1A1A2E; border: 1px solid rgba(148,163,184,0.2); border-radius: 8px;
          padding: 10px 12px; color: #FFFFFF; font-size: 14px; font-family: Inter, sans-serif;
          margin-top: 6px; margin-bottom: 4px; width: 100%;
        }
        input:focus, textarea:focus, select:focus {
          outline: none; border-color: #D4AF37; box-shadow: 0 0 0 2px rgba(212,175,55,0.1);
        }
        textarea { resize: vertical; }
        label { display: block; font-size: 13px; font-weight: 600; color: #CBD5E1; margin-top: 20px; }
        .hint { font-size: 12px; color: #64748B; margin: 0 0 6px; }
        button { cursor: pointer; }
        .add-row { background: none; border: 1px dashed rgba(148,163,184,0.3); color: #94A3B8; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
        .remove-row { background: none; border: none; color: #64748B; font-size: 12px; padding: 4px 8px; }
      `}</style>

      <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#D4AF37', fontFamily: 'monospace', marginBottom: 8 }}>
        Lead Engine — questionnaire
      </p>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 8 }}>
        {businessNameOnFile ? `Tell us about ${businessNameOnFile}` : 'Tell us about your business'}
      </h1>
      <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: 24, lineHeight: 1.6 }}>
        This builds your site. Skip anything that doesn&rsquo;t apply — a section with no answer just
        doesn&rsquo;t appear on the page, nothing is ever invented to fill a gap.
      </p>

      {!loaded && !loadError && <p style={{ color: '#64748B', fontSize: 14 }}>Loading your saved answers…</p>}
      {loadError && <p style={{ color: '#F87171', fontSize: 14 }}>{loadError}</p>}

      <form onSubmit={handleSubmit} style={{ opacity: loaded ? 1 : 0.4, pointerEvents: loaded ? 'auto' : 'none' }}>
        {error && <p style={{ color: '#F87171', fontSize: 13, marginTop: 16 }}>{error}</p>}

        <label>Business name</label>
        <input value={form.business_name} onChange={e => set('business_name', e.target.value)} required />

        <label>Main phone number</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)} />

        <label>What services do you mainly offer?</label>
        <p className="hint">Add each one separately — a short description is optional but helps.</p>
        {services.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input placeholder="Service name" value={s.name} onChange={e => setService(i, { name: e.target.value })} />
              <input placeholder="Short description (optional)" value={s.description ?? ''} onChange={e => setService(i, { description: e.target.value })} />
            </div>
            {services.length > 1 && (
              <button type="button" className="remove-row" onClick={() => removeService(i)}>Remove</button>
            )}
          </div>
        ))}
        {services.length < 8 && (
          <button type="button" className="add-row" onClick={addService}>+ Add another service</button>
        )}

        <label>What cities or areas do you serve?</label>
        <textarea rows={2} value={form.service_areas} onChange={e => set('service_areas', e.target.value)} placeholder="Fort Worth, Arlington, Keller…" />

        <label>What&rsquo;s one thing you do that other businesses like yours typically don&rsquo;t? *</label>
        <p className="hint">This becomes the headline on your page.</p>
        <input value={form.differentiator} onChange={e => set('differentiator', e.target.value)} required />

        <label>What&rsquo;s the first thing customers usually say about you?</label>
        <input value={form.customer_impression} onChange={e => set('customer_impression', e.target.value)} />

        <label>Any guarantees, licences or certifications customers should know about?</label>
        <input value={form.credentials} onChange={e => set('credentials', e.target.value)} placeholder="Licensed and insured in Texas" />

        <label>Roughly how long have you been in business?</label>
        <input value={form.years_in_business} onChange={e => set('years_in_business', e.target.value)} placeholder="12 years" />

        <label>Preferred call to action</label>
        <select value={form.primary_cta} onChange={e => set('primary_cta', e.target.value as CtaKind)}>
          <option value="">Choose one…</option>
          <option value="call">Call Now</option>
          <option value="estimate">Get a Free Estimate</option>
          <option value="availability">Check Availability</option>
          <option value="other">Something else</option>
        </select>
        {form.primary_cta === 'other' && (
          <input value={form.primary_cta_other} onChange={e => set('primary_cta_other', e.target.value)} placeholder="e.g. Book a Valuation" />
        )}

        <label>Google Business Profile link</label>
        <p className="hint">Don&rsquo;t have it handy? Leave this blank — it&rsquo;s never required.</p>
        <input value={form.google_profile_url} onChange={e => set('google_profile_url', e.target.value)} placeholder="g.page/your-business" />

        <label>Do you have photos we can use?</label>
        <select
          value={form.has_photos === null ? '' : form.has_photos ? 'yes' : 'no'}
          onChange={e => set('has_photos', e.target.value === '' ? null : e.target.value === 'yes')}
        >
          <option value="">Not sure yet</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>

        <label>Biggest pain points getting or handling new customers?</label>
        <p className="hint">For us only — this never appears on your site.</p>
        <textarea rows={3} value={form.pain_points} onChange={e => set('pain_points', e.target.value)} />

        <label>Where should new lead notifications go?</label>
        <p className="hint">Defaults to your account email if you leave this blank.</p>
        <input type="email" value={form.notify_email} onChange={e => set('notify_email', e.target.value)} />

        <label>Preferred web address</label>
        <p className="hint">The part after 369agenticsystems.com/sites/ — we&rsquo;ll confirm it&rsquo;s available.</p>
        <input value={form.preferred_slug} onChange={e => set('preferred_slug', e.target.value)} />

        <button
          type="submit"
          disabled={!loaded || submitting}
          style={{
            marginTop: 32, width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 700,
            borderRadius: 8, border: 'none', background: '#D4AF37', color: '#0A0A0A',
            opacity: !loaded || submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Save my answers'}
        </button>
      </form>
    </div>
  )
}

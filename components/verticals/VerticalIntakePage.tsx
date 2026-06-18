'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Vertical config ───────────────────────────────────────────────────────────

interface VerticalConfig {
  name: string
  headline: string
  subtitle: string
  painPoints: string[]
  fields: {
    callsPerWeek: { label: string; placeholder: string }
    answerRate:   { label: string; placeholder: string; hint?: string }
    jobValue:     { label: string; placeholder: string }
  }
}

const CONFIGS: Record<string, VerticalConfig> = {
  roofing: {
    name:     'Roofing',
    headline: 'Stop Losing Jobs to Missed Calls',
    subtitle: '2-minute form — then we show you exactly what you\'re leaving on the table.',
    painPoints: [
      'Missing calls while on the roof',
      'Losing leads to faster-responding competitors',
      'No follow-up after estimates are sent',
      'Not enough reviews to win trust',
    ],
    fields: {
      callsPerWeek: { label: 'Inbound calls per week (estimate)', placeholder: 'e.g. 20' },
      answerRate:   { label: '% of calls you currently answer', placeholder: 'e.g. 45', hint: 'If 80%+, this may not be a fit for you.' },
      jobValue:     { label: 'Average job value ($)', placeholder: 'e.g. 2500' },
    },
  },
  hvac: {
    name:     'HVAC',
    headline: 'Emergency Calls Answered 24/7',
    subtitle: '2-minute form — then we show you what after-hours calls are costing you.',
    painPoints: [
      'Emergency calls going unanswered after hours',
      'Seasonal volume swings overwhelming the office',
      'Leads lost to follow-up failure',
      'Not enough reviews for the slow season',
    ],
    fields: {
      callsPerWeek: { label: 'Emergency/service calls per week', placeholder: 'e.g. 15' },
      answerRate:   { label: '% of calls answered after hours', placeholder: 'e.g. 30', hint: 'Most HVAC emergencies happen outside business hours.' },
      jobValue:     { label: 'Average service call value ($)', placeholder: 'e.g. 350' },
    },
  },
  plumbing: {
    name:     'Plumbing',
    headline: 'Burst Pipes at 2 AM — We Answer',
    subtitle: '2-minute form — then we show you what missed after-hours calls cost per month.',
    painPoints: [
      'Burst pipes and emergencies after hours',
      'Losing jobs to the first company that picks up',
      'No automated follow-up for non-emergency leads',
      'Not enough online reviews',
    ],
    fields: {
      callsPerWeek: { label: 'Emergency calls per week (estimate)', placeholder: 'e.g. 12' },
      answerRate:   { label: '% of calls answered after hours', placeholder: 'e.g. 20', hint: 'Most plumbing emergencies happen nights and weekends.' },
      jobValue:     { label: 'Average emergency call value ($)', placeholder: 'e.g. 400' },
    },
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  businessName: string
  ownerName:    string
  phone:        string
  email:        string
  businessHours:string
  callsPerWeek: string
  answerRate:   string
  jobValue:     string
  painPoint:    string
}

interface Props {
  vertical: 'roofing' | 'hvac' | 'plumbing'
}

// ── Shared input style ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(148,163,184,0.15)',
  borderRadius: 8,
  color: '#FFFFFF',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VerticalIntakePage({ vertical }: Props) {
  const router = useRouter()
  const config = CONFIGS[vertical]

  const [form, setForm] = useState<FormData>({
    businessName: '', ownerName: '', phone: '', email: '',
    businessHours: '', callsPerWeek: '', answerRate: '', jobValue: '', painPoint: '',
  })
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const encoded = encodeURIComponent(JSON.stringify(form))
    router.push(`/${vertical}/roi-calculator?data=${encoded}`)
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        .vi-input:focus { border-color: rgba(212,175,55,0.6) !important; }
        .vi-select { appearance: none; cursor: pointer; }
        .vi-select option { background: #0A0A0A; }
        .vi-btn:hover { background: #E8C94A !important; }
        .vi-card { transition: border-color 0.2s; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0A0A0A', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>

        {/* Nav */}
        <nav style={{ padding: '20px 24px', borderBottom: '1px solid rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 900, margin: '0 auto' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
              <span style={{ color: '#D4AF37' }}>369</span> AGENTIC SYSTEMS
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {config.name} · Step 1 of 3
            </span>
          </div>
        </nav>

        <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', padding: '4px 14px', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 6, marginBottom: 20, background: 'rgba(212,175,55,0.05)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                // {config.name.toUpperCase()} INTAKE
              </span>
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.15, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {config.headline}
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: '#64748B', lineHeight: 1.7 }}>
              {config.subtitle}
            </p>
          </div>

          {/* Form card */}
          <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 16, padding: '36px 32px' }}>

            {/* Section: Business Info */}
            <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ margin: '0 0 16px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                // BUSINESS INFO
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { name: 'businessName', placeholder: 'Business name', type: 'text', required: true },
                  { name: 'ownerName',    placeholder: 'Your name',      type: 'text', required: true },
                  { name: 'phone',        placeholder: 'Phone number',   type: 'tel',  required: true },
                  { name: 'email',        placeholder: 'Email address',  type: 'email',required: true },
                ].map(field => (
                  <input
                    key={field.name}
                    className="vi-input"
                    type={field.type}
                    name={field.name}
                    value={(form as unknown as Record<string, string>)[field.name]}
                    onChange={handleChange}
                    required={field.required}
                    placeholder={field.placeholder}
                    style={inputStyle}
                  />
                ))}
                <input
                  className="vi-input"
                  type="text"
                  name="businessHours"
                  value={form.businessHours}
                  onChange={handleChange}
                  placeholder="Business hours (e.g. 7 AM – 5 PM)"
                  style={{ ...inputStyle, gridColumn: '1 / -1' }}
                />
              </div>
            </div>

            {/* Section: Metrics */}
            <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ margin: '0 0 16px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                // YOUR NUMBERS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(
                  [
                    { key: 'callsPerWeek', ...config.fields.callsPerWeek },
                    { key: 'answerRate',   ...config.fields.answerRate },
                    { key: 'jobValue',     ...config.fields.jobValue },
                  ] as { key: keyof FormData; label: string; placeholder: string; hint?: string }[]
                ).map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>
                      {f.label}
                    </label>
                    <input
                      className="vi-input"
                      type="number"
                      name={f.key}
                      value={form[f.key]}
                      onChange={handleChange}
                      required
                      min="0"
                      max={f.key === 'answerRate' ? '100' : undefined}
                      placeholder={f.placeholder}
                      style={inputStyle}
                    />
                    {f.hint && (
                      <p style={{ margin: '5px 0 0', fontSize: 11, color: '#475569' }}>{f.hint}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Pain point */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ margin: '0 0 16px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                // BIGGEST PAIN POINT
              </p>
              <select
                className="vi-input vi-select"
                name="painPoint"
                value={form.painPoint}
                onChange={handleChange}
                required
                style={inputStyle}
              >
                <option value="">Select one...</option>
                {config.painPoints.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="vi-btn"
              style={{
                width: '100%',
                padding: '14px',
                background: '#D4AF37',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.01em',
              }}
            >
              {submitting ? 'Calculating...' : 'Calculate My Potential Savings →'}
            </button>
            <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>
              Next: ROI analysis + pricing tiers
            </p>

          </form>
        </div>
      </div>
    </>
  )
}

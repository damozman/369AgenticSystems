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
  dental: {
    name:     'Dental',
    headline: 'Never Miss a Patient After Hours',
    subtitle: '2-minute form — see how many appointments you\'re losing to voicemail.',
    painPoints: [
      'After-hours calls going to voicemail',
      'New patient inquiries not followed up same day',
      'Emergency dental calls lost to a faster practice',
      'Appointment reminders done manually',
    ],
    fields: {
      callsPerWeek: { label: 'New patient/appointment calls per week', placeholder: 'e.g. 30' },
      answerRate:   { label: '% of calls answered during office hours', placeholder: 'e.g. 60', hint: 'After-hours and lunch calls are often the ones lost.' },
      jobValue:     { label: 'Average new patient appointment value ($)', placeholder: 'e.g. 200' },
    },
  },
  legal: {
    name:     'Legal',
    headline: 'High-Value Cases Go Cold Fast',
    subtitle: '2-minute form — see how many client inquiries you\'re losing while in court.',
    painPoints: [
      'Leads going cold while attorneys are in depositions',
      'After-hours inquiries going to competing firms',
      'Intake process slow and inconsistent',
      'Competing firms responding faster and winning the case',
    ],
    fields: {
      callsPerWeek: { label: 'New client inquiry calls per week', placeholder: 'e.g. 15' },
      answerRate:   { label: '% of calls answered within 1 hour', placeholder: 'e.g. 40', hint: 'Most prospects call 3 firms and hire the first to respond.' },
      jobValue:     { label: 'Average case value ($)', placeholder: 'e.g. 5000' },
    },
  },
  'real-estate': {
    name:     'Real Estate',
    headline: 'Hot Buyers Won\'t Wait 4 Hours',
    subtitle: '2-minute form — see how many commissions you\'re leaving on the table.',
    painPoints: [
      'Hot leads going cold between showings',
      'After-hours inquiry calls unanswered',
      'Missing the 5-minute response window',
      'Too many leads, not enough time to call them all',
    ],
    fields: {
      callsPerWeek: { label: 'New buyer/seller inquiry calls per week', placeholder: 'e.g. 25' },
      answerRate:   { label: '% of calls answered within 5 minutes', placeholder: 'e.g. 30', hint: 'Response speed is the #1 factor in real estate lead conversion.' },
      jobValue:     { label: 'Average commission value ($)', placeholder: 'e.g. 9000' },
    },
  },
  insurance: {
    name:     'Insurance',
    headline: 'Quote Requests Sitting Unworked',
    subtitle: '2-minute form — see how many policies you\'re losing to delayed response.',
    painPoints: [
      'Quote requests going unworked for hours',
      'After-hours inquiries going to online competitors',
      'Renewal follow-up done manually and inconsistently',
      'Cross-sell opportunities missed entirely',
    ],
    fields: {
      callsPerWeek: { label: 'New quote/policy inquiry calls per week', placeholder: 'e.g. 20' },
      answerRate:   { label: '% of inquiries responded to same day', placeholder: 'e.g. 50', hint: 'Agencies responding within 5 minutes close 90% more policies.' },
      jobValue:     { label: 'Average annual premium value ($)', placeholder: 'e.g. 1200' },
    },
  },
  saas: {
    name:     'SaaS',
    headline: 'Trial Users Churn Before You Call',
    subtitle: '2-minute form — see how much MRR you\'re losing to slow onboarding response.',
    painPoints: [
      'Trial signups not contacted within 5 minutes',
      'Demo requests going cold overnight',
      'Onboarding calls missed or delayed',
      'Churn happening before first meaningful check-in',
    ],
    fields: {
      callsPerWeek: { label: 'Inbound demo/trial inquiry calls per week', placeholder: 'e.g. 10' },
      answerRate:   { label: '% of demo requests responded to within 1 hour', placeholder: 'e.g. 35', hint: 'Every hour before first contact drops conversion by ~10%.' },
      jobValue:     { label: 'Average annual contract value ($)', placeholder: 'e.g. 2400' },
    },
  },
  wholesale: {
    name:     'Wholesale',
    headline: 'Inbound Orders Sitting in Voicemail',
    subtitle: '2-minute form — see how many orders you\'re losing to manual delays.',
    painPoints: [
      'Inbound POs going unacknowledged for hours',
      'Reorder calls missing after business hours',
      'Manual order entry causing delays and errors',
      'Customer inquiries backing up in voicemail',
    ],
    fields: {
      callsPerWeek: { label: 'Inbound order/inquiry calls per week', placeholder: 'e.g. 30' },
      answerRate:   { label: '% of calls answered during business hours', placeholder: 'e.g. 70', hint: 'After-hours and lunch calls are where orders slip to competitors.' },
      jobValue:     { label: 'Average order value ($)', placeholder: 'e.g. 2500' },
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

type Vertical = 'roofing' | 'hvac' | 'plumbing' | 'dental' | 'legal' | 'real-estate' | 'insurance' | 'saas' | 'wholesale'

interface Props {
  vertical: Vertical
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
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            {config.name} · Step 1 of 3
          </span>
        </nav>

        <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            {/* Product label — makes it explicit what they're getting */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{
                padding: '4px 14px',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: 6,
                background: 'rgba(212,175,55,0.05)',
                fontFamily: 'monospace', fontSize: 9, color: '#D4AF37',
                textTransform: 'uppercase', letterSpacing: '0.2em',
              }}>
                // 24/7 AI RECEPTIONIST
              </span>
              <span style={{
                padding: '4px 10px',
                border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: 6,
                background: 'rgba(74,222,128,0.05)',
                fontFamily: 'monospace', fontSize: 9, color: '#4ADE80',
                textTransform: 'uppercase', letterSpacing: '0.15em',
              }}>
                {config.name}
              </span>
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.15, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {config.headline}
            </h1>
            <p style={{ margin: '0 auto', maxWidth: 480, fontSize: 15, color: '#64748B', lineHeight: 1.7 }}>
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
                  { name: 'businessName', placeholder: 'Business name', type: 'text',  required: true },
                  { name: 'ownerName',    placeholder: 'Your name',      type: 'text',  required: true },
                  { name: 'phone',        placeholder: 'Phone number',   type: 'tel',   required: true },
                  { name: 'email',        placeholder: 'Email address',  type: 'email', required: true },
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

'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LiveDemoWidget } from '@/components/portal/LiveDemoWidget'
import { AgentTeamGrid } from '@/components/agents/AgentTeamGrid'
import { RECOVERY_RATE, RECOVERY_RATE_NOTE } from '@/lib/roi'

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
  tickerLabel: string   // "jobs" | "cases" | "patients" etc
  comparisonRole: string // "Receptionist" | "Intake Coordinator" etc
}

const CONFIGS: Record<string, VerticalConfig> = {
  roofing: {
    name:     'Roofing',
    headline: 'Stop Losing Jobs to Missed Calls',
    subtitle: '2-minute form — then we show you exactly what you\'re leaving on the table.',
    tickerLabel: 'jobs',
    comparisonRole: 'Office Receptionist',
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
    tickerLabel: 'service calls',
    comparisonRole: 'Office Receptionist',
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
    tickerLabel: 'service calls',
    comparisonRole: 'Office Receptionist',
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
    tickerLabel: 'appointments',
    comparisonRole: 'Front Desk Coordinator',
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
    tickerLabel: 'cases',
    comparisonRole: 'Intake Coordinator',
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
    tickerLabel: 'commissions',
    comparisonRole: 'Admin Assistant',
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
    tickerLabel: 'policies',
    comparisonRole: 'Office Receptionist',
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
    tickerLabel: 'contracts',
    comparisonRole: 'SDR / Sales Rep',
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
    tickerLabel: 'orders',
    comparisonRole: 'Order Desk Rep',
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
  'event-rentals': {
    name:     'Event & Party Rentals',
    headline: 'Every "Is It Free Saturday?" Answered',
    subtitle: '2-minute form — then we show you what unanswered booking calls cost per weekend.',
    tickerLabel: 'bookings',
    comparisonRole: 'Office Receptionist',
    painPoints: [
      'Availability calls arriving while you are setting up an event',
      'Weekend and evening inquiries going to voicemail',
      '"Is the princess castle free Saturday?" answered from memory',
      'The same unit promised to two parties on the same day',
    ],
    fields: {
      callsPerWeek: { label: 'Booking inquiry calls per week', placeholder: 'e.g. 25' },
      answerRate:   { label: '% of calls you currently answer', placeholder: 'e.g. 40', hint: 'Most rental inquiries land on evenings and weekends — exactly when you are on a job.' },
      jobValue:     { label: 'Average rental value ($)', placeholder: 'e.g. 350' },
    },
  },
  'dumpster-rental': {
    name:     'Dumpster & Portable Restrooms',
    headline: 'Drop-Off Calls Answered While You Are on the Truck',
    subtitle: '2-minute form — then we show you what missed hire calls cost per month.',
    tickerLabel: 'hires',
    comparisonRole: 'Order Desk Rep',
    painPoints: [
      'Hire calls missed while drivers are on route',
      'Contractors calling three yards and booking the first to pick up',
      'Multi-day hire dates tracked on a whiteboard',
      'No follow-up after an inquiry goes quiet',
    ],
    fields: {
      callsPerWeek: { label: 'Hire inquiry calls per week', placeholder: 'e.g. 30' },
      answerRate:   { label: '% of calls you currently answer', placeholder: 'e.g. 50', hint: 'A contractor calls the next yard on the list within minutes.' },
      jobValue:     { label: 'Average hire value ($)', placeholder: 'e.g. 450' },
    },
  },
  'equipment-rental': {
    name:     'Equipment Rental',
    headline: 'The Skid Steer Is Booked. Was the Call?',
    subtitle: '2-minute form — then we show you what unanswered rental calls cost per month.',
    tickerLabel: 'rentals',
    comparisonRole: 'Rental Counter Clerk',
    painPoints: [
      'Rental calls missed while the counter is serving someone',
      'Contractors moving to the next yard when nobody picks up',
      'Machine availability tracked in one operator\'s head',
      'Early-morning and weekend calls going unanswered',
    ],
    fields: {
      callsPerWeek: { label: 'Rental inquiry calls per week', placeholder: 'e.g. 20' },
      answerRate:   { label: '% of calls you currently answer', placeholder: 'e.g. 55', hint: 'Contractors start calling before the yard opens.' },
      jobValue:     { label: 'Average rental value ($)', placeholder: 'e.g. 600' },
    },
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  businessName:     string
  ownerName:        string
  phone:            string
  email:            string
  businessHours:    string
  callsPerWeek:     string
  answerRate:       string
  jobValue:         string
  currentSetup:     string
  primaryGoal:      string
  heardFrom:        string
  painPoint:        string
}

type Vertical = 'roofing' | 'hvac' | 'plumbing' | 'dental' | 'legal' | 'real-estate' | 'insurance' | 'saas' | 'wholesale' | 'event-rentals' | 'dumpster-rental' | 'equipment-rental'

interface Props {
  vertical:   Vertical
  demoPhone?: string
}

// ── Shared input style ────────────────────────────────────────────────────────

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

// ── Comparison table data ─────────────────────────────────────────────────────

const COMPARISON = [
  {
    label:     'AI Receptionist',
    price:     '$400/mo',
    hours:     '24/7',
    books:     true,
    followsUp: true,
    captures:  true,
    highlight: true,
  },
  {
    label:     'Human Receptionist',
    price:     '$3,500+/mo',
    hours:     'M–F 9–5',
    books:     true,
    followsUp: false,
    captures:  false,
    highlight: false,
  },
  {
    label:     'Answering Service',
    price:     '$250/mo',
    hours:     '24/7',
    books:     false,
    followsUp: false,
    captures:  false,
    highlight: false,
  },
  {
    label:     'Voicemail',
    price:     '$0',
    hours:     '24/7',
    books:     false,
    followsUp: false,
    captures:  false,
    highlight: false,
  },
]

// One shared demo line handles every vertical — Ava listens for what the caller
// needs and adapts. This is just the on-page hint telling them what to say.
const DEMO_HINTS: Record<string, string> = {
  roofing:       'Say you need a roof inspection',
  hvac:          'Say your AC or heater is out',
  plumbing:      'Say you have a plumbing emergency',
  dental:        'Say you need to book a dental appointment',
  legal:         'Say you need a legal consultation',
  'real-estate': "Say you're looking to buy or sell a home",
  insurance:     'Say you need an insurance quote',
  saas:          'Say you want a product demo',
  wholesale:     'Say you need to place a bulk order',
  // The shared demo line captures and books for any industry, but it has no
  // inventory rows of its own — so these hints stay booking-shaped and never
  // ask it to price or check a specific unit.
  'event-rentals':    'Say you want to book a party for Saturday',
  'dumpster-rental':  'Say you need a dumpster delivered this week',
  'equipment-rental': 'Say you want to rent equipment this week',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VerticalIntakePage({ vertical, demoPhone }: Props) {
  const router = useRouter()
  const config = CONFIGS[vertical]

  const [form, setForm] = useState<FormData>({
    businessName: '', ownerName: '', phone: '', email: '',
    businessHours: '', callsPerWeek: '', answerRate: '', jobValue: '',
    currentSetup: '', primaryGoal: '', heardFrom: '', painPoint: '',
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

  // ── Live loss ticker ───────────────────────────────────────────────────────
  const liveLoss = useMemo(() => {
    const calls  = Number(form.callsPerWeek) || 0
    const answer = Number(form.answerRate)   || 0
    const jobVal = Number(form.jobValue)     || 0
    if (!calls || !jobVal || answer >= 100) return null
    const missedPerMonth = calls * 4.33 * ((100 - answer) / 100)
    return Math.round(missedPerMonth * jobVal * RECOVERY_RATE)
  }, [form.callsPerWeek, form.answerRate, form.jobValue])

  const tickerVisible = liveLoss !== null && liveLoss > 0

  return (
    <>
      <style suppressHydrationWarning>{`
        .vi-input:focus { border-color: rgba(212,175,55,0.6) !important; }
        .vi-select { appearance: none; cursor: pointer; }
        .vi-select option { background: #0A0A0A; }
        .vi-btn:hover { background: #E8C94A !important; }
        @keyframes ticker-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ticker-enter { animation: ticker-in 0.35s ease forwards; }
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); }
          50%       { box-shadow: 0 0 16px 2px rgba(248,113,113,0.15); }
        }
        .ticker-pulse { animation: pulse-red 2.5s ease infinite; }
        .comp-row:hover td { background: rgba(212,175,55,0.04); }
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

          {/* Live demo widget */}
          {demoPhone && <LiveDemoWidget demoPhone={demoPhone} promptHint={DEMO_HINTS[vertical]} />}

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ padding: '4px 14px', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 6, background: 'rgba(212,175,55,0.05)', fontFamily: 'monospace', fontSize: 9, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                // 24/7 AI RECEPTIONIST
              </span>
              <span style={{ padding: '4px 10px', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, background: 'rgba(74,222,128,0.05)', fontFamily: 'monospace', fontSize: 9, color: '#4ADE80', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
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

          {/* ── Agent Team ─────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 40 }}>
            <AgentTeamGrid vertical={vertical} size="small" />
          </div>

          {/* ── Comparison table ───────────────────────────────────────────── */}
          <div style={{ marginBottom: 40 }}>
            <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 14px', textAlign: 'center' }}>
              // WHY NOT JUST HIRE SOMEONE?
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['', 'Monthly Cost', 'Available', 'Books Appts', 'Automatic Follow-Up', 'Every Call Logged'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'center', fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={i} className="comp-row" style={{ background: row.highlight ? 'rgba(212,175,55,0.04)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: row.highlight ? '2px solid rgba(212,175,55,0.4)' : '2px solid transparent' }}>
                        <span style={{ fontWeight: row.highlight ? 700 : 400, color: row.highlight ? '#D4AF37' : '#94A3B8', fontSize: 12 }}>
                          {row.label}
                        </span>
                        {row.highlight && (
                          <span style={{ marginLeft: 8, padding: '1px 6px', background: 'rgba(212,175,55,0.15)', borderRadius: 3, fontSize: 8, fontFamily: 'monospace', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            YOU ARE HERE
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: row.highlight ? '#4ADE80' : '#64748B', fontFamily: 'monospace', fontSize: 11, fontWeight: row.highlight ? 700 : 400, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {row.price}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748B', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {row.hours}
                      </td>
                      {[row.books, row.followsUp, row.captures].map((val, j) => (
                        <td key={j} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {val
                            ? <span style={{ color: '#4ADE80', fontSize: 14 }}>✓</span>
                            : <span style={{ color: '#334155', fontSize: 14 }}>✗</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 11, color: '#475569', lineHeight: 1.6, textAlign: 'center' }}>
              This compares what each option does on its own, not what a person is capable of. A great receptionist can follow up and log every call — they just have to remember to, on top of everything else.
            </p>
          </div>

          {/* ── Form card ──────────────────────────────────────────────────── */}
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

            {/* Section: Your Numbers */}
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

                {/* Live loss ticker */}
                {tickerVisible && (
                  <div
                    className="ticker-enter ticker-pulse"
                    style={{
                      padding: '18px 20px',
                      background: 'rgba(248,113,113,0.07)',
                      border: '1px solid rgba(248,113,113,0.25)',
                      borderRadius: 10,
                      marginTop: 4,
                    }}
                  >
                    <p style={{ margin: '0 0 4px', fontFamily: 'monospace', fontSize: 9, color: '#F87171', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                      // ESTIMATED MONTHLY REVENUE WORTH RECOVERING
                    </p>
                    <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 800, color: '#FCA5A5', lineHeight: 1, letterSpacing: '-0.02em' }}>
                      ${liveLoss!.toLocaleString()}
                      <span style={{ fontSize: 14, fontWeight: 400, color: '#F87171', marginLeft: 6, fontFamily: 'monospace' }}>/mo</span>
                    </p>
                    <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                      That's <span style={{ color: '#FCA5A5', fontWeight: 600 }}>${(liveLoss! * 12).toLocaleString()}/year</span> in {config.tickerLabel} going to whoever picks up first.
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
                      {RECOVERY_RATE_NOTE}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Section: Current Setup */}
            <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ margin: '0 0 16px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                // CURRENT SETUP
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>
                    How do you handle missed calls today?
                  </label>
                  <select
                    className="vi-input vi-select"
                    name="currentSetup"
                    value={form.currentSetup}
                    onChange={handleChange}
                    required
                    style={inputStyle}
                  >
                    <option value="">Select one...</option>
                    <option value="voicemail">Voicemail only</option>
                    <option value="answering_service">Third-party answering service</option>
                    <option value="employee">Another employee picks up</option>
                    <option value="nothing">Calls just go unanswered</option>
                    <option value="other">Something else</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>
                    What's your primary goal?
                  </label>
                  <select
                    className="vi-input vi-select"
                    name="primaryGoal"
                    value={form.primaryGoal}
                    onChange={handleChange}
                    required
                    style={inputStyle}
                  >
                    <option value="">Select one...</option>
                    <option value="stop_missing_calls">Stop missing calls entirely</option>
                    <option value="book_more_jobs">Book more jobs without more staff</option>
                    <option value="better_followup">Automate follow-up and nurture</option>
                    <option value="all">All of the above</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>
                    How did you hear about us? <span style={{ color: '#334155' }}>(optional)</span>
                  </label>
                  <select
                    className="vi-input vi-select"
                    name="heardFrom"
                    value={form.heardFrom}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="">Select one...</option>
                    <option value="cold_email">Email outreach</option>
                    <option value="google">Google search</option>
                    <option value="referral">Referral from someone I know</option>
                    <option value="social">Social media</option>
                    <option value="other">Other</option>
                  </select>
                </div>
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
              {submitting ? 'Calculating...' : 'Show Me My Full ROI Analysis →'}
            </button>
            <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>
              Next: personalized ROI breakdown + pricing tiers
            </p>

          </form>

          {/* Trust strip */}
          <div style={{ marginTop: 32, padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'center' }}>
              {[
                '✓  30-day results guarantee',
                '✓  Live within minutes',
                '✓  No long-term contracts',
                '✓  Cancel anytime',
              ].map(item => (
                <span key={item} style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569', letterSpacing: '0.05em' }}>
                  {item}
                </span>
              ))}
            </div>
            <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 9.5, color: '#334155', fontFamily: 'monospace' }}>
              Your dedicated phone number is live within minutes of signup.
            </p>
          </div>

        </div>
      </div>
    </>
  )
}

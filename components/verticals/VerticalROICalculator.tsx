'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { TIERS as TIER_CONFIGS, SETUP_FEE } from '@/lib/tier-config'
import { RECOVERY_RATE } from '@/lib/roi'

// ── Derive display-ready tiers from the single source of truth ────────────────

function getIncludedFree(tierIndex: number) {
  if (tierIndex === 0) return null
  const cumulative = TIER_CONFIGS.slice(0, tierIndex + 1)
    .flatMap(t => t.features.filter(f => f.retellFeature))
  if (cumulative.length === 0) return null
  const labels = cumulative.map(f => f.badge ?? f.label).join(' + ')
  const total  = cumulative.reduce((s, f) => s + (f.retailValue ?? 0), 0)
  return { label: `${labels} — included free`, value: `$${total}/mo value` }
}

const TIERS = TIER_CONFIGS.map((tier, i) => ({
  name:         tier.name,
  price:        tier.price,
  badge:        tier.featured ? 'Most Popular' : undefined,
  description:  tier.description,
  services:     tier.features.filter(f => !f.isSection).map(f => f.label),
  includedFree: getIncludedFree(i),
}))

const ROI_COPY: Record<string, string> = {
  roofing:       'Here\'s What You\'re Leaving Behind',
  hvac:          'Here\'s What After-Hours Calls Are Costing You',
  plumbing:      'Here\'s What Missed Emergency Calls Cost Per Month',
  dental:        'Here\'s What Empty Appointment Slots Are Costing You',
  legal:         'Here\'s What Slow Intake Is Costing Your Firm',
  'real-estate': 'Here\'s What Missed Buyer Calls Are Costing You',
  insurance:     'Here\'s What Delayed Quotes Are Costing You',
  saas:          'Here\'s What Slow Demo Response Is Costing You',
  wholesale:     'Here\'s What Voicemail Delays Are Costing Your Business',
  'event-rentals':    'Here\'s What Missed Booking Calls Cost You Per Weekend',
  'dumpster-rental':  'Here\'s What Missed Hire Calls Are Costing You',
  'equipment-rental': 'Here\'s What Unanswered Rental Calls Are Costing You',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedData {
  businessName: string
  callsPerWeek: number
  answerRate:   number
  jobValue:     number
  ownerName:    string
  email:        string
  currentSetup: string
  primaryGoal:  string
}

type Vertical = 'roofing' | 'hvac' | 'plumbing' | 'dental' | 'legal' | 'real-estate' | 'insurance' | 'saas' | 'wholesale' | 'event-rentals' | 'dumpster-rental' | 'equipment-rental'

interface Props {
  vertical: Vertical
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VerticalROICalculator({ vertical }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [data, setData]             = useState<ParsedData | null>(null)
  const [reportSent, setReportSent] = useState(false)
  const [reportSending, setReportSending] = useState(false)

  useEffect(() => {
    const raw = searchParams.get('data')
    if (!raw) return
    try {
      const parsed = JSON.parse(decodeURIComponent(raw))
      setData({
        businessName: parsed.businessName  || 'Your Business',
        callsPerWeek: Number(parsed.callsPerWeek) || 0,
        answerRate:   Number(parsed.answerRate)   || 0,
        jobValue:     Number(parsed.jobValue)     || 0,
        // carry through new fields for the report
        ownerName:    parsed.ownerName     || '',
        email:        parsed.email         || '',
        currentSetup: parsed.currentSetup  || '',
        primaryGoal:  parsed.primaryGoal   || '',
      })
    } catch {
      // silently ignore malformed params
    }
  }, [searchParams])

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>Loading your analysis...</p>
          <p style={{ color: '#334155', fontFamily: 'monospace', fontSize: 10, marginTop: 8 }}>
            No data? <Link href={`/${vertical}`} style={{ color: '#D4AF37' }}>Start from the intake form</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Calculations ────────────────────────────────────────────────────────────

  const missedCallsPerWeek  = data.callsPerWeek * ((100 - data.answerRate) / 100)
  const missedCallsPerMonth = missedCallsPerWeek * 4.33
  const recoveredPerMonth   = missedCallsPerMonth * RECOVERY_RATE
  const monthlyRevenueLost  = missedCallsPerMonth * data.jobValue
  const monthlySavings      = recoveredPerMonth   * data.jobValue

  function handleSelect(tierName: string, tierPrice: number) {
    sessionStorage.setItem('selectedTier',  tierName)
    sessionStorage.setItem('tierPrice',     String(tierPrice))
    sessionStorage.setItem('formData',      searchParams.get('data') ?? '')
    router.push(`/${vertical}/pricing?tier=${tierName}`)
  }

  async function handleSendReport() {
    if (!data?.email || reportSent || reportSending) return
    setReportSending(true)

    const missedPerMonth   = data.callsPerWeek * 4.33 * ((100 - data.answerRate) / 100)
    const monthlyLost      = Math.round(missedPerMonth * data.jobValue)
    const monthlyRecoverable = Math.round(missedPerMonth * RECOVERY_RATE * data.jobValue)
    const annualLost       = monthlyLost * 12
    const recommended      = TIERS[1] // Pro is default recommendation
    const breakEvenDays    = monthlyRecoverable > 0
      ? Math.ceil((SETUP_FEE + recommended.price) / (monthlyRecoverable / 30))
      : 0
    const yearOneProfit    = (monthlyRecoverable * 12) - (SETUP_FEE + recommended.price * 12)

    try {
      await fetch('/api/send-roi-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName:       data.businessName,
          ownerName:          data.ownerName,
          email:              data.email,
          vertical,
          callsPerWeek:       data.callsPerWeek,
          answerRate:         data.answerRate,
          jobValue:           data.jobValue,
          monthlyLost,
          monthlyRecoverable,
          annualLost,
          currentSetup:       data.currentSetup,
          primaryGoal:        data.primaryGoal,
          recommendedTier:    recommended.name,
          recommendedPrice:   recommended.price,
          breakEvenDays,
          yearOneProfit:      Math.max(0, yearOneProfit),
        }),
      })
      setReportSent(true)
    } catch {
      // fail silently — user can still proceed without report
    } finally {
      setReportSending(false)
    }
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        .roi-tier { transition: border-color 0.18s, transform 0.18s; cursor: pointer; }
        .roi-tier:hover { border-color: rgba(212,175,55,0.5) !important; }
        .roi-btn-primary:hover  { background: #E8C94A !important; }
        .roi-btn-secondary:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0A0A0A', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>

        {/* Nav */}
        <nav style={{ padding: '20px 24px', borderBottom: '1px solid rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1100, margin: '0 auto' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>
              <span style={{ color: '#D4AF37' }}>369</span> AGENTIC SYSTEMS
            </span>
          </Link>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            {vertical.charAt(0).toUpperCase() + vertical.slice(1)} · Step 2 of 3
          </span>
        </nav>

        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '48px 24px 80px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '4px 14px', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 6, marginBottom: 16, background: 'rgba(212,175,55,0.05)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                // ROI ANALYSIS — {data.businessName.toUpperCase()}
              </span>
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {ROI_COPY[vertical] ?? 'Here\'s What You\'re Leaving Behind'}
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: '#64748B' }}>
              Based on {data.callsPerWeek} calls/week · {data.answerRate}% answer rate · ${data.jobValue.toLocaleString()} avg job value
            </p>
          </div>

          {/* Revenue impact — 3 cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 40 }}>

            <div style={{ padding: '28px 24px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 14 }}>
              <p style={{ margin: '0 0 6px', fontFamily: 'monospace', fontSize: 10, color: '#F87171', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Monthly Revenue Lost
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 44, fontWeight: 800, color: '#FCA5A5', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                ${monthlyRevenueLost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                {missedCallsPerMonth.toFixed(0)} missed calls × ${data.jobValue.toLocaleString()} avg
              </p>
            </div>

            <div style={{ padding: '28px 24px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 14 }}>
              <p style={{ margin: '0 0 6px', fontFamily: 'monospace', fontSize: 10, color: '#4ADE80', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Recoverable Per Month
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 44, fontWeight: 800, color: '#86EFAC', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                ${monthlySavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                At 30% recovery rate (conservative estimate)
              </p>
            </div>

            <div style={{ padding: '28px 24px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 10, right: 12, fontFamily: 'monospace', fontSize: 8, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>
                cost of inaction
              </div>
              <p style={{ margin: '0 0 6px', fontFamily: 'monospace', fontSize: 10, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                12-Month Loss If Nothing Changes
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 44, fontWeight: 800, color: '#FCA5A5', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                ${(monthlyRevenueLost * 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                Every month you wait costs another ${monthlyRevenueLost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

          </div>

          {/* Scarcity + guarantee strip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 48 }}>
            <div style={{ padding: '14px 18px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 600, color: '#D4AF37' }}>Limited DFW Availability</p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>We onboard 3 new roofing clients per month per market. 2 spots remaining this month.</p>
              </div>
            </div>
            <div style={{ padding: '14px 18px', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🛡</span>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 600, color: '#4ADE80' }}>30-Day Results Guarantee</p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>If you don't capture a lead you would have missed, we refund your first month. No questions.</p>
              </div>
            </div>
          </div>

          {/* Email report CTA */}
          {data.email && (
            <div style={{ marginBottom: 32, padding: '20px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: '#F0F0F0' }}>
                  Want a copy of this report?
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                  We'll send a branded breakdown to <span style={{ color: '#94A3B8' }}>{data.email}</span>
                </p>
              </div>
              <button
                onClick={handleSendReport}
                disabled={reportSent || reportSending}
                style={{
                  padding: '10px 22px',
                  background: reportSent ? 'rgba(74,222,128,0.12)' : 'rgba(212,175,55,0.12)',
                  border: `1px solid ${reportSent ? 'rgba(74,222,128,0.3)' : 'rgba(212,175,55,0.3)'}`,
                  borderRadius: 8,
                  color: reportSent ? '#4ADE80' : '#D4AF37',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: reportSent || reportSending ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-display)',
                  transition: 'all 0.2s',
                }}
              >
                {reportSent ? '✓ Report Sent' : reportSending ? 'Sending...' : 'Email Me This Report →'}
              </button>
            </div>
          )}

          {/* Tier selection */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 24px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              // CHOOSE YOUR TIER — One-time setup: $1,500
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {TIERS.map(tier => {
                const yearOneProfit = (monthlySavings * 12) - (SETUP_FEE + tier.price * 12)
                const breakEvenDays = monthlySavings > 0
                  ? Math.ceil((SETUP_FEE + tier.price) / (monthlySavings / 30))
                  : 0

                return (
                  <div
                    key={tier.name}
                    className="roi-tier"
                    onClick={() => handleSelect(tier.name, tier.price)}
                    style={{
                      padding: '28px 24px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(148,163,184,0.12)',
                      borderRadius: 14,
                    }}
                  >
                    {tier.badge && (
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ padding: '3px 10px', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 4, fontSize: 9, fontFamily: 'monospace', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                          {tier.badge}
                        </span>
                      </div>
                    )}

                    <h3 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-display)' }}>
                      {tier.name}
                    </h3>
                    <div style={{ margin: '0 0 16px' }}>
                      <span style={{ fontSize: 34, fontWeight: 800, color: '#D4AF37', fontFamily: 'var(--font-display)' }}>
                        ${tier.price}
                      </span>
                      <span style={{ fontSize: 13, color: '#475569' }}>/mo</span>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginBottom: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748B' }}>Break-even</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', fontFamily: 'monospace' }}>
                          {breakEvenDays > 0 ? `${breakEvenDays} days` : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#64748B' }}>Year-1 profit</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ADE80', fontFamily: 'monospace' }}>
                          {yearOneProfit > 0 ? `$${yearOneProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'Calculate above'}
                        </span>
                      </div>
                    </div>

                    {/* Included-free Retell callout */}
                    {tier.includedFree && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 7, marginBottom: 14 }}>
                        <span style={{ fontSize: 9, color: '#D4AF37', flexShrink: 0 }}>★</span>
                        <div>
                          <span style={{ fontSize: 11, color: '#D4AF37', fontWeight: 600 }}>{tier.includedFree.label}</span>
                          <span style={{ marginLeft: 6, fontSize: 10, fontFamily: 'monospace', color: '#475569' }}>{tier.includedFree.value}</span>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: 20 }}>
                      {tier.services.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                          <span style={{ color: '#D4AF37', flexShrink: 0, fontSize: 12, marginTop: 1 }}>✓</span>
                          <span style={{ fontSize: 12, color: i === 0 && tier.name !== 'Starter' ? '#64748B' : '#94A3B8', fontStyle: i === 0 && tier.name !== 'Starter' ? 'italic' : 'normal' }}>
                            {s}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      className={tier.badge ? 'roi-btn-primary' : 'roi-btn-secondary'}
                      style={{
                        width: '100%',
                        padding: '11px',
                        background: tier.badge ? '#D4AF37' : 'rgba(255,255,255,0.05)',
                        color:      tier.badge ? '#0A0A0A'  : '#FFFFFF',
                        border:     '1px solid ' + (tier.badge ? 'transparent' : 'rgba(148,163,184,0.15)'),
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      Select {tier.name} →
                    </button>

                    <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>
                      {tier.description}
                    </p>

                  </div>
                )
              })}
            </div>
          </div>

          {/* Back link */}
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href={`/${vertical}`} style={{ fontSize: 12, color: '#334155', textDecoration: 'none', fontFamily: 'monospace' }}>
              ← Edit your numbers
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}

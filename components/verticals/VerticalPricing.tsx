'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Vertical copy ─────────────────────────────────────────────────────────────

const COPY: Record<string, { headline: string; subhead: string }> = {
  roofing: {
    headline: 'Pricing for Roofing Companies',
    subhead:  'Never lose another job to a missed call — starting at $400/mo.',
  },
  hvac: {
    headline: 'Pricing for HVAC Companies',
    subhead:  'Emergency calls answered 24/7, every night and weekend — starting at $400/mo.',
  },
  plumbing: {
    headline: 'Pricing for Plumbing Companies',
    subhead:  'Burst pipes at 2 AM? We answer. Starting at $400/mo.',
  },
}

// ── Tiers ─────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    name:  'Starter',
    price: 400,
    features: [
      '24/7 AI Receptionist',
      'Call & lead capture',
      'Real-time dashboard',
      'SMS booking confirmations',
      'Daily email summaries',
      '24/7 chat support',
    ],
  },
  {
    name:     'Pro',
    price:    600,
    featured: true,
    features: [
      'Everything in Starter, plus:',
      'Automated lead follow-up',
      'Nurture email sequences',
      'Lead scoring & prioritization',
      'Conversion tracking',
      'Advanced reporting',
    ],
  },
  {
    name:  'Elite',
    price: 750,
    features: [
      'Everything in Pro, plus:',
      'Review request automation',
      'AI review response drafting',
      'Reputation score monitoring',
      'Referral tracking',
      'Priority onboarding & support',
    ],
  },
]

const FAQ = [
  {
    q: 'What\'s included in the $1,500 setup?',
    a: 'Agent configuration for your vertical, dashboard setup, an onboarding call, system prompt tuning, and full integration with your existing workflow.',
  },
  {
    q: 'Can I upgrade my tier later?',
    a: 'Yes — anytime. No long-term contracts, no penalties. Month-to-month after setup.',
  },
  {
    q: 'What if it doesn\'t work for me?',
    a: 'If you don\'t see measurable results in the first 30 days, we\'ll refund your setup fee. No questions asked.',
  },
  {
    q: 'When can I get started?',
    a: 'We onboard new clients weekly. After your discovery call we typically go live within 5-7 business days.',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  vertical: 'roofing' | 'hvac' | 'plumbing'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VerticalPricing({ vertical }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const copy         = COPY[vertical]

  const [selectedTier, setSelectedTier] = useState<string | null>(null)

  useEffect(() => {
    const tier = searchParams.get('tier')
    if (tier) setSelectedTier(tier)
  }, [searchParams])

  function handleCTA(tierName: string) {
    sessionStorage.setItem('finalTier',    tierName)
    sessionStorage.setItem('finalVertical', vertical)
    router.push('/book-demo')
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        .vp-tier { transition: border-color 0.18s; }
        .vp-tier:hover { border-color: rgba(212,175,55,0.4) !important; }
        .vp-btn-primary:hover   { background: #E8C94A !important; }
        .vp-btn-secondary:hover { background: rgba(255,255,255,0.08) !important; }
        .vp-faq-item { border-bottom: 1px solid rgba(255,255,255,0.05); }
        .vp-faq-item:last-child { border-bottom: none; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0A0A0A', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>

        {/* Nav */}
        <nav style={{ padding: '20px 24px', borderBottom: '1px solid rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>
              <span style={{ color: '#D4AF37' }}>369</span> AGENTIC SYSTEMS
            </span>
          </Link>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            {vertical.charAt(0).toUpperCase() + vertical.slice(1)} · Step 3 of 3
          </span>
        </nav>

        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 24px 80px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', padding: '4px 14px', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 6, marginBottom: 20, background: 'rgba(212,175,55,0.05)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                // PRICING
              </span>
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {copy.headline}
            </h1>
            <p style={{ margin: '0 auto 10px', maxWidth: 520, fontSize: 16, color: '#64748B', lineHeight: 1.7 }}>
              {copy.subhead}
            </p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#334155' }}>
              One-time setup fee: $1,500
            </p>
          </div>

          {/* Tier cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 72 }}>
            {TIERS.map(tier => {
              const isSelected = selectedTier === tier.name

              return (
                <div
                  key={tier.name}
                  className="vp-tier"
                  style={{
                    padding: '36px 28px',
                    background:  tier.featured ? 'rgba(212,175,55,0.04)' : 'rgba(255,255,255,0.02)',
                    border:      '1px solid ' + (isSelected ? 'rgba(212,175,55,0.6)' : tier.featured ? 'rgba(212,175,55,0.2)' : 'rgba(148,163,184,0.1)'),
                    borderRadius: 16,
                    position:    'relative',
                  }}
                >
                  {tier.featured && (
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)' }}>
                      <span style={{ padding: '4px 14px', background: '#D4AF37', color: '#0A0A0A', fontSize: 9, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', borderRadius: 4, whiteSpace: 'nowrap' }}>
                        Most Popular
                      </span>
                    </div>
                  )}

                  {isSelected && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ padding: '3px 10px', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 4, fontSize: 9, fontFamily: 'monospace', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        ✓ Your Selection
                      </span>
                    </div>
                  )}

                  <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-display)' }}>
                    {tier.name}
                  </h2>
                  <div style={{ margin: '0 0 28px' }}>
                    <span style={{ fontSize: 48, fontWeight: 800, color: '#D4AF37', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                      ${tier.price}
                    </span>
                    <span style={{ fontSize: 14, color: '#475569' }}>/month</span>
                  </div>

                  <button
                    onClick={() => handleCTA(tier.name)}
                    className={tier.featured ? 'vp-btn-primary' : 'vp-btn-secondary'}
                    style={{
                      width:        '100%',
                      padding:      '13px',
                      background:   tier.featured ? '#D4AF37' : 'rgba(255,255,255,0.05)',
                      color:        tier.featured ? '#0A0A0A'  : '#FFFFFF',
                      border:       '1px solid ' + (tier.featured ? 'transparent' : 'rgba(148,163,184,0.15)'),
                      borderRadius: 10,
                      fontSize:     14,
                      fontWeight:   700,
                      cursor:       'pointer',
                      marginBottom: 28,
                      fontFamily:   'var(--font-display)',
                    }}
                  >
                    Get Started with {tier.name}
                  </button>

                  <div>
                    {tier.features.map((feature, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: '#D4AF37', flexShrink: 0, fontSize: 12, marginTop: 2 }}>✓</span>
                        <span style={{ fontSize: 13, color: i === 0 && feature.startsWith('Everything') ? '#4B5563' : '#94A3B8', fontStyle: feature.startsWith('Everything') ? 'italic' : 'normal', lineHeight: 1.5 }}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                </div>
              )
            })}
          </div>

          {/* FAQ */}
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                // FAQ
              </p>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-display)' }}>
                Common Questions
              </h2>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 14 }}>
              {FAQ.map(({ q, a }) => (
                <div key={q} className="vp-faq-item" style={{ padding: '20px 24px' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>{q}</h3>
                  <p  style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.7 }}>{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Back link */}
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link href={`/${vertical}/roi-calculator`} style={{ fontSize: 12, color: '#334155', textDecoration: 'none', fontFamily: 'monospace' }}>
              ← Back to ROI calculator
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}

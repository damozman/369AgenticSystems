'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { TIERS, SETUP_FEE, type TierFeature, type TierName } from '@/lib/tier-config'
import { STRIPE_PAYMENT_LINKS } from '@/lib/stripe-config'

// ── Vertical copy ─────────────────────────────────────────────────────────────

const COPY: Record<string, { headline: string; subhead: string; urgency: string }> = {
  roofing: {
    headline: 'Pricing for Roofing Companies',
    subhead:  'Never lose another job to a missed call — starting at $400/mo.',
    urgency:  'Roofing season is here. Your AI is live within 24 hours. Every missed call costs you $2,000+ in lost jobs.',
  },
  hvac: {
    headline: 'Pricing for HVAC Companies',
    subhead:  'Emergency calls answered 24/7, every night and weekend — starting at $400/mo.',
    urgency:  'Summer heat rush hits TODAY. Your AI answers emergency calls 24/7 while you sleep. Live in one day. $350+ average emergency call value.',
  },
  plumbing: {
    headline: 'Pricing for Plumbing Companies',
    subhead:  'Burst pipes at 2 AM? We answer. Starting at $400/mo.',
    urgency:  'Burst pipes don\'t wait. Your AI answers emergency calls 24/7, captures job details, books technicians. Live tomorrow. Average emergency call: $400+.',
  },
  dental: {
    headline: 'Pricing for Dental Practices',
    subhead:  'Never miss a patient inquiry again — starting at $400/mo.',
    urgency:  'Patient calls come at all hours. Your AI answers 24/7, books appointments, sends confirmations. Live in hours. Average patient value: $200+.',
  },
  legal: {
    headline: 'Pricing for Law Firms',
    subhead:  'High-value cases need instant response — starting at $400/mo.',
    urgency:  'High-value cases need instant response. Your AI qualifies callers, captures details, routes urgent matters to you within minutes. Live today. Average case value: $5,000+.',
  },
  'real-estate': {
    headline: 'Pricing for Real Estate Agents',
    subhead:  'Hot buyers won\'t wait — starting at $400/mo.',
    urgency:  'Hot buyers won\'t wait. Your AI answers within seconds, qualifies interest, books showings automatically. Live in hours. Average deal: $9,000+.',
  },
  insurance: {
    headline: 'Pricing for Insurance Agencies',
    subhead:  'Quote requests don\'t wait — starting at $400/mo.',
    urgency:  'Quote requests deserve instant response. Your AI captures coverage needs, pulls quotes, books consultations. Agencies responding same-day close 3x faster. Live tomorrow. Average policy: $1,200+.',
  },
  saas: {
    headline: 'Pricing for SaaS Companies',
    subhead:  'Trial users decide in minutes — starting at $400/mo.',
    urgency:  'Trial users decide in minutes, not days. Your AI greets them instantly, answers setup questions, books onboarding calls. Live today. Average customer lifetime value: $2,400+.',
  },
  wholesale: {
    headline: 'Pricing for Wholesale Distributors',
    subhead:  'Inbound orders need instant acknowledgment — starting at $400/mo.',
    urgency:  'Order inquiries can\'t wait. Your AI confirms stock, takes orders, routes to fulfillment. Live today. Average order: $2,500+.',
  },
}

const FAQ = [
  {
    q: 'What\'s included in the $1,500 setup?',
    a: 'Unique phone number allocated (live same day), AI agent configured for your vertical, questionnaire link sent for business context, Knowledge Base auto-populated, dashboard access + onboarding call, system prompt tuning. Done in 24 hours.',
  },
  {
    q: 'How long until my AI is answering calls?',
    a: 'As little as 24 hours. We allocate a new dedicated phone number, configure your agent with vertical-specific settings, and send your onboarding questionnaire. Most clients are live within a day.',
  },
  {
    q: 'Will the AI know about my business?',
    a: 'Yes. Right after setup, you complete a 5-minute questionnaire about your services, pain points, common objections, and how you like to handle calls. We upload this to your agent\'s Knowledge Base so it references your business context on every call.',
  },
  {
    q: 'What\'s this monthly ROI report?',
    a: 'On the 1st of each month, you get an email showing real numbers: calls answered, leads captured, estimated revenue protected (using your vertical\'s average job value), and ROI multiplier. Example: "You protected $12,600 in revenue this month. Your fee was $400. ROI: 31x." It\'s proof that the service works.',
  },
  {
    q: 'Do I get follow-up automation?',
    a: 'Only in Pro and Elite. Pro includes automated 3-step email follow-up sequences (vertical-specific). Legal gets deadline urgency, Real Estate gets market timing angles, Insurance gets coverage gap messaging. Follow-up now works for ALL 9 verticals, not just the first 3.',
  },
  {
    q: 'Can I upgrade my tier later?',
    a: 'Yes — anytime. No long-term contracts, no penalties. Month-to-month after setup.',
  },
  {
    q: 'What if it doesn\'t work for me?',
    a: 'If you don\'t see measurable results in the first 30 days, we\'ll refund your first month. No questions asked. But most clients see ROI within week 1.',
  },
  {
    q: 'What are Crystal Clear and Custom Business Intelligence?',
    a: 'Crystal Clear is Retell AI\'s HD call processing technology — normally $25/mo, included free in all plans. Custom Business Intelligence is Retell\'s advanced caller analytics platform — normally $49/mo, included free in Elite.',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  vertical: 'roofing' | 'hvac' | 'plumbing' | 'dental' | 'legal' | 'real-estate' | 'insurance' | 'saas' | 'wholesale'
}

// ── Feature row ────────────────────────────────────────────────────────────────

function FeatureRow({ feature }: { feature: TierFeature }) {
  if (feature.isSection) {
    return (
      <div style={{ marginBottom: 12, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', fontFamily: 'monospace' }}>
          {feature.label}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
      <CheckCircle
        size={13}
        style={{ color: '#D4AF37', flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
          {feature.label}
        </span>
        {feature.retellFeature && feature.retailValue && (
          <span style={{
            marginLeft: 6,
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#D4AF37',
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: 3,
            padding: '1px 5px',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ textDecoration: 'line-through', color: '#475569' }}>${feature.retailValue}/mo</span>
            {' '}FREE
          </span>
        )}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VerticalPricing({ vertical }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const copy         = COPY[vertical] ?? COPY.roofing

  const [selectedTier, setSelectedTier] = useState<string | null>(null)

  useEffect(() => {
    const tier = searchParams.get('tier')
    if (tier) setSelectedTier(tier)
  }, [searchParams])

  function handleCTA(tierName: TierName) {
    const stripeLink = STRIPE_PAYMENT_LINKS[tierName]
    if (stripeLink) {
      window.location.href = `${stripeLink}?client_reference_id=${vertical}`
      return
    }
    sessionStorage.setItem('finalTier',     tierName)
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
            {SETUP_FEE > 0 && (
              <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#334155' }}>
                One-time setup fee: ${SETUP_FEE.toLocaleString()}
              </p>
            )}
          </div>

          {/* Tier cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 56 }}>
            {TIERS.map(tier => {
              const isSelected = selectedTier === tier.name

              return (
                <div
                  key={tier.name}
                  className="vp-tier"
                  style={{
                    padding:     '36px 28px',
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
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
                    {tier.description}
                  </p>
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
                      marginBottom: 10,
                      fontFamily:   'var(--font-display)',
                    }}
                  >
                    {STRIPE_PAYMENT_LINKS[tier.name] ? `Start Today — ${tier.name}` : `Get Started with ${tier.name}`}
                  </button>

                  {/* Vertical urgency note */}
                  <p style={{ margin: '0 0 24px', textAlign: 'center', fontSize: 10, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    {tier.featured ? copy.urgency : ' '}
                  </p>

                  {/* Feature list */}
                  <div>
                    {tier.features.map((feature, i) => (
                      <FeatureRow key={i} feature={feature} />
                    ))}
                  </div>

                </div>
              )
            })}
          </div>

          {/* Value callout section */}
          <div style={{ maxWidth: 760, margin: '0 auto 72px', padding: '32px 28px', background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 16 }}>
            <p style={{ margin: '0 0 20px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              // BUNDLED RETELL AI FEATURES — INCLUDED FREE
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>
              We partner with Retell AI to deliver enterprise-grade voice technology.
              Two premium Retell features ship bundled into your plan at no extra charge.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flexShrink: 0, padding: '3px 8px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 4, fontFamily: 'monospace', fontSize: 9, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap', marginTop: 1 }}>
                  Crystal Clear
                </div>
                <div>
                  <span style={{ fontSize: 13, color: '#CBD5E1', fontWeight: 600 }}>HD Call Quality</span>
                  <span style={{ margin: '0 6px', color: '#334155' }}>·</span>
                  <span style={{ fontSize: 12, color: '#475569' }}>Normally </span>
                  <span style={{ fontSize: 12, color: '#475569', textDecoration: 'line-through' }}>$25/mo</span>
                  <span style={{ fontSize: 12, color: '#D4AF37', fontWeight: 600 }}> · Included in every plan</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flexShrink: 0, padding: '3px 8px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 4, fontFamily: 'monospace', fontSize: 9, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap', marginTop: 1 }}>
                  Custom BI
                </div>
                <div>
                  <span style={{ fontSize: 13, color: '#CBD5E1', fontWeight: 600 }}>Caller Analytics & Intelligence</span>
                  <span style={{ margin: '0 6px', color: '#334155' }}>·</span>
                  <span style={{ fontSize: 12, color: '#475569' }}>Normally </span>
                  <span style={{ fontSize: 12, color: '#475569', textDecoration: 'line-through' }}>$49/mo</span>
                  <span style={{ fontSize: 12, color: '#D4AF37', fontWeight: 600 }}> · Included in Elite</span>
                </div>
              </div>
            </div>
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

import type { Metadata } from 'next'
import Link from 'next/link'
import EarlyAccessForm from '@/components/landing/EarlyAccessForm'
import AmbientOrb from '@/components/landing/AmbientOrb'
import { AgentTeamGrid } from '@/components/agents/AgentTeamGrid'

export const metadata: Metadata = {
  title: '369 Agentic Systems | AI Workforce Infrastructure',
  description:
    'Deploy an autonomous AI workforce that handles lead intake, appointment setting, follow-up, and revenue recovery 24/7 — without adding headcount. Built for law firms, dental practices, roofing companies, real estate brokerages, and more.',
  keywords: [
    'AI automation', 'autonomous agents', 'lead response automation',
    'AI workforce', 'business automation', 'appointment booking automation',
    'revenue recovery', 'dental practice automation', 'law firm automation',
    'roofing leads automation', 'real estate automation',
  ],
  metadataBase: new URL('https://369agenticsystems.com'),
  alternates: { canonical: '/' },
  openGraph: {
    title: '369 Agentic Systems | AI Workforce Infrastructure',
    description: 'The End of Admin. The Start of Agentic Scale. Deploy your autonomous digital workforce today.',
    url: 'https://369agenticsystems.com',
    siteName: '369 Agentic Systems',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: '369 Agentic Systems | AI Workforce Infrastructure',
    description: 'Deploy an autonomous AI workforce. 24/7 lead intake, appointment setting, and revenue recovery.',
  },
  robots: { index: true, follow: true },
}

const INDUSTRIES = [
  { num: '01', name: 'Legal',         aos: 'Legal Excellence AOS',       color: '#60A5FA', pain: 'High-value leads go cold while attorneys are in court',          agent: '24/7 Intake + Conflict Check' },
  { num: '02', name: 'Roofing',       aos: 'Speed-to-Lead AOS',          color: '#F59E0B', pain: 'First company to respond wins the job — most respond in hours',  agent: '24/7 Call Answering + Follow-up' },
  { num: '03', name: 'HVAC',          aos: 'Speed-to-Lead AOS',          color: '#FF6533', pain: 'Emergency no-heat/no-AC calls go to voicemail after hours',        agent: '24/7 Call Answering + Follow-up' },
  { num: '04', name: 'Plumbing',      aos: 'Speed-to-Lead AOS',          color: '#0369A1', pain: 'Burst-pipe emergencies can\'t wait for a callback',                agent: '24/7 Call Answering + Follow-up' },
  { num: '05', name: 'Dental',        aos: 'Patient Revenue AOS',        color: '#EC4899', pain: 'Evening and weekend inquiries go unanswered for 12–48 hours',    agent: 'Planned — waitlist' },
  { num: '06', name: 'Real Estate',   aos: 'Pipeline Velocity AOS',      color: '#0EA5E9', pain: 'Agents juggle 50+ leads manually — hot buyers slip away',         agent: '24/7 Call Answering + Follow-up' },
  { num: '07', name: 'Insurance',     aos: 'Agency Revenue AOS',         color: '#14B8A6', pain: 'Quote requests sit unworked while producers are on other calls', agent: '24/7 Call Answering + Follow-up' },
  { num: '08', name: 'Wholesale',     aos: 'Distribution Velocity AOS',  color: '#84CC16', pain: 'Inbound order calls go to voicemail during busy hours',           agent: '24/7 Call Answering + Follow-up' },
]

const STEPS = [
  { num: '01', title: 'Autonomous Audit',  description: 'Our intelligence engine scans your digital infrastructure — security posture, SEO visibility, and revenue leakage — in minutes. No forms, no calls required.' },
  { num: '02', title: 'Agent Deployment',  description: 'We configure and deploy the right specialist agents for your industry, business model, and highest-value workflows. White-glove installation.' },
  { num: '03', title: 'Agentic Scale',     description: 'Your digital workforce operates 24/7, learns your process, and compounds results over time — while you focus on high-value decisions.' },
]

const STATS = [
  { value: '< 60s',   label: 'Lead Response Time' },
  { value: '24/7',    label: 'Autonomous Operation' },
  { value: '20+ hrs', label: 'Admin Reclaimed / Week' },
  { value: '9',       label: 'Industries Deployed' },
]

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '369 Agentic Systems',
    description: 'AI Workforce Infrastructure — autonomous agents for lead intake, appointment setting, and revenue recovery',
    url: 'https://369agenticsystems.com',
    email: 'intelligence@369agenticsystems.com',
    areaServed: 'US',
    knowsAbout: ['AI Automation', 'Business Process Automation', 'Lead Management', 'Revenue Operations'],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style suppressHydrationWarning>{`
        :root {
          --gold: #D4AF37;
          --gold-light: #E8C84A;
          --obsidian: #0A0A0A;
          --glass-bg: rgba(255,255,255,0.04);
          --glass-border: rgba(148,163,184,0.11);
          --glass-blur: 24px;
        }
        .lp-noise {
          position: fixed; inset: 0;
          pointer-events: none; z-index: 1; opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
        }
.lp-grid {
          position: fixed; inset: 0;
          pointer-events: none; z-index: 1;
          background-image:
            linear-gradient(rgba(148,163,184,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.022) 1px, transparent 1px);
          background-size: 64px 64px;
        }
        .lp-glass {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: 20px;
        }
        .lp-glass-card {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(148,163,184,0.09);
          border-radius: 14px;
          transition: border-color 0.2s, background 0.2s;
        }
        .lp-glass-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(148,163,184,0.18);
        }
        .lp-gradient-text {
          background: linear-gradient(135deg, #F0F0F0 0%, #D4AF37 55%, #E8C84A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-gold-bar {
          height: 3px;
          background: linear-gradient(90deg, #D4AF37, #E8C84A, #D4AF37);
        }
        @media (max-width: 640px) {
          .lp-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .lp-steps-grid { grid-template-columns: 1fr !important; }
          .lp-hero-tags { gap: 6px !important; }
        }
      `}</style>

      {/* Fixed background layers */}
      <div className="lp-noise" aria-hidden="true" />
      <AmbientOrb />
      <div className="lp-grid" aria-hidden="true" />

      <div style={{ minHeight: '100vh', fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif', position: 'relative', zIndex: 2 }}>

        {/* Gold top bar */}
        <div className="lp-gold-bar" />

        {/* Nav */}
        <nav style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1100, margin: '0 auto' }}>
          <span style={{ fontFamily: "'Instrument Sans', monospace", fontSize: 15, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
            <span style={{ color: '#D4AF37' }}>369</span> AGENTIC SYSTEMS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', boxShadow: '0 0 8px rgba(245,158,11,0.6)' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                EARLY ACCESS OPEN
              </span>
            </div>
            <Link
              href="/book-demo"
              style={{
                padding: '8px 18px',
                background: '#D4AF37',
                color: '#0A0A0A',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                fontFamily: "'Instrument Sans', sans-serif",
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              Book a Call
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* Glow behind headline */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 600, height: 300,
            background: 'radial-gradient(ellipse, rgba(212,175,55,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'inline-block', padding: '5px 16px', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 6, marginBottom: 32, background: 'rgba(212,175,55,0.05)' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              // FOUNDING OPERATOR PROGRAM — 20 SLOTS AVAILABLE
            </span>
          </div>

          <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: "'Instrument Sans', sans-serif" }}>
            The End of Admin.<br />
            <span className="lp-gradient-text">The Start of Agentic Scale.</span>
          </h1>

          <p style={{ margin: '0 auto 44px', maxWidth: 620, fontSize: 18, color: '#94A3B8', lineHeight: 1.8 }}>
            369 Agentic Systems installs an autonomous AI workforce inside your business —
            handling lead intake, appointment setting, follow-up, and revenue recovery
            around the clock. No additional headcount. No manual admin.
          </p>

          <div className="lp-hero-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {['LEAD INTELLIGENCE', 'WORKFORCE AUTOMATION', 'REVENUE RECOVERY', 'ZERO ADMIN'].map(tag => (
              <span key={tag} style={{
                padding: '6px 16px',
                background: 'rgba(212,175,55,0.06)',
                border: '1px solid rgba(212,175,55,0.2)',
                borderRadius: 6,
                fontFamily: 'monospace', fontSize: 10, color: '#D4AF37',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Stats bar */}
        <section style={{ padding: '0 24px 0' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="lp-glass lp-stats-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0, textAlign: 'center', padding: '32px 24px',
            }}>
              {STATS.map(({ value, label }, i) => (
                <div key={label} style={{
                  padding: '8px 16px',
                  borderRight: i < STATS.length - 1 ? '1px solid rgba(148,163,184,0.08)' : 'none',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: 30, fontWeight: 800, color: '#D4AF37', fontFamily: "'Instrument Sans', monospace", letterSpacing: '-0.02em' }}>{value}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'monospace' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Industries */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ margin: '0 0 12px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.22em' }}>
              // DEPLOYMENT VERTICALS
            </p>
            <div style={{ width: 44, height: 2, background: '#D4AF37', margin: '0 auto 20px' }} />
            <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#FFFFFF', fontFamily: "'Instrument Sans', sans-serif" }}>
              Built for Your Industry
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 520, fontSize: 15, color: '#64748B', lineHeight: 1.75 }}>
              Every AOS is configured for your specific business model, revenue cycle, and highest-value workflows — not a generic chatbot.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {INDUSTRIES.map(({ num, name, aos, color, pain, agent }) => (
              <article key={num} className="lp-glass-card" style={{
                padding: '22px 20px',
                borderTop: `2px solid ${color}`,
                borderRadius: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#334155', letterSpacing: '0.15em' }}>{num}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>AOS</span>
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Instrument Sans', sans-serif" }}>{name}</h3>
                <p style={{ margin: '0 0 14px', fontFamily: 'monospace', fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{aos}</p>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748B', lineHeight: 1.65 }}>{pain}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                  <span style={{ color }}>→</span> {agent}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Meet the Team */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ margin: '0 0 12px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.22em' }}>
              // DIGITAL WORKFORCE
            </p>
            <div style={{ width: 44, height: 2, background: '#D4AF37', margin: '0 auto 20px' }} />
            <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#FFFFFF', fontFamily: "'Instrument Sans', sans-serif" }}>
              Meet the Team
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 520, fontSize: 15, color: '#64748B', lineHeight: 1.75 }}>
              Your autonomous AI workforce, handling intake, outreach, and intelligence — live agents shown below, more rolling out by vertical.
            </p>
          </div>
          <AgentTeamGrid vertical="original" size="medium" />
        </section>

        {/* How it works */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="lp-glass" style={{ padding: '60px 48px' }}>
              <div style={{ textAlign: 'center', marginBottom: 52 }}>
                <p style={{ margin: '0 0 12px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.22em' }}>
                  // DEPLOYMENT PROCESS
                </p>
                <div style={{ width: 44, height: 2, background: '#D4AF37', margin: '0 auto 20px' }} />
                <h2 style={{ margin: 0, fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#FFFFFF', fontFamily: "'Instrument Sans', sans-serif" }}>
                  Operational in Days, Not Months
                </h2>
              </div>

              <div className="lp-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 32 }}>
                {STEPS.map(({ num, title, description }) => (
                  <div key={num} style={{ display: 'flex', gap: 20 }}>
                    <div style={{
                      flexShrink: 0, width: 44, height: 44, borderRadius: 10,
                      background: 'rgba(212,175,55,0.08)',
                      border: '1px solid rgba(212,175,55,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#D4AF37' }}>{num}</span>
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Instrument Sans', sans-serif" }}>{title}</h3>
                      <p style={{ margin: 0, fontSize: 14, color: '#64748B', lineHeight: 1.8 }}>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Early Access Form */}
        <section style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px 100px' }}>
          <div className="lp-glass" style={{ overflow: 'hidden', borderRadius: 20 }}>
            <div className="lp-gold-bar" />
            <div style={{ padding: '36px 36px 32px' }}>
              <p style={{ margin: '0 0 6px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                // FOUNDING OPERATOR APPLICATION
              </p>
              <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Instrument Sans', sans-serif" }}>
                Claim Your Deployment Slot
              </h2>
              <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748B', lineHeight: 1.75 }}>
                We&apos;re accepting the first{' '}
                <strong style={{ color: '#D4AF37' }}>20 founding operators</strong>{' '}
                before public launch. Founding members receive locked-in pricing and
                priority white-glove deployment.
              </p>
              <EarlyAccessForm />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid rgba(148,163,184,0.08)', padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
            <span style={{ color: '#D4AF37' }}>369</span> AGENTIC SYSTEMS
          </p>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 10, color: '#1E293B' }}>
            AI Workforce Infrastructure &nbsp;&middot;&nbsp;{' '}
            <a href="mailto:intelligence@369agenticsystems.com" style={{ color: '#334155', textDecoration: 'none' }}>
              intelligence@369agenticsystems.com
            </a>
          </p>
        </footer>

      </div>
    </>
  )
}

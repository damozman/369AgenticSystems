import type { Metadata } from 'next'
import EarlyAccessForm from '@/components/landing/EarlyAccessForm'

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
  { num: '01', name: 'Legal',        aos: 'Legal Excellence AOS',       color: '#60A5FA', pain: 'High-value leads go cold while attorneys are in court',         agent: 'Intake Qualifier + Document Drafter' },
  { num: '02', name: 'Roofing',      aos: 'Speed-to-Lead AOS',          color: '#F59E0B', pain: 'First company to respond wins the job — most respond in hours', agent: 'Instant Lead Responder + Estimator' },
  { num: '03', name: 'SaaS',         aos: 'Growth Engine AOS',          color: '#6366F1', pain: 'Trial users churn before onboarding reaches them',              agent: 'Onboarding Specialist + Churn Guard' },
  { num: '04', name: 'Dental',       aos: 'Patient Revenue AOS',        color: '#EC4899', pain: 'Evening and weekend inquiries go unanswered for 12–48 hours',   agent: 'Appointment Setter + Patient Nurture' },
  { num: '05', name: 'Real Estate',  aos: 'Pipeline Velocity AOS',      color: '#0EA5E9', pain: 'Agents juggle 50+ leads manually — hot buyers slip away',        agent: 'Lead Qualifier + Showing Coordinator' },
  { num: '06', name: 'Insurance',    aos: 'Agency Revenue AOS',         color: '#14B8A6', pain: 'Quote requests sit unworked while producers chase renewals',     agent: 'Quote Processor + Cross-Sell Agent' },
  { num: '07', name: 'Wholesale',    aos: 'Distribution Velocity AOS',  color: '#84CC16', pain: 'Inbound POs require manual entry, causing delays and errors',    agent: 'Order Processor + Reorder Trigger' },
  { num: '08', name: 'Your Industry', aos: 'Custom AOS',                color: '#94A3B8', pain: 'Any repetitive revenue-critical workflow can be automated',      agent: 'Custom Agent Stack — built to spec' },
]

const STEPS = [
  { num: '01', title: 'Autonomous Audit',   description: 'Our intelligence engine scans your digital infrastructure — security posture, SEO visibility, and revenue leakage — in minutes. No forms, no calls required.' },
  { num: '02', title: 'Agent Deployment',   description: 'We configure and deploy the right specialist agents for your industry, business model, and highest-value workflows. White-glove installation.' },
  { num: '03', title: 'Agentic Scale',      description: 'Your digital workforce operates 24/7, learns your process, and compounds results over time — while you focus on high-value decisions.' },
]

const STATS = [
  { value: '< 60s',  label: 'Lead Response Time' },
  { value: '24/7',   label: 'Autonomous Operation' },
  { value: '20+ hrs', label: 'Admin Reclaimed / Week' },
  { value: '8',      label: 'Industries Deployed' },
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

      <div style={{ background: '#0A0A0A', minHeight: '100vh', fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif' }}>

        {/* Gold top bar */}
        <div style={{ height: 3, background: '#D4AF37' }} />

        {/* Nav */}
        <nav style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1100, margin: '0 auto' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.2em' }}>
            <span style={{ color: '#D4AF37' }}>369</span> AGENTIC SYSTEMS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              EARLY ACCESS OPEN
            </span>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px 72px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 4, marginBottom: 28 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              // FOUNDING OPERATOR PROGRAM — 20 SLOTS AVAILABLE
            </span>
          </div>

          <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            The End of Admin.<br />
            <span style={{ color: '#D4AF37' }}>The Start of Agentic Scale.</span>
          </h1>

          <p style={{ margin: '0 auto 40px', maxWidth: 640, fontSize: 18, color: '#94A3B8', lineHeight: 1.75 }}>
            369 Agentic Systems installs an autonomous AI workforce inside your business —
            handling lead intake, appointment setting, follow-up, and revenue recovery
            around the clock. No additional headcount. No manual admin.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {['LEAD INTELLIGENCE', 'WORKFORCE AUTOMATION', 'REVENUE RECOVERY', 'ZERO ADMIN'].map(tag => (
              <span key={tag} style={{
                padding: '6px 14px', background: 'rgba(212,175,55,0.07)',
                border: '1px solid rgba(212,175,55,0.2)', borderRadius: 4,
                fontFamily: 'monospace', fontSize: 10, color: '#D4AF37',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Stats bar */}
        <section style={{ background: '#0D0D0D', borderTop: '1px solid #111', borderBottom: '1px solid #111', padding: '28px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, textAlign: 'center' }}>
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#D4AF37', fontFamily: 'monospace' }}>{value}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Industries */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              // DEPLOYMENT VERTICALS
            </p>
            <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#FFFFFF' }}>
              Built for Your Industry
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 520, fontSize: 15, color: '#64748B', lineHeight: 1.7 }}>
              Every AOS is configured for your specific business model, revenue cycle, and highest-value workflows — not a generic chatbot.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {INDUSTRIES.map(({ num, name, aos, color, pain, agent }) => (
              <article key={num} style={{
                background: '#0F0F0F', border: '1px solid #1A1A1A',
                borderTop: `2px solid ${color}`, borderRadius: 8, padding: '22px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#334155', letterSpacing: '0.15em' }}>{num}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>AOS</span>
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{name}</h3>
                <p style={{ margin: '0 0 14px', fontFamily: 'monospace', fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{aos}</p>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>{pain}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                  <span style={{ color }}>→</span> {agent}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style={{ background: '#0D0D0D', borderTop: '1px solid #111', borderBottom: '1px solid #111' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                // DEPLOYMENT PROCESS
              </p>
              <h2 style={{ margin: 0, fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#FFFFFF' }}>
                Operational in Days, Not Months
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              {STEPS.map(({ num, title, description }) => (
                <div key={num} style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 8, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#D4AF37' }}>{num}</span>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{title}</h3>
                    <p style={{ margin: 0, fontSize: 14, color: '#64748B', lineHeight: 1.75 }}>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Early Access Form */}
        <section style={{ maxWidth: 640, margin: '0 auto', padding: '80px 24px 96px' }}>
          <div style={{ background: '#0F0F0F', border: '1px solid #1E1E1E', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #D4AF37, #F59E0B)' }} />
            <div style={{ padding: '32px 36px 28px' }}>
              <p style={{ margin: '0 0 6px', fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                // FOUNDING OPERATOR APPLICATION
              </p>
              <h2 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 700, color: '#FFFFFF' }}>
                Claim Your Deployment Slot
              </h2>
              <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>
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
        <footer style={{ borderTop: '1px solid #111', padding: '28px 24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.2em' }}>
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

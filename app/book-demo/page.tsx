export const metadata = {
  title: 'Book Your Discovery Call | 369 Agentic Systems',
  description: 'Schedule your 30-minute strategy session. We\'ll audit your workflow, identify revenue leaks, and map out your custom AI workforce.',
}

export default function BookDemoPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 32px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '4px 14px', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 6, marginBottom: 20, background: 'rgba(212,175,55,0.05)' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            // DISCOVERY CALL
          </span>
        </div>
        <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Let's Build Your<br />Digital Workforce
        </h1>
        <p style={{ margin: '0 auto', maxWidth: 480, fontSize: 15, color: '#64748B', lineHeight: 1.75 }}>
          30 minutes. We'll audit your workflow, pinpoint your revenue leaks, and map out exactly how your AI workforce will operate.
        </p>
      </div>

      {/* Cal.com embed */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 16, overflow: 'hidden' }}>
          <iframe
            src="https://cal.com/369agentic/30min?embed=true&hideEventTypeDetails=false&layout=month_view&theme=dark"
            frameBorder={0}
            style={{ width: '100%', height: 660, display: 'block' }}
            title="Book a 30-Minute Strategy Session"
          />
        </div>

        {/* Fallback link */}
        <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: 12, color: '#334155', fontFamily: 'monospace' }}>
          Calendar not loading?{' '}
          <a
            href="mailto:chris@369agenticsystems.com?subject=Discovery Call Request"
            style={{ color: '#D4AF37', textDecoration: 'none' }}
          >
            Email us directly →
          </a>
        </p>
      </div>

    </div>
  )
}

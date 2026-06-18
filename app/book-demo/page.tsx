export const metadata = {
  title: 'Book Your Discovery Call | 369 Agentic Systems',
  description: 'Schedule your 20-minute discovery call. We\'ll walk you through exactly how your AI workforce will work.',
}

export default function BookDemoPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
      <div style={{ maxWidth: 560, width: '100%', padding: '0 24px', textAlign: 'center' }}>

        <div style={{ display: 'inline-block', padding: '4px 14px', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 6, marginBottom: 24, background: 'rgba(212,175,55,0.05)' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            // DISCOVERY CALL
          </span>
        </div>

        <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Let's Build Your<br />Digital Workforce
        </h1>

        <p style={{ margin: '0 0 36px', fontSize: 15, color: '#64748B', lineHeight: 1.75 }}>
          20-minute call. We'll confirm your fit, walk through the setup process, and answer every question before you commit to anything.
        </p>

        {/* Calendar placeholder */}
        <div style={{ padding: '48px 32px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 16, marginBottom: 28 }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Calendar booking — coming soon
          </p>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: '#475569' }}>
            In the meantime, email us directly to schedule:
          </p>
          <a
            href="mailto:chris@369agenticsystems.com?subject=Discovery Call Request"
            style={{
              display: 'inline-block',
              padding: '13px 32px',
              background: '#D4AF37',
              color: '#0A0A0A',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: 'var(--font-display)',
            }}
          >
            Email to Schedule →
          </a>
        </div>

        <p style={{ margin: 0, fontSize: 11, color: '#1E293B', fontFamily: 'monospace' }}>
          We respond within 4 hours on business days
        </p>

      </div>
    </div>
  )
}

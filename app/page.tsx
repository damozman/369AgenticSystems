'use client'

import { useState } from 'react'

const CAPABILITIES = [
  {
    code: 'SYS-01',
    label: 'Autonomous Lead Intelligence',
    description: 'Every inbound lead is identified, scored, and engaged within 60 seconds — 24/7, without human intervention.',
    color: '#D4AF37',
  },
  {
    code: 'SYS-02',
    label: 'Digital Workforce Deployment',
    description: 'Specialist agents handle intake, qualification, appointment setting, and follow-up across your entire pipeline.',
    color: '#60A5FA',
  },
  {
    code: 'SYS-03',
    label: 'Revenue Leak Recovery',
    description: 'Our audit engine identifies exactly where your business is losing revenue and deploys autonomous recovery agents.',
    color: '#4ADE80',
  },
]

export default function HomePage() {
  const [form, setForm]     = useState({ name: '', email: '', business: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/early-access', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
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
            INITIALIZING — EARLY ACCESS ONLY
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px 72px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '5px 14px', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 4, marginBottom: 28 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            // FOUNDING OPERATOR PROGRAM — NOW OPEN
          </span>
        </div>

        <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          The End of Admin.<br />
          <span style={{ color: '#D4AF37' }}>The Start of Agentic Scale.</span>
        </h1>

        <p style={{ margin: '0 auto 40px', maxWidth: 620, fontSize: 18, color: '#94A3B8', lineHeight: 1.7 }}>
          369 Agentic Systems installs an autonomous AI workforce inside your business —
          handling lead intake, appointment setting, follow-up, and revenue recovery
          around the clock, without adding headcount.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {['LEAD INTELLIGENCE', 'WORKFORCE AUTOMATION', 'REVENUE RECOVERY', 'ZERO ADMIN'].map(tag => (
            <span key={tag} style={{
              padding: '6px 14px',
              background: 'rgba(212,175,55,0.07)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 4,
              fontFamily: 'monospace',
              fontSize: 10,
              color: '#D4AF37',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {CAPABILITIES.map(({ code, label, description, color }) => (
            <div key={code} style={{
              background: '#0F0F0F',
              border: '1px solid #1E1E1E',
              borderTop: `2px solid ${color}`,
              borderRadius: 8,
              padding: 28,
            }}>
              <p style={{ margin: '0 0 10px', fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                {code}
              </p>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
                {label}
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Early Access Form */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 96px' }}>
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
              priority white-glove deployment — no commitment required to apply.
            </p>

            {status === 'success' ? (
              <div style={{ padding: '24px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, textAlign: 'center' }}>
                <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10, color: '#4ADE80', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  ✓ APPLICATION RECEIVED
                </p>
                <p style={{ margin: 0, fontSize: 14, color: '#94A3B8' }}>
                  You&apos;re on the founding operator list. We&apos;ll reach out personally when your deployment slot is ready.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Jack Moore"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', background: '#141414', border: '1px solid #222', borderRadius: 6, color: '#FFFFFF', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                        Business Name
                      </label>
                      <input
                        type="text"
                        placeholder="Aspen Dental"
                        value={form.business}
                        onChange={e => setForm(f => ({ ...f, business: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', background: '#141414', border: '1px solid #222', borderRadius: 6, color: '#FFFFFF', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontFamily: 'monospace', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                      Business Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="jack@aspendental.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', background: '#141414', border: '1px solid #222', borderRadius: 6, color: '#FFFFFF', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {status === 'error' && (
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: '#EF4444', fontFamily: 'monospace' }}>
                    Something went wrong — try again or email intelligence@369agenticsystems.com
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  style={{
                    width: '100%', padding: '14px 24px',
                    background: status === 'loading' ? '#A08930' : '#D4AF37',
                    color: '#080808', fontFamily: 'monospace', fontSize: 12,
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    border: 'none', borderRadius: 4,
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {status === 'loading' ? 'SUBMITTING...' : 'APPLY FOR EARLY ACCESS →'}
                </button>

                <p style={{ margin: '12px 0 0', fontSize: 11, color: '#334155', textAlign: 'center', fontFamily: 'monospace' }}>
                  No commitment. No spam. We&apos;ll reach out personally when your slot opens.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #111', padding: '24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 10, color: '#1E293B' }}>
          369 Agentic Systems &nbsp;&middot;&nbsp; AI Workforce Infrastructure &nbsp;&middot;&nbsp;{' '}
          <a href="mailto:intelligence@369agenticsystems.com" style={{ color: '#334155', textDecoration: 'none' }}>
            intelligence@369agenticsystems.com
          </a>
        </p>
      </footer>

    </div>
  )
}

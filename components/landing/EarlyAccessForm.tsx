'use client'

import { useState } from 'react'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', background: '#141414',
  border: '1px solid #222', borderRadius: 6, color: '#FFFFFF',
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'monospace', fontSize: 9, color: '#475569',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6,
}

export default function EarlyAccessForm() {
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

  if (status === 'success') {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10, color: '#4ADE80', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          ✓ APPLICATION RECEIVED
        </p>
        <p style={{ margin: 0, fontSize: 15, color: '#94A3B8', lineHeight: 1.7 }}>
          You&apos;re on the founding operator list.<br />
          We&apos;ll reach out personally when your deployment slot opens.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Your Name</label>
            <input type="text" required placeholder="Your Name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Business Name</label>
            <input type="text" placeholder="Your Business" value={form.business}
              onChange={e => setForm(f => ({ ...f, business: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Business Email</label>
          <input type="email" required placeholder="you@yourbusiness.com" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
        </div>
      </div>

      {status === 'error' && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#EF4444', fontFamily: 'monospace' }}>
          Something went wrong — try again or email intelligence@369agenticsystems.com
        </p>
      )}

      <button type="submit" disabled={status === 'loading'} style={{
        width: '100%', padding: '14px 24px',
        background: status === 'loading' ? '#A08930' : '#D4AF37',
        color: '#080808', fontFamily: 'monospace', fontSize: 12,
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
        border: 'none', borderRadius: 4,
        cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
      }}>
        {status === 'loading' ? 'SUBMITTING...' : 'APPLY FOR EARLY ACCESS →'}
      </button>

      <p style={{ margin: '12px 0 0', fontSize: 11, color: '#334155', textAlign: 'center', fontFamily: 'monospace' }}>
        No commitment. No spam. We&apos;ll reach out personally when your slot opens.
      </p>
    </form>
  )
}

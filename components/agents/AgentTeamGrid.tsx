'use client'

import { useState } from 'react'
import { AgentCard, type AgentName, type Vertical } from './AgentCard'

interface AgentTeamGridProps {
  vertical: Vertical
  size?: 'small' | 'medium' | 'large'
}

const VERTICAL_AGENTS: Record<Vertical, AgentName[]> = {
  original:      ['ava', 'rex', 'nova', 'felix', 'scout'],
  roofing:       ['ava', 'rex', 'nova'],
  hvac:          ['ava', 'rex', 'nova'],
  plumbing:      ['ava', 'rex', 'nova'],
  legal:         ['ava', 'rex', 'nova', 'felix'],
  'real-estate': ['ava', 'rex', 'nova'],
  insurance:     ['ava', 'rex', 'nova'],
  saas:          ['ava', 'rex', 'nova', 'scout'],
  dental:        ['ava', 'rex', 'nova'],
  wholesale:     ['ava', 'rex', 'nova'],
}

const VERTICAL_TAGLINES: Record<Vertical, string> = {
  original:      'Every 369 AOS deploys Ava, Rex, and Nova — trained for your specific industry.',
  roofing:       'Your Speed-to-Lead AOS crew. Three specialists. One mission: never lose another job.',
  hvac:          'Your Emergency Response AOS crew. Three specialists, 24/7 coverage.',
  plumbing:      'Your Emergency Recovery AOS crew. From burst pipes to booked jobs, automatically.',
  legal:         'Your Legal Excellence AOS crew. Four specialists — intake to conflict check to delivery.',
  'real-estate': 'Your Pipeline Velocity AOS crew. From first call to showing scheduled, automatically.',
  insurance:     'Your Agency Revenue AOS crew. Quote, nurture, renew, and triage — all automated.',
  saas:          'Your Growth Engine AOS crew. Four specialists — demos, trials, content, and intelligence.',
  dental:        'Your Patient Revenue AOS crew. Launching Year 2 with full HIPAA compliance.',
  wholesale:     'Your Distribution Velocity AOS crew. Orders captured, confirmed, and routed automatically.',
}

// ── Dental Waitlist ───────────────────────────────────────────────────────────

function DentalWaitlist() {
  const [email, setEmail]       = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || loading) return
    setLoading(true)
    try {
      await fetch('/api/early-access', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, industry: 'dental', source: 'dental-waitlist' }),
      })
    } catch {
      // fail silently
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  const agents: AgentName[] = ['ava', 'rex', 'nova']

  return (
    <div style={{ width: '100%' }}>
      {/* Section header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10, color: '#EC4899', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
          // DENTAL AOS — LAUNCHING 2026
        </p>
        <h2 style={{ margin: '0 0 10px', fontFamily: "'Instrument Sans', sans-serif", fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
          Join the Waitlist
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6, maxWidth: 480, marginInline: 'auto' }}>
          Full HIPAA compliance + Dentrix integration. Built for dental practices that lose patients to after-hours voicemail.
        </p>
      </div>

      {/* Greyed-out agent images */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32, opacity: 0.35, filter: 'grayscale(1)' }}>
        {agents.map(agent => (
          <AgentCard
            key={agent}
            agent={agent}
            vertical="dental"
            size="small"
            showDescription={false}
          />
        ))}
      </div>

      {/* Waitlist form */}
      <div style={{ maxWidth: 420, marginInline: 'auto', padding: '24px', background: 'rgba(236,72,153,0.04)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 14 }}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginInline: 'auto', marginBottom: 12 }}>
              <span style={{ color: '#EC4899', fontSize: 16 }}>✓</span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#F8FAFC' }}>
              {"You're on the list."}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              {"We'll reach out when Dental AOS goes live."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ margin: '0 0 16px', fontFamily: 'monospace', fontSize: 9, color: '#EC4899', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              // SECURE YOUR SPOT
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@practice.com"
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(236,72,153,0.25)',
                  borderRadius: 8, color: '#FFFFFF',
                  fontSize: 14, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 18px',
                  background: '#EC4899',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                  fontFamily: "'Instrument Sans', sans-serif",
                }}
              >
                {loading ? '...' : 'Join Waitlist'}
              </button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>
              No spam. We notify you when dental slots open.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

// ── AgentTeamGrid ─────────────────────────────────────────────────────────────

export function AgentTeamGrid({ vertical, size = 'medium' }: AgentTeamGridProps) {
  if (vertical === 'dental') {
    return <DentalWaitlist />
  }

  const agents  = VERTICAL_AGENTS[vertical]
  const tagline = VERTICAL_TAGLINES[vertical]
  const is4     = agents.length === 4

  return (
    <section style={{ width: '100%' }}>
      {/* Section header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
          // YOUR AI TEAM
        </p>
        <h2 style={{ margin: '0 0 10px', fontFamily: "'Instrument Sans', sans-serif", fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
          Meet the Roster
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6, maxWidth: 480, marginInline: 'auto' }}>
          {tagline}
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: is4
          ? 'repeat(auto-fit, minmax(160px, 1fr))'
          : 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
        justifyItems: 'center',
      }}>
        {agents.map(agent => (
          <AgentCard
            key={agent}
            agent={agent}
            vertical={vertical}
            size={size}
            showDescription
          />
        ))}
      </div>
    </section>
  )
}

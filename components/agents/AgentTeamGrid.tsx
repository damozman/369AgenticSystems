'use client'

import { AgentCard, type AgentName, type Vertical } from './AgentCard'

interface AgentTeamGridProps {
  vertical: Vertical
  size?: 'small' | 'medium' | 'large'
}

const VERTICAL_AGENTS: Record<Vertical, AgentName[]> = {
  original:      ['ava', 'rex', 'nova'],
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
  original:      'Your AI Workforce — working around the clock',
  roofing:       'Your AI Crew — answers every call, follows every lead',
  hvac:          'Your AI Team — emergency-ready, always on',
  plumbing:      'Your AI Team — burst pipes at 2 AM, answered',
  legal:         'Your AI Firm Staff — intake, outreach, compliance',
  'real-estate': 'Your AI Agent Team — speed-to-lead, 24/7',
  insurance:     'Your AI Agency Staff — quotes answered, renewals covered',
  saas:          'Your AI Growth Stack — from signup to retention',
  dental:        'Your AI Front Desk — patient-first, always available',
  wholesale:     'Your AI Order Desk — every inbound, handled',
}

export function AgentTeamGrid({ vertical, size = 'medium' }: AgentTeamGridProps) {
  const agents   = VERTICAL_AGENTS[vertical]
  const tagline  = VERTICAL_TAGLINES[vertical]
  const is4      = agents.length === 4

  return (
    <section style={{ width: '100%' }}>
      {/* Section header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{
          margin: '0 0 8px',
          fontFamily: 'monospace', fontSize: 10,
          color: '#475569', textTransform: 'uppercase', letterSpacing: '0.2em',
        }}>
          // YOUR AI TEAM
        </p>
        <h2 style={{
          margin: '0 0 10px',
          fontFamily: "'Instrument Sans', sans-serif",
          fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 700,
          color: '#F8FAFC', letterSpacing: '-0.01em',
        }}>
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

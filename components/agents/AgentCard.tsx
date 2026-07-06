'use client'

import Image from 'next/image'
import Link from 'next/link'

export type AgentName   = 'ava' | 'rex' | 'nova' | 'felix' | 'scout'
export type Vertical    = 'roofing' | 'hvac' | 'plumbing' | 'legal' | 'real-estate' | 'insurance' | 'saas' | 'dental' | 'wholesale' | 'original'
export type AgentStatus = 'live' | 'deploying' | 'future'

interface AgentCardProps {
  agent: AgentName
  vertical: Vertical
  size?: 'small' | 'medium' | 'large'
  showDescription?: boolean
}

const AGENT_CONFIGS: Record<AgentName, {
  name: string
  defaultRole: string
  defaultVirtue: string
  defaultStatus: AgentStatus
  verticals: Partial<Record<Vertical, { role: string; virtue: string; status: AgentStatus }>>
}> = {
  ava: {
    name: 'Ava', defaultRole: 'AI Receptionist', defaultVirtue: 'Your always-on first responder', defaultStatus: 'live',
    verticals: {
      original:      { role: 'AI Receptionist', virtue: 'Your always-on first responder',     status: 'live'   },
      roofing:       { role: 'AI Receptionist', virtue: 'Never misses a storm call',           status: 'live'   },
      hvac:          { role: 'AI Receptionist', virtue: '24/7 emergency call handling',        status: 'live'   },
      plumbing:      { role: 'AI Receptionist', virtue: 'Burst pipes answered at 2 AM',        status: 'live'   },
      legal:         { role: 'AI Receptionist', virtue: 'High-value cases never go cold',      status: 'live'   },
      'real-estate': { role: 'AI Receptionist', virtue: 'Buyer calls answered 24/7',           status: 'live'   },
      insurance:     { role: 'AI Receptionist', virtue: 'Quote calls never missed',            status: 'live'   },
      saas:          { role: 'AI Receptionist', virtue: 'Demo requests answered 24/7',         status: 'live'   },
      dental:        { role: 'AI Receptionist', virtue: 'After-hours calls handled',           status: 'future' },
      wholesale:     { role: 'AI Receptionist', virtue: 'Inbound orders answered 24/7',        status: 'live'   },
    },
  },
  rex: {
    name: 'Rex', defaultRole: 'Outreach + Follow-up', defaultVirtue: 'Never lets a lead go cold', defaultStatus: 'deploying',
    verticals: {
      original:      { role: 'Outreach + Follow-up',  virtue: 'Never lets a lead go cold',              status: 'deploying' },
      roofing:       { role: 'Storm Alert Agent',      virtue: 'Fires outreach in 60 seconds',           status: 'deploying' },
      hvac:          { role: 'Seasonal Outreach',      virtue: 'Pre-season campaigns + reminders',       status: 'deploying' },
      plumbing:      { role: 'Emergency Follow-up',    virtue: 'Recovers missed emergency calls',        status: 'deploying' },
      legal:         { role: 'Lead Recovery Agent',    virtue: 'Follows up on every cold intake',        status: 'deploying' },
      'real-estate': { role: 'Speed-to-Lead Agent',    virtue: 'SMS within 90 seconds of new leads',     status: 'deploying' },
      insurance:     { role: 'Renewal Guardian',       virtue: '30/14/7 day renewal sequences',          status: 'deploying' },
      saas:          { role: 'Trial Nurture Agent',    virtue: 'Onboarding sequences + churn prevention',status: 'deploying' },
      dental:        { role: 'Reactivation Agent',     virtue: 'Brings back lapsed patients',            status: 'future'    },
      wholesale:     { role: 'Order Follow-up Agent',  virtue: 'Confirms POs + reorder triggers',        status: 'deploying' },
    },
  },
  nova: {
    name: 'Nova', defaultRole: 'Intelligence + Delivery', defaultVirtue: 'Handles the work nobody wants to do', defaultStatus: 'deploying',
    verticals: {
      original:      { role: 'Intelligence + Delivery', virtue: 'Handles the work nobody wants to do',   status: 'deploying' },
      roofing:       { role: 'SMS Estimating Agent',     virtue: 'Delivers estimates automatically',      status: 'deploying' },
      hvac:          { role: 'Maintenance Reports',      virtue: 'Service history + diagnostics',         status: 'deploying' },
      plumbing:      { role: 'Quote Delivery Agent',     virtue: 'Instant quotes while they wait',        status: 'deploying' },
      legal:         { role: 'Document Drafting Agent',  virtue: 'Drafts engagement letters instantly',   status: 'deploying' },
      'real-estate': { role: 'Showing Coordinator',      virtue: 'Schedules, confirms, follows up',       status: 'deploying' },
      insurance:     { role: 'Claims Triage Agent',      virtue: 'Routes claims to the right handler',    status: 'deploying' },
      saas:          { role: 'Content Engine Agent',     virtue: 'Daily SEO content + competitor gaps',   status: 'deploying' },
      dental:        { role: 'Reminder Agent',           virtue: 'Reminders, confirms, no-show recovery', status: 'future'    },
      wholesale:     { role: 'Order Routing Agent',      virtue: 'Routes to correct warehouse instantly',  status: 'deploying' },
    },
  },
  felix: {
    name: 'Felix', defaultRole: 'Conflict Check Agent', defaultVirtue: 'Protects your firm from conflicts', defaultStatus: 'deploying',
    verticals: {
      original: { role: 'Conflict Check Agent', virtue: 'Protects your firm from conflicts', status: 'deploying' },
      legal:    { role: 'Conflict Check Agent', virtue: 'Cross-references every new intake', status: 'deploying' },
    },
  },
  scout: {
    name: 'Scout', defaultRole: 'Competitor Intelligence', defaultVirtue: 'Finds gaps before your competitors do', defaultStatus: 'deploying',
    verticals: {
      original: { role: 'Competitor Intelligence', virtue: 'Finds gaps before your competitors do',     status: 'deploying' },
      saas:     { role: 'Intelligence Agent',      virtue: 'Monitors competitors + finds content gaps', status: 'deploying' },
    },
  },
}

const VERTICAL_COLORS: Record<Vertical, string> = {
  original:      '#D4AF37',
  roofing:       '#FF4500',
  hvac:          '#FF6533',
  plumbing:      '#0369A1',
  legal:         '#60A5FA',
  'real-estate': '#0EA5E9',
  insurance:     '#14B8A6',
  saas:          '#8B5CF6',
  dental:        '#EC4899',
  wholesale:     '#84CC16',
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  live:      { label: 'LIVE',      color: '#4ADE80', bg: 'rgba(74,222,128,0.08)'  },
  deploying: { label: 'DEPLOYING', color: '#D4AF37', bg: 'rgba(212,175,55,0.08)' },
  future:    { label: 'FUTURE',    color: '#475569', bg: 'rgba(71,85,105,0.08)'   },
}

const SIZE_CONFIG = {
  small:  { w: 140, h: 175, name: 16, role: 9,  virtue: 11 },
  medium: { w: 200, h: 250, name: 20, role: 10, virtue: 12 },
  large:  { w: 280, h: 350, name: 26, role: 11, virtue: 13 },
}

function imagePath(agent: AgentName, vertical: Vertical): string {
  const v = vertical === 'real-estate' ? 'real_estate' : vertical
  return `/agents/${agent}/${agent}_${v}.png`
}

export function AgentCard({ agent, vertical, size = 'medium', showDescription = true }: AgentCardProps) {
  const agentCfg   = AGENT_CONFIGS[agent]
  const vertCfg    = agentCfg.verticals[vertical] ?? { role: agentCfg.defaultRole, virtue: agentCfg.defaultVirtue, status: agentCfg.defaultStatus }
  const color      = VERTICAL_COLORS[vertical]
  const statusCfg  = STATUS_CONFIG[vertCfg.status]
  const dim        = SIZE_CONFIG[size]

  return (
    <Link
      href={`/agents/${agent}`}
      style={{ textDecoration: 'none', display: 'block' }}
      title={`Learn more about ${agentCfg.name}`}
    >
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, padding: '20px 16px', borderRadius: 14,
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${color}33`,
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = `${color}66`
        el.style.boxShadow   = `0 0 24px ${color}18`
        el.style.transform   = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = `${color}33`
        el.style.boxShadow   = 'none'
        el.style.transform   = 'translateY(0)'
      }}
    >
      {/* Status badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: statusCfg.bg, border: `1px solid ${statusCfg.color}33`,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusCfg.color, display: 'inline-block' }} />
        <span style={{ color: statusCfg.color, fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {statusCfg.label}
        </span>
      </div>

      {/* Image */}
      <div style={{ position: 'relative', width: dim.w, height: dim.h, borderRadius: 10, overflow: 'hidden', border: `1px solid ${color}22` }}>
        <Image
          src={imagePath(agent, vertical)}
          alt={`${agentCfg.name} — ${vertCfg.role}`}
          fill
          className="object-cover"
          sizes={`${dim.w}px`}
        />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${color}33 0%, transparent 55%)`, pointerEvents: 'none' }} />
      </div>

      {/* Name + role */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 2px', fontSize: dim.name, fontWeight: 700, color, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.01em' }}>
          {agentCfg.name}
        </p>
        <p style={{ margin: 0, fontSize: dim.role, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {vertCfg.role}
        </p>
      </div>

      {/* Virtue */}
      {showDescription && (
        <p style={{ margin: 0, fontSize: dim.virtue, color: '#475569', textAlign: 'center', lineHeight: 1.55, maxWidth: dim.w }}>
          &ldquo;{vertCfg.virtue}&rdquo;
        </p>
      )}
    </div>
    </Link>
  )
}

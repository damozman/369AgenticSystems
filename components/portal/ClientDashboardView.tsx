'use client'

import { useEffect, useState } from 'react'
import { Phone, CalendarCheck, Users, X, Sun, Moon, CheckCircle, Zap, ArrowRight, Clock } from 'lucide-react'

type Call = {
  id: string
  created_at: string
  caller_name: string | null
  caller_phone: string
  duration_seconds: number | null
  transcript: string | null
  call_outcome: string | null
}

type ActiveAgent = {
  key: string
  label: string
  description: string
  color: string
}

type UpgradePath = { tier: string; agents: string[]; price: number } | null

type Subscription = {
  client_domain: string
  tier: string
  vertical: string
}

type Notification = {
  id: string
  title: string
  message: string
}

type Props = {
  stats: { totalCalls: number; bookedCalls: number; totalLeads: number }
  recentCalls: Call[]
  activeAgents: ActiveAgent[]
  upgrade: UpgradePath
  subscription: Subscription
  notifications: Notification[]
}

const OUTCOME_MAP: Record<string, { label: string; color: string; bg: string }> = {
  booked:        { label: 'Appointment Booked', color: '#059669', bg: '#D1FAE5' },
  captured_lead: { label: 'Lead Captured',      color: '#2563EB', bg: '#DBEAFE' },
  no_answer:     { label: 'No Answer',          color: '#D97706', bg: '#FEF3C7' },
  spam:          { label: 'Spam',               color: '#9CA3AF', bg: '#F3F4F6' },
  in_progress:   { label: 'In Progress',        color: '#7C3AED', bg: '#EDE9FE' },
}

function outcomeStyle(outcome: string | null) {
  return OUTCOME_MAP[(outcome ?? '').toLowerCase()] ?? { label: outcome ?? 'Unknown', color: '#6B7280', bg: '#F3F4F6' }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtDuration(seconds: number | null) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function ClientDashboardView({
  stats,
  recentCalls,
  activeAgents,
  upgrade,
  subscription,
  notifications,
}: Props) {
  const [isDark, setIsDark] = useState(false)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('client-portal-theme')
    const dark = saved === 'dark'
    setIsDark(dark)
    // Default is light — only enable dark if user explicitly chose it
    document.documentElement.classList.toggle('light', !dark)
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('light', !next)
    localStorage.setItem('client-portal-theme', next ? 'dark' : 'light')
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#D4AF37' }}>369 Agentic Systems</p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">Your Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{subscription.client_domain}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-emerald-600">Active</span>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="mb-5 space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className="flex items-start gap-3 px-4 py-3 rounded-xl border"
              style={{ borderColor: 'rgba(212,175,55,0.35)', background: 'rgba(212,175,55,0.06)' }}
            >
              <Zap size={14} style={{ color: '#D4AF37' }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#D4AF37' }}>{n.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { label: 'Calls Handled',       value: stats.totalCalls,  color: '#D4AF37', Icon: Phone         },
          { label: 'Appointments Booked', value: stats.bookedCalls, color: '#059669', Icon: CalendarCheck  },
          { label: 'Leads Captured',      value: stats.totalLeads,  color: '#2563EB', Icon: Users          },
        ].map(({ label, value, color, Icon }) => (
          <div
            key={label}
            className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-3 sm:p-4 text-center"
          >
            <Icon size={16} style={{ color }} className="mx-auto mb-2" />
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">{value}</p>
            <p className="text-[11px] font-medium text-[var(--text-muted)] mt-1.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent calls */}
      <div className="mb-7">
        <h2 className="text-base font-bold text-[var(--text-primary)] mb-3">Recent Calls</h2>
        {recentCalls.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
            <Phone size={22} className="mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">No calls yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Your AI receptionist is active and ready to answer.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentCalls.map(call => {
              const outcome = outcomeStyle(call.call_outcome)
              const dur = fmtDuration(call.duration_seconds)
              return (
                <button
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="w-full text-left bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 hover:border-[var(--border-gold)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {call.caller_name ?? call.caller_phone}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {fmtDate(call.created_at)} at {fmtTime(call.created_at)}
                        {dur ? ` · ${dur}` : ''}
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                      style={{ color: outcome.color, background: outcome.bg }}
                    >
                      {outcome.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Active agents */}
      <div className="mb-7">
        <h2 className="text-base font-bold text-[var(--text-primary)] mb-3">
          Your AI Team — {subscription.tier} Plan
        </h2>
        <div className="space-y-2">
          {activeAgents.map(agent => (
            <div
              key={agent.key}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            >
              <CheckCircle size={16} style={{ color: agent.color }} className="flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{agent.label}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{agent.description}</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex-shrink-0">Live</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade card */}
      {upgrade && (
        <div
          className="rounded-xl border p-5 mb-4"
          style={{ borderColor: 'rgba(212,175,55,0.35)', background: 'rgba(212,175,55,0.04)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D4AF37' }}>
            Upgrade Available
          </p>
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
            {upgrade.tier} Plan — ${upgrade.price}/mo
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Unlock additional AI agents and grow your business on autopilot.
          </p>
          <a
            href={`mailto:chris@369agenticsystems.com?subject=Upgrade to ${upgrade.tier} — ${subscription.client_domain}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: '#D4AF37', color: '#000' }}
          >
            Upgrade Now <ArrowRight size={13} />
          </a>
        </div>
      )}

      {/* Call detail modal */}
      {selectedCall && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSelectedCall(null)}
        >
          <div
            className="w-full max-w-lg bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-subtle)] flex-shrink-0">
              <div className="min-w-0">
                <p className="text-base font-bold text-[var(--text-primary)] truncate">
                  {selectedCall.caller_name ?? 'Unknown Caller'}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {selectedCall.caller_phone} · {fmtDate(selectedCall.created_at)} at {fmtTime(selectedCall.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors flex-shrink-0 ml-3"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Outcome + duration pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const o = outcomeStyle(selectedCall.call_outcome)
                  return (
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full"
                      style={{ color: o.color, background: o.bg }}
                    >
                      {o.label}
                    </span>
                  )
                })()}
                {selectedCall.duration_seconds && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] px-3 py-1 rounded-full bg-[var(--bg-elevated)]">
                    <Clock size={11} />
                    {fmtDuration(selectedCall.duration_seconds)}
                  </span>
                )}
              </div>

              {/* Transcript */}
              {selectedCall.transcript ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Call Transcript
                  </p>
                  <div
                    className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap rounded-xl p-4"
                    style={{ background: 'var(--bg-elevated)', fontSize: 13, lineHeight: 1.65 }}
                  >
                    {selectedCall.transcript}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-sm text-[var(--text-muted)] italic">No transcript available for this call.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

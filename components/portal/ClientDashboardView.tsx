'use client'

import { useEffect, useState } from 'react'
import { Phone, CalendarCheck, Users, X, Sun, Moon, CheckCircle, Zap, ArrowRight, Clock } from 'lucide-react'
import { LiveCallToast } from './LiveCallToast'
import { PeakHoursBar } from './PeakHoursBar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Call = {
  id: string
  created_at: string
  caller_name: string | null
  caller_phone: string
  duration_seconds: number | null
  transcript: string | null
  call_outcome: string | null
}

type ActiveAgent  = { key: string; label: string; description: string; color: string }
type UpgradePath  = { tier: string; agents: string[]; price: number } | null
type Subscription = { client_domain: string; tier: string; vertical: string }
type Notification = { id: string; title: string; message: string }

type WeeklyStats = {
  thisWeekCalls:     number
  lastWeekCalls:     number
  thisWeekBooked:    number
  lastWeekBooked:    number
  thisWeekLeads:     number
  lastWeekLeads:     number
  afterHoursRescued: number
  revenueProtected:  number
}

type CallerStats = {
  newCallers:       number
  returningCallers: number
}

type Props = {
  stats: { totalCalls: number; bookedCalls: number; totalLeads: number; answerRate: number | null }
  recentCalls:      Call[]
  activeAgents:     ActiveAgent[]
  upgrade:          UpgradePath
  subscription:     Subscription
  notifications:    Notification[]
  lastCallAt:       string | null
  weeklyStats:      WeeklyStats
  dailyCounts:      number[]
  hourlyBreakdown:  number[]
  callerStats:      CallerStats
}

// ─── Outcome helpers ──────────────────────────────────────────────────────────

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
  const m = Math.floor(seconds / 60), s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── Benchmarks ───────────────────────────────────────────────────────────────

const BENCHMARKS: Record<string, { callsPerWeek: number; label: string }> = {
  roofing:       { callsPerWeek: 8,  label: 'DFW roofing' },
  hvac:          { callsPerWeek: 15, label: 'DFW HVAC' },
  plumbing:      { callsPerWeek: 20, label: 'DFW plumbing' },
  legal:         { callsPerWeek: 12, label: 'DFW law' },
  'real-estate': { callsPerWeek: 10, label: 'DFW real estate' },
  insurance:     { callsPerWeek: 18, label: 'DFW insurance' },
  saas:          { callsPerWeek: 30, label: 'B2B SaaS' },
  wholesale:     { callsPerWeek: 12, label: 'DFW wholesale' },
  dental:        { callsPerWeek: 35, label: 'DFW dental' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Delta({ curr, prev }: { curr: number; prev: number }) {
  const diff = curr - prev
  if (diff === 0) return <span className="text-[10px] text-[var(--text-muted)] mt-1 block">— same as last wk</span>
  return (
    <span className="text-[10px] font-semibold mt-1 block" style={{ color: diff > 0 ? '#059669' : '#DC2626' }}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)} vs last wk
    </span>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.every(v => v === 0)) return null
  const max = Math.max(...data, 1)
  const W = 300, H = 36
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * W
    const y = H - (v / max) * (H - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const labels = Array(7).fill(0).map((_, i) =>
    new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short' })
  )

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] px-4 pt-3 pb-2 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-[var(--text-primary)]">7-Day Trend</p>
        <p className="text-[10px] text-[var(--text-muted)]">
          {data.reduce((a, b) => a + b, 0)} calls this week
        </p>
      </div>
      <svg width="100%" viewBox={`-2 0 ${W + 4} ${H}`} preserveAspectRatio="none" style={{ height: H, display: 'block' }}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#D4AF37" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0"   />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" />
        <polyline points={pts} fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((v, i) => {
          const x = (i / Math.max(data.length - 1, 1)) * W
          const y = H - (v / max) * (H - 4)
          return v > 0 ? <circle key={i} cx={x} cy={y} r="3" fill="#D4AF37" /> : null
        })}
      </svg>
      <div className="flex justify-between mt-1">
        {labels.map((l, i) => (
          <span key={i} className="text-[9px] text-[var(--text-muted)]">{l}</span>
        ))}
      </div>
    </div>
  )
}

function OnboardingChecklist({
  totalCalls, totalLeads, bookedCalls, thisWeekCalls,
}: {
  totalCalls: number; totalLeads: number; bookedCalls: number; thisWeekCalls: number
}) {
  const steps = [
    { label: 'AI Receptionist deployed',  done: true },
    { label: 'First call received',        done: totalCalls > 0 },
    { label: 'First lead captured',        done: totalLeads > 0 || bookedCalls > 0 },
    { label: '5+ calls in a week',         done: thisWeekCalls >= 5 },
  ]
  const doneCount = steps.filter(s => s.done).length
  if (doneCount === steps.length) return null

  return (
    <div className="rounded-xl border p-4 mb-5" style={{ borderColor: 'rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.04)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#60A5FA' }}>Getting Started</p>
        <p className="text-xs text-[var(--text-muted)]">{doneCount}/{steps.length} complete</p>
      </div>
      <div className="h-1.5 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%`, background: '#60A5FA' }} />
      </div>
      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
              style={{
                background:  step.done ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                border:      `1px solid ${step.done ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color:       step.done ? '#4ADE80' : '#475569',
              }}
            >
              {step.done ? '✓' : i + 1}
            </span>
            <span className="text-xs" style={{ color: step.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReceptionistStatus({ lastCallAt }: { lastCallAt: string | null }) {
  const hoursSince = lastCallAt
    ? (Date.now() - new Date(lastCallAt).getTime()) / (1000 * 60 * 60)
    : Infinity

  let status: 'active' | 'quiet' | 'offline'
  let color: string, bg: string, border: string, dot: string, headline: string, detail: string

  if (hoursSince < 24) {
    status = 'active'; color = '#059669'; bg = 'rgba(5,150,105,0.06)'; border = 'rgba(5,150,105,0.2)'; dot = '#4ADE80'
    headline = 'Receptionist Active'
    detail = `Last call ${hoursSince < 1 ? 'less than an hour' : `${Math.floor(hoursSince)}h`} ago`
  } else if (hoursSince < 48) {
    status = 'quiet'; color = '#D97706'; bg = 'rgba(217,119,6,0.06)'; border = 'rgba(217,119,6,0.2)'; dot = '#F59E0B'
    headline = 'No Calls in 24+ Hours'
    detail = "If forwarding is on and it's been slow, that's okay. If not, check forwarding below."
  } else {
    status = 'offline'; color = '#DC2626'; bg = 'rgba(220,38,38,0.06)'; border = 'rgba(220,38,38,0.2)'; dot = '#F87171'
    headline = lastCallAt ? 'Receptionist May Be Inactive' : 'No Calls Received Yet'
    detail = lastCallAt
      ? 'No calls in 48+ hours — verify call forwarding is active.'
      : 'Set up call forwarding to start receiving calls through your AI receptionist.'
  }

  const [showHelp, setShowHelp]     = useState(false)
  const [sendState, setSendState]   = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSendInstructions() {
    setSendState('sending')
    try {
      const res = await fetch('/api/send-setup-instructions', { method: 'POST' })
      setSendState(res.ok ? 'sent' : 'error')
    } catch {
      setSendState('error')
    }
  }

  return (
    <div className="mb-5 rounded-xl border p-4" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: dot, boxShadow: status === 'active' ? `0 0 6px ${dot}` : 'none' }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color }}>{headline}</p>
            <p className="text-xs mt-0.5 text-[var(--text-muted)] leading-snug">{detail}</p>
          </div>
        </div>
        {status !== 'active' && (
          <button onClick={() => setShowHelp(h => !h)} className="text-xs font-medium flex-shrink-0 underline underline-offset-2" style={{ color }}>
            {showHelp ? 'Hide' : 'How to fix →'}
          </button>
        )}
      </div>

      {showHelp && status !== 'active' && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: border }}>
          <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Enable call forwarding (60 seconds):</p>
          <ul className="space-y-1">
            {[
              ['AT&T / Verizon', 'Dial *72 then your Retell number'],
              ['T-Mobile',       'Settings → Phone → Call Forwarding'],
              ['Landline / VoIP','Check your provider\'s call forwarding settings'],
            ].map(([carrier, inst]) => (
              <li key={carrier} className="text-xs text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-primary)]">{carrier}:</span> {inst}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status !== 'active' && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: border }}>
          <button
            onClick={handleSendInstructions}
            disabled={sendState === 'sending' || sendState === 'sent'}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-opacity"
            style={{
              background: sendState === 'sent' ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
              border:     `1px solid ${sendState === 'sent' ? 'rgba(74,222,128,0.25)' : border}`,
              color:      sendState === 'sent' ? '#4ADE80' : color,
              opacity:    sendState === 'sending' ? 0.7 : 1,
              cursor:     sendState === 'sending' || sendState === 'sent' ? 'default' : 'pointer',
            }}
          >
            {sendState === 'idle'    && '📧 Send Setup Instructions to My Email'}
            {sendState === 'sending' && 'Sending…'}
            {sendState === 'sent'    && '✓ Instructions Sent — Check Your Inbox'}
            {sendState === 'error'   && '⚠ Failed to send — try again'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientDashboardView({
  stats, recentCalls, activeAgents, upgrade, subscription,
  notifications, lastCallAt, weeklyStats, dailyCounts, hourlyBreakdown, callerStats,
}: Props) {
  const [isDark, setIsDark]             = useState(false)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  const benchmark = BENCHMARKS[subscription.vertical]

  useEffect(() => {
    const dark = localStorage.getItem('client-portal-theme') === 'dark'
    setIsDark(dark)
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

      {/* ── Header ─────────────────────────────────────────────────── */}
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

      {/* ── Notifications ──────────────────────────────────────────── */}
      {notifications.length > 0 && (
        <div className="mb-5 space-y-2">
          {notifications.map(n => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border"
              style={{ borderColor: 'rgba(212,175,55,0.35)', background: 'rgba(212,175,55,0.06)' }}>
              <Zap size={14} style={{ color: '#D4AF37' }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#D4AF37' }}>{n.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Receptionist status ────────────────────────────────────── */}
      <ReceptionistStatus lastCallAt={lastCallAt} />

      {/* ── Onboarding checklist (hides when all steps complete) ────── */}
      <OnboardingChecklist
        totalCalls={stats.totalCalls}
        totalLeads={stats.totalLeads}
        bookedCalls={stats.bookedCalls}
        thisWeekCalls={weeklyStats.thisWeekCalls}
      />

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Calls Handled */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-3 sm:p-4 text-center">
          <Phone size={16} style={{ color: '#D4AF37' }} className="mx-auto mb-2" />
          <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">{stats.totalCalls}</p>
          <p className="text-[11px] font-medium text-[var(--text-muted)] mt-1.5 leading-tight">Calls Handled</p>
          <Delta curr={weeklyStats.thisWeekCalls} prev={weeklyStats.lastWeekCalls} />
          {stats.answerRate !== null && (
            <span
              className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: stats.answerRate >= 90 ? 'rgba(5,150,105,0.12)' : stats.answerRate >= 75 ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.12)',
                color:      stats.answerRate >= 90 ? '#059669'               : stats.answerRate >= 75 ? '#D97706'               : '#DC2626',
              }}
            >
              {stats.answerRate}% answered
            </span>
          )}
        </div>

        {/* Appointments Booked */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-3 sm:p-4 text-center">
          <CalendarCheck size={16} style={{ color: '#059669' }} className="mx-auto mb-2" />
          <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">{stats.bookedCalls}</p>
          <p className="text-[11px] font-medium text-[var(--text-muted)] mt-1.5 leading-tight">Appointments</p>
          <Delta curr={weeklyStats.thisWeekBooked} prev={weeklyStats.lastWeekBooked} />
        </div>

        {/* Leads Captured */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-3 sm:p-4 text-center">
          <Users size={16} style={{ color: '#2563EB' }} className="mx-auto mb-2" />
          <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">{stats.totalLeads}</p>
          <p className="text-[11px] font-medium text-[var(--text-muted)] mt-1.5 leading-tight">Leads Captured</p>
          <Delta curr={weeklyStats.thisWeekLeads} prev={weeklyStats.lastWeekLeads} />
        </div>
      </div>

      {/* ── 7-day sparkline ────────────────────────────────────────── */}
      <Sparkline data={dailyCounts} />

      {/* ── Performance highlights ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border p-4 flex flex-col justify-between"
          style={{ background: 'rgba(212,175,55,0.05)', borderColor: 'rgba(212,175,55,0.25)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#D4AF37' }}>Revenue Protected</p>
          <p className="text-2xl font-bold leading-none" style={{ color: '#D4AF37' }}>
            {weeklyStats.revenueProtected > 0 ? `$${weeklyStats.revenueProtected.toLocaleString()}` : '—'}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5 leading-snug">estimated last 30 days</p>
        </div>

        <div className="rounded-xl border p-4 flex flex-col justify-between"
          style={{ background: 'rgba(167,139,250,0.05)', borderColor: 'rgba(167,139,250,0.2)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#A78BFA' }}>After-Hours Rescued</p>
          <p className="text-2xl font-bold leading-none" style={{ color: '#A78BFA' }}>{weeklyStats.afterHoursRescued}</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5 leading-snug">calls caught outside biz hours this week</p>
        </div>
      </div>

      {/* ── Caller intelligence + benchmark ───────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* New vs Returning */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Callers — 30 Days
          </p>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)] leading-none">{callerStats.newCallers}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">New</p>
            </div>
            <div>
              <p className="text-2xl font-bold leading-none" style={{ color: '#A78BFA' }}>{callerStats.returningCallers}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Returning</p>
            </div>
          </div>
        </div>

        {/* Industry benchmark */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            vs. Industry
          </p>
          {benchmark ? (
            <>
              <p
                className="text-2xl font-bold leading-none"
                style={{ color: weeklyStats.thisWeekCalls >= benchmark.callsPerWeek ? '#4ADE80' : '#F59E0B' }}
              >
                {weeklyStats.thisWeekCalls >= benchmark.callsPerWeek ? '↑ Above' : '↓ Below'}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {benchmark.label} avg {benchmark.callsPerWeek}/wk · You: {weeklyStats.thisWeekCalls}
              </p>
            </>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">No benchmark for this vertical yet.</p>
          )}
        </div>
      </div>

      {/* ── Peak hours bar ─────────────────────────────────────────── */}
      <PeakHoursBar hourlyBreakdown={hourlyBreakdown} />

      {/* ── Recent calls ───────────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Recent Calls</h2>
          <a
            href="/api/export-calls"
            download
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ↓ Export CSV
          </a>
        </div>
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
              const dur     = fmtDuration(call.duration_seconds)
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
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                      style={{ color: outcome.color, background: outcome.bg }}>
                      {outcome.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Active agents ──────────────────────────────────────────── */}
      <div className="mb-7">
        <h2 className="text-base font-bold text-[var(--text-primary)] mb-3">
          Your AI Team — {subscription.tier} Plan
        </h2>
        <div className="space-y-2">
          {activeAgents.map(agent => (
            <div key={agent.key} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
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

      {/* ── Upgrade card ───────────────────────────────────────────── */}
      {upgrade && (
        <div className="rounded-xl border p-5 mb-4" style={{ borderColor: 'rgba(212,175,55,0.35)', background: 'rgba(212,175,55,0.04)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D4AF37' }}>Upgrade Available</p>
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">{upgrade.tier} Plan — ${upgrade.price}/mo</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">Unlock additional AI agents and grow your business on autopilot.</p>
          <a
            href={`mailto:chris@369agenticsystems.com?subject=Upgrade to ${upgrade.tier} — ${subscription.client_domain}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: '#D4AF37', color: '#000' }}
          >
            Upgrade Now <ArrowRight size={13} />
          </a>
        </div>
      )}

      {/* ── Call detail modal ──────────────────────────────────────── */}
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

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const o = outcomeStyle(selectedCall.call_outcome)
                  return (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color: o.color, background: o.bg }}>
                      {o.label}
                    </span>
                  )
                })()}
                {selectedCall.duration_seconds && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] px-3 py-1 rounded-full bg-[var(--bg-elevated)]">
                    <Clock size={11} /> {fmtDuration(selectedCall.duration_seconds)}
                  </span>
                )}
              </div>

              {selectedCall.transcript ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Call Transcript</p>
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

      {/* ── Live call toast (fixed overlay) ────────────────────────── */}
      <LiveCallToast clientDomain={subscription.client_domain} />

    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Shield, TrendingUp, Zap, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { SystemAudit } from './ActiveSpecialists'

type StatusFilter = 'all' | 'active' | 'processing' | 'idle' | 'warn'

const STATUS_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  active:     { dot: '#4ADE80', text: '#4ADE80', bg: 'rgba(74,222,128,0.10)' },
  processing: { dot: '#D4AF37', text: '#D4AF37', bg: 'rgba(212,175,55,0.10)' },
  idle:       { dot: '#64748B', text: '#64748B', bg: 'rgba(100,116,139,0.10)' },
  pending:    { dot: '#D4AF37', text: '#D4AF37', bg: 'rgba(212,175,55,0.10)' },
}

function statusStyle(s: string | null) {
  const key = (s ?? '').toLowerCase()
  return STATUS_COLORS[key] ?? STATUS_COLORS.idle
}

function scoreColor(n: number | null, invert = false) {
  if (n == null) return '#475569'
  const good = invert ? n < 50 : n >= 70
  const mid  = invert ? n < 70 : n >= 50
  if (good) return '#4ADE80'
  if (mid)  return '#D4AF37'
  return '#F87171'
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

interface Props {
  initialAudits: SystemAudit[]
}

export default function LeadsTable({ initialAudits }: Props) {
  const [audits, setAudits]       = useState<SystemAudit[]>(initialAudits ?? [])
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<StatusFilter>('all')

  // Real-time updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('leads_table')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_audits' }, (p) => {
        setAudits(prev => [p.new as SystemAudit, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_audits' }, (p) => {
        setAudits(prev => prev.map(a => a.id === (p.new as SystemAudit).id ? p.new as SystemAudit : a))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = useMemo(() => {
    let rows = audits
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(a => a.client_domain.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'warn') {
        rows = rows.filter(a => a.leak_detected)
      } else {
        rows = rows.filter(a => (a.payload_status ?? '').toLowerCase().startsWith(statusFilter))
      }
    }
    return rows
  }, [audits, search, statusFilter])

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',        label: 'All' },
    { key: 'active',     label: 'Active' },
    { key: 'processing', label: 'Processing' },
    { key: 'idle',       label: 'Idle' },
    { key: 'warn',       label: 'Warns' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-0.5">
            // LEADS DATABASE
          </p>
          <h2 className="text-lg font-display font-semibold text-white">
            All Audits
            <span className="ml-2 text-sm font-mono font-normal text-slate-500">
              {filtered.length}/{audits.length}
            </span>
          </h2>
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search domain…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[11px] font-mono bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-slate-300 placeholder-slate-700 outline-none focus:border-[#D4AF37] transition-colors w-44"
          />
        </div>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={[
              'px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-colors',
              statusFilter === f.key
                ? f.key === 'warn'
                  ? 'bg-[rgba(120,53,15,0.35)] border-[#92400E] text-amber-400'
                  : 'bg-[rgba(212,175,55,0.12)] border-[#D4AF37] text-[#D4AF37]'
                : 'bg-transparent border-[var(--border-subtle)] text-slate-600 hover:text-slate-400 hover:border-slate-600',
            ].join(' ')}
          >
            {f.label}
            {f.key === 'warn' && audits.filter(a => a.leak_detected).length > 0 && (
              <span className="ml-1 text-amber-500">
                {audits.filter(a => a.leak_detected).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-terminal)] rounded-xl border border-[var(--border-gold)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
                {[
                  { label: 'Domain',   icon: null },
                  { label: 'Sec',      icon: <Shield size={9} /> },
                  { label: 'SEO',      icon: <TrendingUp size={9} /> },
                  { label: 'ROI',      icon: <Zap size={9} /> },
                  { label: 'Leak',     icon: <AlertTriangle size={9} /> },
                  { label: 'Status',   icon: null },
                  { label: 'Date',     icon: null },
                ].map(col => (
                  <th
                    key={col.label}
                    className="px-3 py-2.5 text-left text-[9px] uppercase tracking-widest text-slate-600 font-bold whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      {col.icon}
                      {col.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-700">
                    {search || statusFilter !== 'all' ? 'No results match your filter.' : 'No audits yet — submit a form to see leads here.'}
                  </td>
                </tr>
              ) : (
                filtered.map((audit, i) => {
                  const st = statusStyle(audit.payload_status)
                  return (
                    <tr
                      key={audit.id ?? i}
                      className="border-b border-[var(--border-faint)] hover:bg-[var(--item-bg)] transition-colors"
                      style={audit.leak_detected ? { background: 'rgba(120,53,15,0.08)' } : {}}
                    >
                      <td className="px-3 py-2.5 text-slate-200 font-medium truncate max-w-[180px]">
                        {audit.leak_detected && (
                          <span className="mr-1 text-amber-500">⚠</span>
                        )}
                        {audit.client_domain}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: scoreColor(audit.security_score) }}>
                        {audit.security_score ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: scoreColor(audit.seo_visibility) }}>
                        {audit.seo_visibility ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-400">
                        {audit.roi_multiplier != null ? `${audit.roi_multiplier}×` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {audit.leak_detected
                          ? <span className="text-amber-400 font-bold">YES</span>
                          : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: st.text, background: st.bg }}
                        >
                          <span className="w-1 h-1 rounded-full inline-block flex-shrink-0" style={{ background: st.dot }} />
                          {audit.payload_status ?? 'idle'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                        {fmt(audit.created_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
